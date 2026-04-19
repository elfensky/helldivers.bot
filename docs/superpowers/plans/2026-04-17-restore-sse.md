# Plan & Spec: Restore SSE to Replace Polling (Approach 1)

**Status:** Draft, not for immediate implementation. Captures full design intent for a future session.
**Branch:** `feature/restore-sse` (to create) → PR to `develop` when implemented.
**Versioning:** Minor bump on merge (new feature per `CLAUDE.md` rules).

---

## Context

The app currently polls `GET /api/h1/live` every 10 seconds from `src/shared/hooks/useLiveData.mjs` to keep the live dashboard fresh. Polling replaced an earlier SSE implementation that was deleted in PR #252 (commit `0ae07c95`, 2026-04-07) after a crash class was attributed to the combination of `@sentry/nextjs`'s `onRouterTransitionStart` + `<Link>` client navigation + active `EventSource` delivering `setState` during RSC Flight stream processing. The symptom was `chunk.reason.enqueueModel is not a function`.

Polling solved the symptom but inverted the architecture: every interval fetch blurs the distinction between "load the site" and "get me a data update." The user prefers the cleaner model where page load is a one-shot `GET` and subsequent updates are pushed — so the transport matches the semantics.

Since the removal, three things changed that make a re-attempt viable:
1. **Sentry was removed, then re-added** (`@sentry/nextjs@^10.47.0`) — now runtime-active via `src/instrumentation-client.js` including `Sentry.captureRouterTransitionStart`. The SSE + Sentry combination has never been retested.
2. **Next.js 16.2.3** with `next build` still defaulting to Webpack (the Turbopack-dev-only part of the original bug class no longer applies to production).
3. **Current polling already defers `emit()`** through `requestIdleCallback` (commit `a63b5efe`) — the same deferral mitigates the broader "setState during Flight" crash class for SSE too.

The restoration plan is a **clean-cut single PR**: delete the polling branch, restore the SSE infrastructure from git history with minor modernization, and add the one automated test (Playwright click-storm) that proves the risk triad is safe before merging.

The full SSE code exists verbatim at `git show 0ae07c95^:<path>` — see "Critical files" below.

---

## Scope

**In scope:**
- Restore server-side SSE infrastructure (`sseManager`, `/api/h1/stream` route).
- Replace `setInterval`+`fetch` in `useLiveData` with `EventSource`.
- Wire worker's DB-write route to issue a `NOTIFY` after each bucket upsert.
- Add `pg` as a **direct** dependency (currently only transitive via `@prisma/adapter-pg`).
- Add Playwright for one click-storm test covering Sentry + `<Link>` + SSE.
- Modernize the restored code (env-configurable limits, better logging) — kept minimal.

**Out of scope (explicitly):**
- Staged rollout / env-flag kill-switches / dual-mode hook. Chose clean cut.
- Typed SSE events (`event: campaign_update` vs `event: event_started`). Keep full payload.
- `Last-Event-ID` replay buffer. The cached-payload-on-subscribe semantics already cover the reconnect gap for a snapshot-shaped data model.
- Sharing a `pg.Pool` between Prisma and LISTEN. LISTEN must own its connection; sharing gains nothing.
- Web Push changes. Server-side `checkAndNotify()` path stays unchanged.
- Changes to `LiveDataProvider`, `LiveDataContext`, `LiveToasts`, `detectChanges`, service worker. All public interfaces preserved.

---

## Design

### Signal separation (the architectural goal)

| Purpose | Endpoint | Transport | Lifetime |
|---|---|---|---|
| Initial load (SSR, hydration, offline fallback) | `GET /api/h1/live` | one-shot JSON fetch | request |
| Subsequent updates | `GET /api/h1/stream` | `text/event-stream` | connection |
| Worker DB write trigger | (internal) `NOTIFY campaign_update` | Postgres pub/sub | fire-and-forget |

`useLiveData` connects the `EventSource` on mount; `onopen` triggers one `fetch('/api/h1/live')` to seed the store; subsequent `onmessage` events deliver full `{data, mapState}` payloads pushed from the server when a NOTIFY fires.

### Data flow

```
worker thread (public/workers/cron.js)
        │ every ~15s
        ▼
POST /api/h1/update
        │  1. updateStatus()       → h1_status upsert
        │  2. updateSeason()       → h1_season + h1_statistic + h1_event_progress upsert
        │  3. db.$executeRawUnsafe('NOTIFY campaign_update')
        │  4. checkAndNotify()     [fire-and-forget Web Push]
        │  5. writeHeartbeat()
        ▼
   Postgres NOTIFY
        │
        ▼  (pg.Client LISTEN, held by sseManager)
   sseManager._onNotification()
        │
        │  (dedup within DEDUP_WINDOW_MS)
        ▼
   sseManager._fetchAndCache()     → getCampaign() + computeMapState()
        │  caches payload with event id
        ▼
   sseManager._broadcast()         → controller.enqueue() to every SSE client
        │
        ▼
   browser EventSource.onmessage
        │  (requestIdleCallback-deferred)
        ▼
   setState → React render → LiveToasts → Sonner + Web Notification (leader only)
```

### Why `db.$executeRawUnsafe('NOTIFY campaign_update')` (not a dedicated `notifyClient.mjs`)

**Choice:** NOTIFY routes through the Prisma pool. No dedicated `pg.Client` for the write side.

**Tradeoffs:**

| Dimension | `$executeRawUnsafe` (chosen) | Dedicated `notifyClient.mjs` |
|---|---|---|
| Files | 0 new | 1 new (37 LOC) |
| Long-lived connections | 0 extra (pool-borrowed per call) | +1 permanent per Node instance |
| Latency overhead | ~1-3ms (pool acquire + Prisma query engine) | <1ms (dedicated client) |
| Transaction safety | NOTIFY fires when pooled connection commits (fine — no outer transaction in `/api/h1/update`) | Identical |
| Pool contention | Takes one connection for ~1ms per worker cycle; negligible at 1 cycle / 15s | None (dedicated) |
| Failure mode if DB pool saturated | NOTIFY waits for an available connection | NOTIFY always succeeds if client healthy |
| Error observability | Prisma-wrapped error message | Direct `pg` error message |
| SQL-injection surface | None — channel name is a literal, no parameters | None |

**Verdict:** The dedicated-client win matters only at NOTIFY rates that saturate the Prisma pool. This app fires one NOTIFY per ~15s worker cycle. The extra long-lived pg connection is not worth its own file and lifecycle code.

**One subtle thing to remember when implementing:** Postgres `NOTIFY` delivers only after the enclosing transaction commits. The worker route does each DB mutation as its own transaction (via `db.h1_*.upsert(...)`), so there is no open transaction when the NOTIFY runs at the tail. Stay off `db.$transaction([...])` wrapping the NOTIFY.

### Client hook rewrite (`src/shared/hooks/useLiveData.mjs`)

Full rewrite of `connect()`/`disconnect()`/`poll()` — everything else (store shape, listener Set, leader election, localStorage cache, status tri-state, hook return shape) is preserved exactly.

- Replace `setInterval` + `fetch` + `visibilitychange` handler with:
  - `new EventSource('/api/h1/stream')` singleton held in module scope
  - `onopen` → fires `fetch('/api/h1/live')` once to seed initial state, sets `status: 'live'`, `emit()` (through existing `requestIdleCallback` wrapper)
  - `onmessage` → `JSON.parse(event.data)`, update store, `emit()` through deferred emit
  - `onerror` → if `es.readyState === EventSource.CLOSED`, set `status: 'offline'`, `emit()`. Browser's EventSource auto-reconnects with 3s default backoff on transient failures — don't interfere.
- Drop `POLL_INTERVAL` constant and `visibilityHandler` (browser handles reconnection).
- Rename BroadcastChannel name stays `'hd1-sse-leader'` — it's already the historical name and was never renamed during the polling era.
- The deferred `emit()` (`requestIdleCallback` + coalescing) stays. Also apply it to the `onopen` status transition (it fires exactly once per navigation, which is exactly when `<Link>` clicks collide).

### Server-side SSE manager

Restore `src/shared/utils/sse/sseManager.mjs` verbatim from `git show 0ae07c95^:src/shared/utils/sse/sseManager.mjs` (227 LOC), with these minor modernizations:

- **Env-configurable limits:** `MAX_CONNECTIONS` → `SSE_MAX_CONNECTIONS` (default 500), `MAX_PER_IP` → `SSE_MAX_PER_IP` (default 5). Heartbeat, dedup, reconnect backoff stay hardcoded.
- **Observability:** On reconnect and on SIGTERM, log `clientCount`. Optional: `setInterval(() => console.log(...), 60_000)` to log client count every minute.
- **No other semantic changes.** LISTEN on `campaign_update`, dedup window 1s, heartbeat 15s, exponential reconnect 1s→30s, 500 max global / 5 per IP, SIGTERM shutdown, bigint JSON replacer.

### Server-side SSE route

Restore `src/app/api/h1/stream/route.js` verbatim from `git show 0ae07c95^:src/app/api/h1/stream/route.js` (64 LOC). Headers stay: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-store`, `Connection: keep-alive`, `X-Accel-Buffering: no`. 503 on unhealthy manager. 405 on non-GET via `methodNotAllowed`. Umami `api-sse-connect` tracking via `after()`.

### Sentry risk mitigation (the risk triad)

Three layers of defense:

1. **Keep the `requestIdleCallback`-deferred `emit()`** in `useLiveData` for the SSE path. This is the fix that made polling stable; do not drop it because "SSE now." Also defer the `onopen` status transition.
2. **Keep `<Link prefetch={false}>`** wherever it's currently set (e.g., `src/shared/components/Navigation/HeaderNav.jsx`). This was a deliberate mitigation from the original SSE era. Note the reason in a code comment so it isn't removed as an "optimization" later.
3. **Playwright click-storm test** that reproduces the crash scenario automatically — see "Tests" section below. This is the new guardrail.

### Pre-merge verification

Before merging the PR, run `../../edu/nextjs-enqueue-model-repro` against:
- `next@16.2.3`
- `react@19.2.4`
- `@sentry/nextjs@10.47.0`

If the upstream `vercel/next.js#92362` is fixed: great signal but don't remove the deferral yet (one release cycle of stability first).
If still broken upstream: the deferral is load-bearing; the Playwright test must pass.

---

## Critical files

### To create

| Path | Purpose | Source |
|---|---|---|
| `src/shared/utils/sse/sseManager.mjs` | pg LISTEN singleton + broadcast | Restore from `git show 0ae07c95^:src/shared/utils/sse/sseManager.mjs`, apply env-var tweaks |
| `src/app/api/h1/stream/route.js` | SSE HTTP endpoint | Restore from `git show 0ae07c95^:src/app/api/h1/stream/route.js` |
| `src/__tests__/unit/shared/utils/sse/sseManager.test.mjs` | Manager unit tests | New (see Tests) |
| `src/__tests__/unit/app/api/h1/stream.test.mjs` | Route tests | New (see Tests) |
| `e2e/sse-navigation.spec.ts` | Playwright click-storm | New (see Tests) |
| `playwright.config.ts` | Playwright runner config | New |

### To modify

| Path | Change | Why |
|---|---|---|
| `src/shared/hooks/useLiveData.mjs` | Replace `setInterval`+`fetch` with `EventSource`; keep everything else (store, leader, cache, tri-state, deferred `emit()`) | Transport swap; ~80 net LOC changed |
| `src/app/api/h1/update/route.js` | Add `await db.$executeRawUnsafe('NOTIFY campaign_update')` after both `updateStatus` + `updateSeason` succeed and before `checkAndNotify()` | Trigger SSE broadcast |
| `package.json` | Add `pg` as a direct dep (currently transitive) + add Playwright devDeps (`@playwright/test`); add `test:e2e:browser` script | Avoid transitive breakage; Playwright runner |
| `.example.env` | Add `SSE_MAX_CONNECTIONS`, `SSE_MAX_PER_IP` with defaults and commentary | Make limits ops-tunable |
| `src/app/docs/api/EndpointCard.jsx` | Restore `SseDescription()` function (reverts commit that dropped it) | Re-document the endpoint in API docs |
| `src/__tests__/unit/app/docs/api/EndpointCard.test.jsx` | Restore SSE test case | Companion to docs restore |
| `CLAUDE.md` | Replace "Live polling: `useLiveData` hook ... polls `GET /api/h1/live` every 10 seconds" with SSE-based description | Keep architecture notes accurate |
| `CHANGELOG.md` | Add entry under `## Unreleased` | Release note |
| `src/shared/components/Navigation/HeaderNav.jsx` (and any other `<Link>` consumers) | Verify `prefetch={false}` is still set; add code comment explaining it's intentional | Preserve historical mitigation |

### To reuse (no changes)

| Path | Used for |
|---|---|
| `src/db/queries/getCampaign.mjs` | `sseManager._fetchAndCache()` calls this |
| `src/shared/utils/game/computeMapState.mjs` | `sseManager._fetchAndCache()` calls this |
| `src/shared/enums/events.mjs` | `EVENT_STATUS.ACTIVE` filter in `_fetchAndCache()` |
| `src/shared/utils/tryCatch.mjs` | Error wrapping throughout |
| `src/shared/utils/api/methodNotAllowed.mjs` | 405 handlers for `/api/h1/stream` non-GET |
| `src/shared/utils/umami.mjs` (`umamiTrackEvent`) | `api-sse-connect` tracking in stream route |
| `src/shared/providers/LiveDataProvider.jsx` | Consumes new hook unchanged |
| `src/shared/providers/LiveDataContext.mjs` | Public interface preserved |
| `src/features/notifications/LiveToasts.jsx` | Consumes `prevData`/`data`/`isLeader` unchanged |
| `src/shared/utils/game/detectChanges.mjs` | Pure function; used by both client toasts and server push |
| `src/update/pushNotifier.mjs` | Server-side Web Push stays unchanged |
| `src/app/api/h1/live/route.js` | Becomes the initial-snapshot endpoint; no code changes |
| `src/app/api/notifications/subscribe/route.js` | Web Push subscription management unchanged |
| `src/sw.js` | Service worker push handlers unchanged |
| `src/db/db.js` | Prisma client singleton unchanged |

### To delete

None. The polling code path is rewritten in place inside `useLiveData.mjs`; there are no orphan files from the polling era.

---

## Environment variables

Add to `.example.env` under a new "SSE" section:

```
# Server-Sent Events (live updates)
# Max concurrent SSE connections per Node instance. Default 500.
SSE_MAX_CONNECTIONS=500
# Max concurrent SSE connections per client IP. Default 5.
SSE_MAX_PER_IP=5
```

Both optional. Existing `POSTGRES_URL`, `POSTGRES_SSL`, `UPDATE_KEY`, `UPDATE_INTERVAL` remain required. No new required env vars.

---

## Tests

### Unit — `src/__tests__/unit/shared/utils/sse/sseManager.test.mjs` (new)

Mock `pg`. Cover:
- Subscribe/unsubscribe increments/decrements `clientCount`.
- `SSE_MAX_CONNECTIONS` cap rejects cleanly (returns `false`).
- `SSE_MAX_PER_IP` cap rejects cleanly per IP, allows other IPs.
- `_onNotification()` within `DEDUP_WINDOW_MS` is a no-op on the second call; outside the window re-fetches.
- `_fetchAndCache()` on DB error leaves `cachedPayload` unchanged (graceful degradation).
- Heartbeat `:keepalive` reaches all subscribed controllers.
- Reconnect scheduling with exponential backoff (mock timers; verify 1000, 2000, 4000, ..., 30000 cap).
- SIGTERM triggers graceful shutdown (controllers closed, LISTEN client ended).
- Bigint in campaign data is serialized as a `Number` in the payload.

### Route — `src/__tests__/unit/app/api/h1/stream.test.mjs` (new)

Mock `sseManager`. Cover:
- GET returns 503 when `sseManager.healthy === false`.
- GET returns 200 with correct SSE headers and a `ReadableStream` body.
- Non-GET methods return 405.
- Stream `start()` calls `subscribe(controller, ip)`; `cancel()` calls `unsubscribe`.
- IP extraction prefers `x-forwarded-for` first segment, falls back to `x-real-ip`, then `'unknown'`.

### E2E — `e2e/sse-navigation.spec.ts` (new, Playwright)

Purpose: regression guard for the Sentry + `<Link>` + SSE crash class. **The one test worth adding for this feature.**

- Visit `/`. Wait for `EventSource` network request to `/api/h1/stream`.
- Click through `/archives` → `/docs` → `/` → `/archives` in a 20-iteration loop with 100ms delays.
- `page.on('pageerror', ...)` — assert no errors captured.
- `page.on('console', msg => ...)` — assert no `console.error` matching `/enqueueModel/` or `/resolveModelChunk/`.
- Run the full loop twice:
  - First run: `NEXT_PUBLIC_SENTRY_DSN=''` (baseline, Sentry disabled).
  - Second run: Sentry enabled. Both must pass.
- Add `playwright.config.ts` that spins up the dev server (`npm run dev`) and waits for readiness.
- Add `npm run test:e2e:browser` script; do **not** replace the existing `test:e2e` (which is the Vitest smoke suite) — use a distinct name.

### Existing tests to preserve / extend

- `src/__tests__/unit/app/api/h1/live.test.mjs` — no changes (`/api/h1/live` semantics preserved).
- `src/__tests__/unit/update/pushNotifier.test.mjs` — no changes.
- `src/__tests__/unit/shared/utils/game/detectChanges.test.mjs` — no changes.
- `src/__tests__/unit/routes/update.test.mjs` — extend to verify `NOTIFY` is issued after successful `updateSeason()` and not before.
- `src/__tests__/smoke/smoke.test.mjs` — add a page load that checks `EventSource` connects within 20s (optional; Playwright covers this more thoroughly).

---

## Verification (pre-merge, in addition to CI)

1. `npm run test:unit` — passes.
2. `npm run build` — passes.
3. `npm run test:e2e` — passes (existing Vitest smoke).
4. `npm run test:e2e:browser` — passes (new Playwright, both Sentry-off and Sentry-on runs).
5. **Local manual**: start dev server, open `http://localhost:3000` in DevTools → Network. Confirm `/api/h1/live` fires once, `/api/h1/stream` opens and stays open, `:keepalive` pings arrive every ~15s. Open a `psql` session and run `NOTIFY campaign_update;` — confirm a payload arrives in DevTools within ~1s and the dashboard updates.
6. **Upstream repro check**: run `../../edu/nextjs-enqueue-model-repro` against current dep versions. Document outcome in the PR body.
7. **Observability sanity**: after soft deploy (staging), confirm `sseManager.clientCount` log line is visible and roughly matches expected tab count. Check Sentry for any new `enqueueModel` or `resolveModelChunk` errors.

---

## Rollback plan

Because we chose a clean cut (no dual-mode hook, no env kill-switch), rollback is **full revert of the feature branch's merge commit** — `git revert -m 1 <merge-sha>` on `develop`, push, tag a patch release, redeploy.

This is acceptable given:
- The Playwright click-storm test catches the primary risk class.
- The pre-merge upstream repro check reduces the chance of discovering the bug in prod.
- The merge is a single, clean revert point (no interleaved work) because we're shipping as one PR.

**If a rollback is required under pressure:**
1. Revert merge on `develop` (patch bump, deploy).
2. File a follow-up issue with symptoms, logs, reproduction path.
3. Before retrying: re-run Playwright with the exact failing browser/OS combo; consider gating Sentry's `captureRouterTransitionStart` (see Follow-ups below).

---

## Known gotchas & follow-ups

1. **`pg` as transitive dependency** — currently pulled in only via `@prisma/adapter-pg`. Add it to `package.json` directly in this PR so a future Prisma driver swap can't silently break LISTEN/NOTIFY.
2. **Connection budget per Node instance** — after this change: Prisma pool (~10) + 1 LISTEN client + 0 NOTIFY clients (chose `$executeRawUnsafe`) = ~11 connections. Under 10 horizontally-scaled instances: ~110. Check your Postgres `max_connections`. If deploying behind a pooler (PgBouncer transaction mode, Neon/Supabase), **the LISTEN connection must go direct** (session-mode) — poolers close LISTEN under transaction mode. Document in `.example.env` if relevant.
3. **Module singleton breaks with horizontal scale** — `sseManager` is per Node process. Two instances behind a load balancer → two independent `SSE_MAX_CONNECTIONS` pools, two LISTEN connections, independent dedup (fine because the worker is the sole NOTIFY producer). The only visible asymmetry is the per-IP cap: a user with tabs pinned to different instances effectively gets `2 × SSE_MAX_PER_IP` slots. Acceptable; flag it in the PR body.
4. **HTTP/2 per-origin slot** — SSE holds one connection slot. Irrelevant over HTTP/2 (~100 per origin); over HTTP/1.1 it's one of 6. Production is likely HTTP/2 via your reverse proxy; verify once.
5. **Proxy buffering** — `X-Accel-Buffering: no` handles nginx. If the app is ever fronted by Cloudflare with aggressive response buffering, SSE needs Transform Rules or a `Cache-Control: no-transform` hint. Verify on first staging deploy.
6. **Sentry `captureRouterTransitionStart` is the residual risk vector.** If the Playwright test detects a regression in a future Sentry upgrade, the fix is *not* more deferral; it's either updating Sentry or gating that single export. Keep the option open in `src/instrumentation-client.js`:
   ```js
   export const onRouterTransitionStart =
     process.env.NEXT_PUBLIC_SENTRY_ROUTER_TRANSITION === 'false'
       ? undefined
       : Sentry.captureRouterTransitionStart;
   ```
   Not adding this in the initial PR (would be dead code). Add it if the regression shows up.
7. **Dedup window at worker cadence** — `updateStatus()` and `updateSeason()` both land in one `/api/h1/update` call; a single NOTIFY fires at the tail, not two. If the route is ever refactored to NOTIFY after each stage, raise `DEDUP_WINDOW_MS` from 1000 to 2000 to absorb the back-to-back fires.
8. **Delete superseded docs** — the repo previously had `docs/superpowers/plans/2026-04-07-sse-to-polling.md` and `docs/superpowers/specs/2026-04-07-sse-to-polling-design.md`. They were removed in `5068c567`. Nothing to do now, but if someone resurrects them from git history thinking they're current, direct them here.

---

## GitHub issue to create

Per `CLAUDE.md`, create a GitHub issue before starting:

- Title: `Restore SSE to replace polling for live data updates`
- Milestone: most appropriate open phase (likely Phase 10 or 11 depending on what's current)
- Labels: `enhancement`, `frontend`, `infrastructure`
- Body: link to this plan, summarize the "clean-cut single PR" approach, call out the Playwright click-storm test as the new regression guard, and the `$executeRawUnsafe` NOTIFY decision.
- Add to project board #5, set to `Backlog`, size `M`, priority `P2` (no user-visible bug, pure architectural improvement).

---

## Summary for a future executor

- One branch, one PR to `develop`. Minor version bump on merge.
- Restore two server files verbatim; rewrite the hook's transport (keep everything else).
- Replace dedicated NOTIFY client with `db.$executeRawUnsafe('NOTIFY campaign_update')`.
- Add `pg` as a direct dep.
- Add Playwright + one click-storm test. Run twice (Sentry off / on). Both must pass.
- Run the upstream `enqueueModel` repro against current dep versions before merging.
- Rollback = revert merge commit.

Everything needed to implement is captured here. Before executing, re-read this plan top to bottom in the new session and verify the paths and commit SHAs haven't drifted (`0ae07c95` for the deletion commit is stable).
