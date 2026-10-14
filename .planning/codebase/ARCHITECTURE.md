<!-- refreshed: 2026-08-28 -->
# Architecture

**Analysis Date:** 2026-08-28

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────┐
│  Worker Thread (public/workers/cron.js + cronLogic.js)                │
│  setTimeout self-scheduling loop, every replica runs one              │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ Bearer-authed GET, ~every UPDATE_INTERVAL s
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│  POLLER LEASE  `src/update/lease.mjs`                                 │
│  Postgres row `worker_heartbeat` — every replica claims it;           │
│  only the winner proceeds, others answer 200 {role:'standby'}         │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ (holder only)
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│  UPDATE ROUTE  `src/app/api/h1/update/route.js`                       │
│  updateStatus() ─┬─ Zod validate ─┬─ bucket-upsert                    │
│  updateSeason() ─┘                └─ season-transition closing pass   │
└───────────┬─────────────────────────────────────────┬─────────────────┘
            │                                          │ after() deferred
            ▼                                          ▼
┌───────────────────────────────────┐   ┌─────────────────────────────────┐
│  h1_* NORMALIZED TABLES            │   │  PUSH / TOAST NOTIFICATIONS     │
│  h1_season, h1_status,             │   │  `src/update/pushNotifier.mjs`  │
│  h1_statistic, h1_event,           │   │  detectChanges() diff vs        │
│  h1_event_progress                 │   │  lease-stored prevEvents        │
│  `prisma/schema.prisma`            │   └─────────────────────────────────┘
└───────────┬─────────────────────────────────────────────────────────────┘
            │ read
            ▼
┌───────────────────────────────────────────────────────────────────────┐
│  READ PATHS                                                            │
│  /api/h1/live (computeLiveMap)  → useLiveData polling → dashboard      │
│  /api/v1/h1/{map,season,stats,status} (public, rate-limited)           │
│  /archives (on-demand season backfill via updateSeason())              │
│  SSR (layout.jsx, opengraph-image.jsx via computeLiveMapState)         │
└───────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Cron worker thread | Self-scheduling poll loop, posts result to main thread | `public/workers/cron.js`, `public/workers/cronLogic.js` |
| Poller lease | Single-writer election across N app replicas via Postgres row claim | `src/update/lease.mjs` |
| Update route | Orchestrates one poll: lease claim, status/season update, closing pass, push, heartbeat | `src/app/api/h1/update/route.js` |
| Status updater | Validates + bucket-upserts `get_campaign_status` payload | `src/update/status.mjs` |
| Season updater | Validates + bucket-upserts `get_snapshots` payload (events, statistics, season anchor) | `src/update/season.mjs` |
| Push notifier | Diffs event snapshots, sends web-push, dedups via lease-stored `prevEvents` | `src/update/pushNotifier.mjs` |
| Bucketing helper | Groups poll timestamps into fixed-width buckets shared by both write paths | `src/shared/utils/bucketing.mjs` |
| DB queries | Upsert/read functions against `h1_*` tables (one file per query) | `src/db/queries/*.mjs` |
| Live map projection | Filters active events, computes sector ownership, single source shared by `/api/h1/live` and `/api/v1/h1/map` | `src/shared/utils/game/computeMapState.mjs` |
| Live polling client | Client-side `setInterval` + visibilitychange poll, tri-state connection status | `src/shared/hooks/useLiveData.mjs` |
| Rebroadcast API | Reconstructs legacy HD1 wire format from normalized tables | `src/db/queries/rebroadcast.mjs`, `src/app/api/h1/rebroadcast/route.js` |
| Public v1 API | Rate-limited, API-key-gated, versioned read endpoints | `src/app/api/v1/h1/*/route.js` |
| Auth | BetterAuth server config, `null` when disabled | `src/auth.js` |
| Error tracking | Sentry/GlitchTip init, tunneled via `/api/glitchtip` | `src/app/api/glitchtip/route.js` |

## Pattern Overview

**Overall:** Next.js App Router monolith (server + client components + API routes) around a normalized Postgres schema, fed by an in-process worker thread that polls an external upstream API. No separate backend service — the "worker" is a `worker_threads` thread inside the same Next.js server process, and multi-replica deployments coordinate via a database-row lease rather than a message queue or external scheduler.

**Key Characteristics:**
- Single source of truth for wire-format reconstruction: no raw-cache tables, the rebroadcast/public APIs derive legacy-shaped JSON from normalized rows on read.
- Time-bucketed upsert instead of append-only event log for timeseries tables (`h1_status`, `h1_statistic`, `h1_event_progress`).
- Coordination via Postgres (`worker_heartbeat` row), not an external lock service — deliberate choice noted in `src/update/lease.mjs` ("Not pg_advisory_lock: those are bound to a session, and Prisma pools connections").
- Cross-cutting poller state (`prevEvents`, `lastSeasonObserved`) lives in the database row that the lease already serializes, so a handover between replicas is exactly-once instead of miss-or-duplicate.

## Layers

**Worker/scheduling layer:**
- Purpose: drive periodic polling of the upstream HD1 API without an external cron.
- Location: `public/workers/cron.js` (thin thread shell), `public/workers/cronLogic.js` (testable poll loop, exported `makeDoWork`)
- Contains: `setTimeout`-based self-rescheduling loop, `fetch` to `localhost:PORT/api/h1/update`, first-poll startup header (`X-Worker-Startup`)
- Depends on: `/api/h1/update` route being reachable on the same host
- Used by: Next.js server bootstrap (worker thread spawned alongside the app)

**Coordination layer (lease):**
- Purpose: ensure exactly one replica performs the update work at a time, and hand off poller state cleanly on failover
- Location: `src/update/lease.mjs`
- Contains: `claimLease()` (atomic upsert with conditional `WHERE`), `persistPollerState()` (holder-guarded state write), `makeHolderId()`
- Depends on: `worker_heartbeat` table (`prisma/schema.prisma`), `db` client (`src/db/db.js`)
- Used by: `src/app/api/h1/update/route.js`

**Update/ingestion layer:**
- Purpose: fetch upstream data, validate, and bucket-upsert into normalized tables
- Location: `src/update/*.mjs` (`status.mjs`, `season.mjs`, `fetch.mjs`, `pushNotifier.mjs`)
- Contains: orchestration functions called by the update route; Zod validation happens here before any DB write
- Depends on: `src/validators/*.mjs`, `src/db/queries/*.mjs`, `src/shared/utils/bucketing.mjs`
- Used by: `src/app/api/h1/update/route.js`, on-demand backfill in `src/features/archives/reseedSeason.mjs`, `/archives` page

**Data access layer:**
- Purpose: single-responsibility upsert/read functions per table/query
- Location: `src/db/queries/*.mjs`, `src/db/db.js` (Prisma client singleton)
- Contains: `upsertStatus.mjs`, `upsertStatistic.mjs`, `upsertEvent.mjs`, `upsertEventProgress.mjs`, `upsertSeason.mjs`, `getCampaign*.mjs`, `getStats.mjs`, `rebroadcast.mjs`
- Depends on: `src/generated/prisma/` (generated client), `prisma/schema.prisma`
- Used by: update layer (writes), API routes and server components (reads)

**API layer:**
- Purpose: expose internal update endpoint, live polling endpoint, and versioned public read API
- Location: `src/app/api/**/route.js`
- Contains: `h1/update` (internal, key-gated), `h1/live` (internal, powers dashboard polling), `h1/campaign`, `h1/rebroadcast` (legacy wire-format), `v1/h1/{map,season,stats,status}` (public, rate-limited, API-key auth), `healthcheck`, `auth/[...all]` (BetterAuth), `notifications/subscribe`, `glitchtip` (Sentry tunnel), `umami` (analytics proxy)
- Depends on: update layer, db queries, `src/shared/utils/api/*` (responses, rate limiting, auth guards, etag, cursor)
- Used by: worker thread, browser clients, `useLiveData` hook, external API consumers

**Presentation layer:**
- Purpose: server + client React components rendering the dashboard, archives, docs, admin, and account UI
- Location: `src/app/**/page.jsx` (routes), `src/features/**` (feature components), `src/shared/components/**` (shared UI primitives)
- Contains: `DashboardClient`, `Galaxy`/`Map`, `EventCard`, `TimelineSection`/`EventLog`, `StatGrid`, `ArchivesClient`, `AdminSection`, `NotificationToggle`
- Depends on: `src/shared/hooks/*`, `src/shared/utils/game/*` (map/event derivations), API routes (client fetches)
- Used by: end users via browser

## Data Flow

### Primary poll → persist path

1. Worker thread fires a poll (`public/workers/cronLogic.js:26` `doWork()`), `fetch`ing `GET /api/h1/update` with `Authorization: Bearer <UPDATE_KEY>`.
2. Route validates the key with `crypto.timingSafeEqual` and checks `isWorkerEnabled()` (`src/app/api/h1/update/route.js:64-79`) — a web-only replica must 403 rather than run stale-state logic.
3. `claimLease()` (`src/update/lease.mjs:42`) does a single `INSERT ... ON CONFLICT DO UPDATE` against `worker_heartbeat`, guarded by a `WHERE` clause that only lets the current holder or an expired lease through. Non-holders get `null` back and the route responds `{ role: 'standby' }` immediately (`route.js:89-90`) — no further work happens on a standby replica.
4. Holder: `updateStatus()` (`src/update/status.mjs`) fetches `get_campaign_status`, Zod-validates, computes the poll's bucket via `computeBucket()` (`src/shared/utils/bucketing.mjs`), and upserts into `h1_status` / `h1_statistic` via `src/db/queries/upsertStatus.mjs` / `upsertStatistic.mjs`.
5. Season-transition closing pass: if the lease's `lastSeasonObserved` is lower than the just-fetched season, `updateSeason(lastSeasonObserved)` runs once against the outgoing season to capture HD1's delayed closing snapshot (`route.js:119-143`). Non-fatal on error.
6. `persistPollerState(HOLDER_ID, { lastSeasonObserved })` writes the new season back into the lease row so the next poll (possibly on a different holder) knows the boundary.
7. `updateSeason(statusData.season, { protectedBucket })` (`src/update/season.mjs`) fetches `get_snapshots`, Zod-validates, and bucket-upserts `h1_event`, `h1_event_progress`, `h1_season` (season anchor with inlined arrays), and `h1_statistic` — passing `protectedBucket` so a stale snapshot bucket can't clobber the fresher `updateStatus()` write for the same bucket.
8. Non-fatal per-call warnings from either updater are logged and reported to GlitchTip (not thrown) so partial degradation stays visible without failing the poll.
9. `after(async () => { checkAndNotify(prevEvents) })` runs post-response: diffs the new event snapshot against the lease-stored `prevEvents`, fires web-push via `src/update/pushNotifier.mjs`, and persists the new snapshot back to the lease row — deferred so push delivery doesn't block the poll's response time.
10. `writeHeartbeat()` updates `worker_heartbeat.last_beat` / `poll_duration_ms` / `last_error`, guarded to only update the current holder's own row.

### Live read path (dashboard)

1. `useLiveData` hook (`src/shared/hooks/useLiveData.mjs`) polls `GET /api/h1/live` every 10s via `setInterval`, plus an immediate poll on `visibilitychange` tab focus.
2. `/api/h1/live` route reads the latest `h1_status`/`h1_event`/`h1_statistic` rows and calls `computeLiveMap(data)` (`src/shared/utils/game/computeMapState.mjs`) — the single source of the "only active events count" filter, returning `{ activeEvents, mapState }`.
3. `/api/v1/h1/map` (public v1 API) calls the same `computeLiveMap()` so the internal and public live-map views cannot drift.
4. SSR callers (`src/app/layout.jsx`, `src/app/opengraph-image.jsx`) use `computeLiveMapState(data)`, a thin wrapper returning just the map (no client-only `activeEvents` payload).
5. Client renders tri-state connection status (`'polling'` / `'live'` / `'offline'`) plus a module-level singleton connection so only one poll loop runs per tab; BroadcastChannel handles leader election for Web Notifications across tabs.
6. `detectChanges()` (`src/shared/utils/game/detectChanges.mjs`) runs client-side on each poll result to fire Sonner toasts / Web Notifications for event transitions; `LiveToasts` also renders catch-up toasts for events already active on page load.

### Archives / on-demand backfill

1. `/archives` derives available seasons from the current season number, not a DB query.
2. Missing seasons are backfilled on first request via `updateSeason()` (`src/features/archives/reseedSeason.mjs` → `src/update/season.mjs`) — the same pipeline the poller runs continuously for the live season, and the same one the admin "Refresh" button (`src/features/admin/RefreshButton.jsx`) triggers.
3. `updateSeason` writes `h1_season` + `h1_status` + `h1_statistic` + `h1_event` + `h1_event_progress`, then stamps `h1_season.last_updated`.

**State Management:**
- Server-side cross-replica state (poller identity, `prevEvents`, `lastSeasonObserved`) lives entirely in the `worker_heartbeat` Postgres row — no in-process module state survives a replica restart or handover.
- Module-level state exists only within a single process's lifetime as a convenience (e.g. `lastRateLimitCleanup` throttle in `route.js:38`), never as the source of truth for cross-replica correctness.
- Client-side: `useLiveData` singleton per tab; `usePersistedState` hook for localStorage-backed UI preferences; Sonner `<Toaster>` co-located inside `LiveToasts` (not root layout) to share one module-level `ToastState` — instantiating it from a server component would create a second, disconnected toast state.

## Key Abstractions

**Poller lease:**
- Purpose: turn "N replicas, 1 poller" into a Postgres row-claim problem instead of a service-discovery/election problem.
- Examples: `src/update/lease.mjs`, consumed in `src/app/api/h1/update/route.js`
- Pattern: atomic conditional upsert (`INSERT ... ON CONFLICT DO UPDATE ... WHERE`), TTL-based failover (`LEASE_TTL_S = 60`), no explicit election — a dead holder is simply replaced once its lease expires.

**Bucket-upsert:**
- Purpose: collapse high-frequency polls (~15-20s) into fixed-width timeseries rows without unbounded row growth.
- Examples: `src/shared/utils/bucketing.mjs` (`computeBucket`), consumed by `upsertStatus.mjs`, `upsertStatistic.mjs`, `upsertEventProgress.mjs`
- Pattern: `season + enemy + bucket` composite key; within a bucket, values overwrite; a new bucket creates a new row. `BUCKET_SIZE` env var controls width (default 900s).

**Live-map projection:**
- Purpose: single, shared derivation of galaxy sector ownership from raw campaign/event data, consumed by three different callers that must never disagree.
- Examples: `src/shared/utils/game/computeMapState.mjs` (`computeLiveMap`, `computeLiveMapState`, `computeMapState`)
- Pattern: pure function over `{ campaign, events }`-shaped input; sectors 1-10 derive from campaign `points`/`points_max`, region 11 (homeworld) derives from attack events only, since it has no persistent campaign entry.

**tryCatch wrapper:**
- Purpose: replace try/catch blocks with a consistent `{ data, error }` return shape (see CLAUDE.md § Conventions).
- Examples: `src/shared/utils/tryCatch.mjs`, used throughout `src/update/*.mjs` and `src/app/api/**/route.js`
- Pattern: `const { data, error } = await tryCatch(promise)`.

## Entry Points

**Worker thread bootstrap:**
- Location: `public/workers/cron.js`
- Triggers: spawned by the Next.js server process on startup (guarded by `isWorkerEnabled()` so a web-only replica doesn't spawn it)
- Responsibilities: connect `parentPort` to `makeDoWork()` from `cronLogic.js`, start the self-scheduling poll loop

**`GET /api/h1/update`:**
- Location: `src/app/api/h1/update/route.js`
- Triggers: worker thread poll (internal only — key-gated, `UPDATE_KEY` Bearer token)
- Responsibilities: lease claim, status/season ingestion, season-transition closing pass, push notification dispatch, heartbeat write

**`GET /api/h1/live`:**
- Location: `src/app/api/h1/live/route.js`
- Triggers: `useLiveData` hook polling every 10s from every open dashboard tab
- Responsibilities: read latest bucket, compute live map + active events, return to client

**`GET /api/v1/h1/{map,season,stats,status}`:**
- Location: `src/app/api/v1/h1/*/route.js`
- Triggers: external API consumers (rate-limited, API-key authenticated)
- Responsibilities: reconstruct versioned public JSON via `*Projection.mjs` files from normalized tables

**`src/app/page.jsx` / `src/app/layout.jsx`:**
- Location: `src/app/page.jsx`, `src/app/layout.jsx`
- Triggers: browser navigation to `/`
- Responsibilities: SSR the dashboard shell, seed initial map state via `computeLiveMapState`

## Architectural Constraints

- **Threading:** The "worker" is a `worker_threads` thread inside the same Next.js server process, not a separate service — `postMessage` is the only channel back to the main thread, and the main thread does nothing with poll results beyond what any `parentPort.on('message', ...)` listener does (the actual work happens synchronously inside the `/api/h1/update` HTTP handler that the worker calls).
- **Global state:** `HOLDER_ID` (`src/update/lease.mjs:33`) is a module-level singleton computed once per process at import time (host+pid+nonce). `lastRateLimitCleanup` (`src/app/api/h1/update/route.js:38`) is module-level and resets on restart — acceptable because it's a throttle, not correctness-critical. `useLiveData`'s polling connection is a module-level singleton per browser tab.
- **Multi-replica coordination:** All cross-replica coordination goes through the single `worker_heartbeat` row (`WORKER_TYPE = 'cron_api_poller'`) — there is exactly one lease row for the whole poller subsystem, not one per replica. A network partition can transiently create two holders (bounded by `LEASE_TTL_S`); see `deploy/README.md` § Known gaps.
- **Timestamp discipline:** All lease timestamps must be computed as `now() AT TIME ZONE 'UTC'` in raw SQL, not bare `now()` — the columns are naive `timestamp(3)` written in UTC by Prisma elsewhere, and mixing clocks previously caused a 2-hour skew (`src/update/lease.mjs:46-50`).
- **No placement constraint on the poller:** because the lease — not container placement — decides who polls, `docker service scale` on the app service is safe at any replica count (`deploy/staging/compose.yaml` comment block).

## Anti-Patterns

### Storing poller state in process memory across replicas

**What happens:** An earlier design (pre-#517) would have kept `prevEvents`/`lastSeasonObserved` as in-process variables in the route module.
**Why it's wrong:** With N replicas behind a service VIP, a handover to a different replica would either miss a transition (new holder has no history) or double-send a push notification (new holder re-diffs from empty state).
**Do this instead:** Persist poller state in the same Postgres row the lease already serializes (`src/update/lease.mjs` `persistPollerState`), so a new holder inherits exactly the state the old holder left off with.

### Aggregating lagged event slots into current-season resolution

**What happens:** `get_campaign_status` returns `defend_event`/`attack_events` as "most recent event" slots that persist across season transitions until replaced.
**Why it's wrong:** Naively aggregating their `.season` field into a "what season are we in" resolver reports stale seasons for hours or days after a real transition.
**Do this instead:** `getSeasonFromStatus` excludes these lagged slots from season resolution, and `queryUpsertEvent` has an explicit `if (event.season !== season) skip` guard to keep lagged events out of the wrong season's bucket.

## Error Handling

**Strategy:** No raw try/catch — every async call site uses the `tryCatch` wrapper (`src/shared/utils/tryCatch.mjs`) returning `{ data, error }`. Fatal errors in the update pipeline (status/season fetch/validation failure) write a heartbeat error and return a 500; non-fatal warnings (partial import degradation) are logged + reported to GlitchTip but do not fail the poll.

**Patterns:**
- `errorResponse(code, start, error)` / `successResponse(code, start, data)` (`src/shared/utils/api/responses.mjs`) standardize API route responses, always including `roundedPerformanceTime(start)`.
- `reportError(error, context)` (`src/shared/utils/observability.mjs`) is the single Sentry/GlitchTip reporting call, tagged with `route`/`stage`/`level`.
- Route-level (`src/app/error.jsx`, `src/app/global-error.jsx`) and component-level (`ComponentErrorBoundary`) React error boundaries for graceful UI degradation.

## Cross-Cutting Concerns

**Logging:** `console.error`/`console.warn` at call sites plus `reportError()` to GlitchTip for anything that should be visible in production monitoring. No structured logger.
**Validation:** All external/upstream data validated with Zod schemas (`src/validators/*.mjs`) before any DB write.
**Authentication:** Internal update endpoint uses a shared-secret Bearer token (`UPDATE_KEY`, timing-safe compared); public v1 API uses per-key auth (`src/shared/utils/api/requireApiKey.mjs`, `validateApiKey.mjs`) plus rate limiting (`rateLimit.mjs`); user-facing auth (optional) is BetterAuth with Discord/GitHub OAuth (`src/auth.js`).

---

*Architecture analysis: 2026-08-28*
