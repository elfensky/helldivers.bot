# Architecture Research

**Domain:** Milestone integration — how six target features attach to an existing Next.js 16 monolith (lease-coordinated poller, normalized Postgres schema, multi-replica Swarm deploy)
**Researched:** 2026-08-28
**Confidence:** HIGH (all findings grounded directly in `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `docs/roadmap.md`, `deploy/README.md`, and source files read in this pass — no external ecosystem research needed; this is an internal-integration question, not a "what exists in the ecosystem" question)

## Standard Architecture

### System Overview — where the six features attach

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  EXISTING: Worker → Lease → Update route → h1_* tables → Read paths     │
│  (unchanged by every feature below except #1)                           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                 │ h1_status / h1_statistic / h1_event /
                                 │ h1_event_progress / h1_season
        ┌────────────────────────┴───────────────────────────────┐
        │                                                          │
        ▼                                                          ▼
┌───────────────────────────┐                        ┌─────────────────────────────┐
│ #1 SSE (spike-gated, LAST) │                        │ #3 Archive Analytics         │
│ Replaces GET /api/h1/live  │                        │ New src/db/queries/*.mjs     │
│ polling transport only —   │                        │ over EXISTING tables, no     │
│ never the lease or write   │                        │ schema/write-path change.    │
│ path. useLiveData,          │                        │ Server component fetches →   │
│ LiveToasts, sw.js,          │                        │ *ChartLoader (dynamic,       │
│ BroadcastChannel election   │                        │ ssr:false) → Recharts client │
│ all change; lease.mjs does  │                        │ component. Pattern already   │
│ not.                        │                        │ live (PlayersOverTimeChart). │
└───────────────────────────┘                        └─────────────────────────────┘

┌───────────────────────────┐   ┌──────────────────────────────────────────┐
│ #2 Loadout Builder         │   │ #4 Dependabot auto-merge                  │
│ New src/features/loadout/, │   │ CI-only: check-ci.yml jobs (`test`,       │
│ static JSON catalogs, hash │   │ `visual`) + a ruleset on `develop` + a    │
│ codec, URL-only state.      │   │ new "enable-automerge" workflow.         │
│ Touches account (#346) and  │   │ Does not touch src/ or prisma/ at all.   │
│ opengraph-image (#348) at   │   └──────────────────────────────────────────┘
│ existing seams only.        │
└───────────────────────────┘   ┌──────────────────────────────────────────┐
                                  │ #5 Staging on Pi swarm                    │
                                  │ deploy/ + .github/workflows/*.yml only.  │
                                  │ Zero src/ changes. Runbook exists; the   │
                                  │ gate is homelab hardware, not code.       │
                                  └──────────────────────────────────────────┘

                                  ┌──────────────────────────────────────────┐
                                  │ #6 Docs accuracy                          │
                                  │ src/app/docs/**/page.mdx + CLAUDE.md only.│
                                  │ Depends on #1–#5 landing (docs describe   │
                                  │ what exists, not what's planned) — do     │
                                  │ this LAST, after everything else, once.   │
                                  └──────────────────────────────────────────┘
```

**Key structural fact that shapes all six:** the existing `.planning/codebase/ARCHITECTURE.md` already separates the system into six layers (worker/scheduling, coordination/lease, update/ingestion, data access, API, presentation). Every target feature is additive to exactly one or two of those layers — none require touching the lease layer except SSE, and even SSE only reads from tables the lease-holder already writes. This is the single biggest architectural fact for sequencing: **features can be built and shipped in any order except where noted below, because they don't share mutable state with each other.**

### Component Responsibilities (new components this milestone introduces)

| Component | Responsibility | Attaches to |
|-----------|----------------|-------------|
| `useLiveEvents` (SSE replacement, if #1 ships) | Opens one `EventSource`/`ReadableStream` per tab (or per BroadcastChannel leader — see below), replaces `useLiveData`'s `setInterval` | `GET /api/h1/live` becomes `GET /api/h1/live/stream` or the same route content-negotiated |
| Postgres `LISTEN/NOTIFY` bridge (if #1 ships) | Fan-out mechanism so all replicas' SSE connections learn about a new poll without each replica polling the DB itself | New thin module, e.g. `src/update/liveNotify.mjs`, called from the same place `writeHeartbeat()` is called today |
| `src/features/loadout/data/*.json` | Static weapon/stratagem/armor catalogs, versioned IDs | Read at build/import time by the loadout page — no DB, no API route |
| `src/features/loadout/hashCodec.mjs` | Encode/decode a loadout (and later, squad) into a URL-safe hash | Pure function; consumed by the page component and any share-link/OG code |
| `src/app/loadout/opengraph-image.jsx` (or route-scoped) | Render a loadout's OG card | Mirrors existing `src/app/opengraph-image.jsx` pattern — must apply the #503 fix (buffer via `arrayBuffer()` before returning) from day one, not retrofit it |
| `src/features/account/loadoutActions.mjs` (#346) | Server actions: save/list/delete a favorited loadout for a signed-in user | Same shape as `src/features/account/actions.mjs` (`requireSession`/`requireUser` guards, `tryCatch`, Zod, `revalidatePath`) |
| `src/db/queries/get<Metric>.mjs` (Archive Analytics) | One query file per analytics metric, read-only, over `h1_status`/`h1_statistic`/`h1_event_progress` | Follows the existing one-function-per-file convention; five of these (`getCrossSeasonStats`, `getSeasonTelemetryTotals`, `getKillsTrend`, `getPlayersAvg24h`, `getCascadeLeaderboard`) **already exist** — Archive Analytics extends this list, it doesn't invent the pattern |
| `src/features/archives/<Metric>Chart.jsx` + `<Metric>ChartLoader.jsx` | Recharts client component + `next/dynamic(ssr:false)` loader | Established pattern: `PlayersOverTimeChart`/`PlayersOverTimeChartLoader`, `FactionHealthChart`/`FactionHealthChartLoader` |
| `.github/workflows/dependabot-automerge.yml` | Enables auto-merge on Dependabot PRs that match minor/patch and pass required checks | New workflow, `pull_request_target` or `workflow_run` triggered off `Check: CI` (name-matched, per the existing comment convention in `build-staging.yml`) |

## Feature-by-Feature Integration

### #1 — SSE replacing `useLiveData` polling

**Component boundary:** SSE is a **transport change for the read path only.** It must not become a second write path or a second coordination mechanism. The lease (`src/update/lease.mjs`) still decides who polls upstream; SSE only changes how the *result* of that poll reaches browser tabs.

**Multi-replica fan-out — the real design question.** Three replicas sit behind a Swarm service VIP (`deploy/staging/compose.yaml`, three app replicas, no placement constraint). An `EventSource` connection from a browser lands on *whichever* replica the VIP routes it to — not necessarily the lease holder. That replica has no in-process signal that new data landed, because the holder that just wrote `h1_status`/`h1_event` may be a different process entirely. Two viable designs, and the codebase already leans toward one:

1. **Postgres `LISTEN/NOTIFY` fan-out (recommended).** After the lease holder's `updateStatus()`/`updateSeason()` write completes (same place `after(() => checkAndNotify(...))` already runs post-response in `route.js`), it issues `NOTIFY hd1_live_update`. Every replica holds one `LISTEN` connection (a dedicated pool client, not the pooled Prisma adapter — advisory-lock-style connections don't play well with `@prisma/adapter-pg` pooling, the same reason the lease avoids `pg_advisory_lock`) and rebroadcasts to its own locally-connected SSE clients. This reuses Postgres as the coordination bus, consistent with the project's existing "coordinate through the database, not an external service" decision (`src/update/lease.mjs` comment: "Not pg_advisory_lock... Prisma pools connections").
2. **Per-replica DB polling (fallback, not recommended).** Each replica runs its own `setInterval` reading `h1_status`, decoupled from `LISTEN/NOTIFY`. Simpler, but reintroduces exactly the polling behavior SSE is meant to remove — just moved server-side, with three replicas hitting Postgres every N seconds instead of one lease holder hitting HD1's API. Only worth it if `LISTEN/NOTIFY` proves operationally fragile in the spike.

**One stream per tab vs. per BroadcastChannel leader.** `useLiveData.mjs` already names its leader-election channel `'hd1-sse-leader'` (not `'hd1-live-leader'`) — a strong signal this was already anticipated. Recommendation: **keep one SSE connection per tab**, not per leader. The leader election exists for a different concern (deduping OS-level Web Notifications, not deduping data fetches), and collapsing to one connection per leader would mean non-leader tabs have no live data source of their own and must relay through `postMessage`, adding a second state-propagation path for no bandwidth win (SSE payloads are tiny JSON, not video). Keep BroadcastChannel doing exactly what it does today: notification dedup, nothing else.

**Degradation behavior to design for (from the spike's own question list in `docs/roadmap.md` § Track F):**
- **Reverse proxy / CrowdSec idle timeouts:** production sits behind a reverse proxy + CrowdSec (per PROJECT.md constraints); staging sits behind a Cloudflare Tunnel (`deploy/README.md`). Both commonly default to 60–100s idle timeouts on proxied connections. An SSE stream with 15-20s natural update cadence usually stays under that, but a **quiet lull** (no event transitions, campaign stats unchanged) can still leave the connection idle past a poll interval if updates are only pushed on change — mitigate with a periodic heartbeat comment frame (`: ping\n\n`) sent every 15-30s regardless of data change, independent of the CrowdSec question the spike must answer empirically.
- **Backgrounded tabs:** the existing `visibilitychange` handler in `useLiveData` triggers an immediate poll on focus. An SSE-based hook needs the equivalent: on `visibilitychange` → visible, verify the `EventSource.readyState`; if `CLOSED`, reconnect rather than trust automatic reconnect (which retries but can drift far behind after a long background period on mobile Safari, which throttles background JS aggressively).
- **PWA offline:** `sw.js` explicitly runs `NetworkOnly()` for `/api/*` — SSE must not attempt to route through the service worker's cache layer at all (EventSource requests aren't interceptable the same way `fetch` is in most browsers regardless, but confirm this holds for `NetworkOnly` matcher scope during the spike). The existing localStorage fallback cache (`hd1-live-cache-v1` in `useLiveData.mjs`) should be preserved as-is; it's the correct offline degradation regardless of transport.

**Components that change:** `useLiveData.mjs` (becomes `useLiveData`/`useLiveEvents` backed by `EventSource` instead of `setInterval`+`fetch`, same public return shape `{data, mapState, status, prevData, isLeader}` so `LiveToasts` and dashboard consumers need zero changes), `src/app/api/h1/live/route.js` (either grows an SSE-negotiated variant or a sibling `src/app/api/h1/live/stream/route.js`), `src/update/lease.mjs`-adjacent (new `liveNotify.mjs` for the `NOTIFY` call, **not** a lease change), `sw.js` (confirm `NetworkOnly` doesn't need an SSE-specific matcher). `LiveToasts.jsx`, `detectChanges.mjs`, and the BroadcastChannel election logic in `useLiveData.mjs` need **no logic change** if the hook's return contract is preserved — this is the strongest argument for keeping the public hook interface stable across the rewrite.

**Build order implication:** last, as the roadmap already fixes (S21 spike → S22 implementation, gated on all other tracks). Nothing else in this milestone depends on it, and it carries the highest blast radius against a polling system that works today.

### #2 — Loadout Builder

**Component boundary: purely additive, new feature directory, no shared-state risk.** `src/features/loadout/` following the existing flat-feature-directory convention (`src/features/dashboard/`, `src/features/galaxy/`, etc. — one dir per domain, no further nesting). Catalogs belong in `src/features/loadout/data/*.json` (co-located with the feature, like `mapPaths.mjs` sits inside `src/features/galaxy/`), **not** `public/` — `public/` in this codebase is reserved for the worker thread (`public/workers/`) and static assets served verbatim; JSON that's imported by JS at build time and needs typechecking/bundling belongs under `src/`.

**Hash codec versioning:** `src/features/loadout/hashCodec.mjs` is a pure function module (mirrors the shape of `src/shared/utils/game/computeMapState.mjs` — pure derivation, unit-testable without DB/network). Per the roadmap's own design note, it must ship a version/prefix marker from day one because squad mode (#350, committed) will need a second, distinguishable format and shared URLs cannot be migrated retroactively. This module has zero coupling to the rest of the app — it's the single highest-leverage piece to get right first, exactly as the roadmap sequences it (S9 before S10-S16).

**Account sync (#346) reuse:** `src/features/account/actions.mjs` is the template to extend, not fork. Its pattern — `'use server'` directive, `requireSession()`/`requireUser()` guards from `src/shared/utils/api/authGuards.mjs`, Zod validation of `FormData`, `tryCatch` around the Prisma call, `revalidatePath('/profile', 'layout')` on mutation — is exactly what a `saveLoadout`/`listLoadouts`/`deleteLoadout` server action set should follow. This needs one new Prisma model (a `Loadout` or reuse of a generic `UserData` table keyed by `userId` + JSON blob) and one migration; it's the only part of this feature that touches `prisma/schema.prisma`. Because BetterAuth is optional (`src/auth.js` exports `null` when unconfigured), favoriting must degrade to **localStorage-only** (#345) when auth is disabled — `requireSession()` already returns a structured `{errors: {auth}}` rather than throwing, so the client action call sites can detect "auth unavailable" and fall back without a try/catch (consistent with the no-raw-try/catch convention).

**OG image reuse (#348) — must not repeat #503.** `src/app/opengraph-image.jsx` is the template, but it currently carries an unresolved bug (#503: satori/sharp rendering failures surface as unhandled 500s for edge-case map states, because `ImageResponse` construction doesn't throw synchronously — the rasterization happens while the body streams). The file already documents its own fix pattern in a comment: materialize via `await response.arrayBuffer()` inside a `tryCatch`-wrapped helper before returning, so a rasterization failure is catchable and falls back to a degraded card instead of a raw 500. **The loadout OG route must be built with that pattern from the start**, not copy the pre-#503 shape and inherit the same class of bug. Confirm whether #503's fix has landed on `develop` by the time #348 starts (check `git log -- src/app/opengraph-image.jsx`); if not, #503 is a soft blocker worth fixing first since it's a one-file, well-understood change.

**Build order:** the roadmap's own S8→S16 ladder (catalogs → hash codec → page → stats/guides/favorites/nav+OG in parallel → a11y → squad mode) is sound and matches the codebase's actual dependency graph — no changes needed. #346 (account sync) and #348 (OG) can run in parallel worktrees once S10 (the page/client component) lands, since they touch disjoint files (`account/` vs `app/loadout/opengraph-image.jsx`).

### #3 — Archive Analytics

**Read-path only — the query layer is where this feature lives.** Every metric is a new file in `src/db/queries/` following the established `get<Thing>.mjs` naming and one-function-per-file convention. Confirmed from the codebase: **five of these already exist** (`getCrossSeasonStats.mjs`, `getSeasonTelemetryTotals.mjs`, `getKillsTrend.mjs`, `getPlayersAvg24h.mjs`, `getCascadeLeaderboard.mjs`) — this milestone is extending an established pattern, not inventing one. No new tables, no new write path, no change to `src/update/*`.

**Server-component vs. client Recharts boundary — already established, reuse verbatim.** The pattern in `src/features/archives/` is: a server component (the `/archives` page or a section of it) calls the `get*` query function, passes plain serializable data as props to a `<Metric>ChartLoader.jsx` (a `'use client'` file that wraps `next/dynamic(() => import('./<Metric>Chart'), { ssr: false })`), which lazy-loads the actual Recharts-based `<Metric>Chart.jsx`. This keeps Recharts (a sizeable client bundle) out of the initial `/archives` payload and out of SSR entirely — confirmed present for `PlayersOverTimeChart` and `FactionHealthChart` already. Every new S18/S19/S20 chart should follow this exact Loader/Chart split; deviating from it (e.g., importing Recharts directly into a server-rendered component) would regress the bundle-size discipline the existing code already established.

**Caching for closed seasons.** No `unstable_cache` or Next `'use cache'` usage exists anywhere in `src/db` or `src/features` today — the only `revalidate` exports in the whole codebase are on `opengraph-image.jsx` (300s) and two docs MDX pages (3600s). This is a real gap for Archive Analytics: a closed season's `h1_status`/`h1_statistic`/`h1_event_progress` rows never change again, so re-querying them on every `/archives?season=N` visit is pure waste. Recommendation: wrap the closed-season query functions (not the live/current-season ones) in Next's `unstable_cache` keyed by `season` number, with no TTL (or a very long one) for any season below the current one — the current season's data is still mutating and must stay uncached or short-TTL. This is a **new pattern** for this codebase, so it should be introduced once, in one shared helper (e.g. `src/db/queries/withSeasonCache.mjs`), rather than ad hoc per query file, to avoid five slightly different caching implementations.

**Hide-when-empty convention — mandatory, not optional.** Per PROJECT.md's constraint and the roadmap's explicit S17 policy ("build all, hide when empty"): `h1_statistic` (telemetry) exists for only 4 of 160 seasons (157+). Every telemetry-backed component (Season Fingerprint, Peak Hour Heatmap, Player Attrition Curve, and the telemetry half of Season Report Card) must render an explicit empty state — not zeros — for seasons before 157, and that empty state needs its own pinned test. Two-season comparisons (`#269`, `#462`) must drop mismatched-coverage rows from both sides rather than rendering a half-populated table. This is already fully specified in `docs/roadmap.md` § S17 and needs no new research — just faithful implementation.

**Build order:** S17 (spec refresh against real schema) must land before any Track D code — the existing issues (#179/#180/#270) reference tables (`h1_live_snapshot`, `h1_snapshot`, `h1_event_snapshot`) that don't exist in the current schema. Within Track D, Momentum Tracker first (works on all 160 seasons, highest visibility-to-effort ratio), then the rest of Phase B, then Phase C (Storytelling — classifier thresholds need a brainstorm, not just plumbing), then Phase D (War Playback — a UI/animation problem, largely independent of the other two once queries exist). Track D and Track C (Loadout Builder) touch disjoint files and can run in parallel worktrees.

### #4 — Dependabot auto-merge

**No source-tree component — this is CI/repo-configuration only.** It attaches to `.github/workflows/check-ci.yml` (which already names its jobs `test` and `visual`, workflow name `'Check: CI'` — load-bearing per its own header comment, since `build-staging.yml` matches on that name, not the filename) and to a **new branch protection ruleset on `develop`**. Confirmed via `gh api repos/.../rulesets` that **no rulesets currently exist** on this repo — this is not "add auto-merge to an existing ruleset," it's "create the first ruleset," which is a bigger and more consequential step than the issue text implies (a ruleset on `develop` also gates every human PR/merge, not just Dependabot's).

**Reconciling with `--no-ff` + version-bump-on-merge.** The hard constraint (CLAUDE.md § Git Workflow rule #2) is that every merge to `develop` bumps `package.json` version and moves the CHANGELOG entry **in the same commit** as the merge. GitHub's native auto-merge only supports merge/squash/rebase via the API — it cannot inject a version-bump commit into the merge. Two workable designs:
1. **Exempt Dependabot PRs from the version-bump rule, explicitly and in writing** (PROJECT.md's Key Decisions table already frames this as an open option: "must respect the `--no-ff` + version-bump rule (or explicitly exempt deps PRs and record why)"). A dependency bump alone doesn't materially change the "why" a version exists for; batching several into the next feature/chore merge's version bump is defensible. This is the lower-engineering-cost path.
2. **A workflow step that, on Dependabot PR merge, immediately opens a small follow-up commit to `develop`** bumping version + CHANGELOG. More faithful to the letter of the rule, more moving parts, another workflow that can fail silently.
Recommendation: **option 1**, decided explicitly in PROJECT.md rather than inferred by an agent mid-implementation — it's a policy call, not an architecture one, but the architecture consequence is that the auto-merge workflow needs no version-bump step at all, simplifying it to: ruleset requiring `test` + `visual` checks → repo setting `allow_auto_merge: true` → a workflow (`workflow_run` triggered off `Check: CI`, filtered to `github.actor == 'dependabot[bot]'` and PR labels/update-type minor|patch) that calls `gh pr merge --auto --merge` (never `--squash`/`--rebase`, per the hard "no squash/rebase anywhere" rule — GitHub's auto-merge API respects the merge strategy passed, so this must be `--merge`, and the repo's merge button settings must have "Allow merge commits" enabled while squash/rebase merge types are disabled repo-wide to make violating this structurally impossible, not just documented).

**Build order:** independent of every other track — no shared files. Can land anytime, but logically pairs with clearing the current 7 open alerts / 5 open PRs (PROJECT.md § Active) first, so the new automation starts from a clean queue rather than auto-merging into an already-behind `develop`.

### #5 — Staging on the Pi swarm

**No source-tree component.** `deploy/README.md` documents this as **already live and largely working** (Cloudflare Tunnel, 3-Pi Swarm, Git-Sync via Arcane, CI's `bump-staging-tag` job) — the remaining gap is narrower than the milestone name suggests. Per the doc's own "Known gaps" section: (1) the migrate image is amd64-only and SIGILLs under QEMU arm64, so migrations run from an amd64 host, not the Pi swarm, until a native arm64 runner leg is added; (2) no self-hosted runner yet in the LAN, needed only for running migrations and toggling the Kuma maintenance banner — Git Sync itself no longer needs it to deploy; (3) the Kuma banner script is unverified (Socket.IO event-shape drift risk); (4) a network partition can transiently create two lease holders (accepted for staging, "fencing token" flagged as the fix if it ever matters for production).

**Build order for what remains:** self-hosted runner registration (external, homelab-gated) → verify Kuma banner script against the actual Uptime Kuma Socket.IO version in use → decide whether the arm64 migrate-image runner leg is worth building now or deferred (it's real engineering work, not a config toggle). None of this blocks any other track; it's purely gated on hardware/homelab state, exactly as PROJECT.md's Active section already states ("hardware is up and reachable — finish the deploy job").

### #6 — Docs accuracy

**No component boundary of its own — it's a lagging indicator of the other five.** `src/app/docs/**/page.mdx` (especially `architecture`, `data-flow`, `infrastructure`, `database`) and CLAUDE.md § Architecture both currently describe (per PROJECT.md's own finding) a **pre-lease** model — the codebase map already caught this drift after #517 landed the lease. Two implications for sequencing:
1. **Don't write the SSE section of the docs until #1 resolves** — if the spike says "don't do it," the docs should keep describing polling, and writing SSE docs pre-emptively creates the exact same drift this task exists to fix.
2. **The lease/multi-replica rewrite is a known, scoped gap today** (independent of the other five features) — it can and should be fixed as its own pass, then a second smaller pass folds in whatever #1–#5 actually shipped. Treat this as two docs sessions, not one: (a) fix the lease drift now, (b) fold in new-feature docs as each feature ships, rather than one big doc rewrite gated on everything.

## Suggested Build Order (cross-feature)

Given the finding that these six features share almost no mutable state or files, ordering is driven by **internal dependencies within each feature** and by **risk-front-loading**, not by cross-feature blocking:

1. **Docs fix, lease/multi-replica section only** (#6, partial) — small, self-contained, removes a known-wrong description before any new work risks compounding the drift. Can happen anytime, first is fine since it's independent.
2. **Dependabot auto-merge** (#4) — no code dependencies, unblocks steady-state dependency hygiene before a multi-week feature push, and its ruleset-creation step is worth doing early since it also governs how every subsequent PR in this milestone gets merged.
3. **Loadout Builder catalogs + hash codec** (#2, S8-S9) — front-load this because the hash format is a one-way door (shared URLs can't migrate) and everything else in the feature encodes against it. Do this before Archive Analytics' brainstorm-heavy phases so the "hard, unforgiving contract" work happens while attention is freshest.
4. **Archive Analytics spec refresh** (#3, S17) — must precede any Track D code; can run in parallel with Loadout Builder's later sessions (S10+) since they touch disjoint directories (`src/features/loadout/` vs `src/db/queries/` + `src/features/archives/`).
5. **Loadout Builder page + downstream** (S10-S16) **and** **Archive Analytics Phase B/C/D** (S18-S20) — run in parallel worktrees, exactly as the roadmap already notes ("Track C and Track D touch disjoint parts of the codebase").
6. **Staging Pi swarm** (#5) — gated on homelab hardware/runner availability, not on any of the above; slot in whenever the external gate clears.
7. **SSE spike then (conditionally) implementation** (#1) — last, by design. It's the only feature that touches the live-read component boundary shared by the dashboard, notifications, PWA, and OG image SSR path simultaneously, so it carries the highest regression risk against a system that works. Running it last also means the SSE spike's reverse-proxy/CrowdSec questions can be answered against whatever staging topology (#5) exists by then, rather than against an incomplete one.
8. **Docs accuracy, full pass** (#6, remainder) — after 1-7, so the docs describe what actually shipped rather than what was planned. If SSE's spike concludes "don't," the docs pass documents *why polling stays* — recorded findings, not silence.

## Architectural Constraints Carried Into Every Feature

- **The lease (`src/update/lease.mjs`) is the one component no feature in this milestone should touch except SSE, and even then only to add a `NOTIFY` call after an existing write, never to change claim/handover logic.**
- **`computeMapState.mjs` is a shared single-source-of-truth** consumed by the live dashboard, the public v1 API, and OG image SSR. Archive Analytics' War Playback (#270) will need a season-at-a-point-in-time variant — the existing `computeMapStateAtEvent` gating pattern (used for #469's introduction-order fix) is the template: **extend via a new caller-specific wrapper, never widen the shared `computeMapState`/`computeLiveMap` contract**, per the anti-pattern the codebase map already documents.
- **No raw try/catch, ever** — every new server action, query function, and API route in every feature uses `tryCatch` (`src/shared/utils/tryCatch.mjs`), consistent with 100% of the existing codebase.
- **Every telemetry-dependent UI element needs a pinned empty-state test** — this is not unique to Archive Analytics; any future feature reading `h1_statistic` inherits the same 4-of-160-seasons coverage constraint.
- **`--no-ff` merges + version bump in the same commit is a hard rule with exactly one proposed exception (Dependabot, and only if PROJECT.md records that decision explicitly)** — no other feature in this milestone should be built assuming a different merge shape.

## Sources

- `.planning/codebase/ARCHITECTURE.md` (2026-08-28 codebase map — primary source for all layer/component/data-flow claims)
- `.planning/codebase/STRUCTURE.md` (2026-08-28 codebase map — directory conventions, naming, "where to add new code")
- `.planning/PROJECT.md` (milestone scope, constraints, key decisions)
- `docs/roadmap.md` (session sequencing for Loadout Builder, Archive Analytics, SSE — last reconciled 2026-08-07)
- `deploy/README.md` (staging Pi swarm current state and known gaps, 2026-08-25)
- Source files read directly in this research pass: `src/shared/hooks/useLiveData.mjs`, `src/features/notifications/LiveToasts.jsx`, `src/sw.js`, `src/app/opengraph-image.jsx`, `src/features/account/actions.mjs`, `src/features/archives/PlayersOverTimeChartLoader.jsx`, `.github/workflows/check-ci.yml`, `.github/workflows/build-staging.yml`, `.github/dependabot.yml`
- `gh api repos/elfensky/helldivers.bot/rulesets` (confirmed: zero rulesets currently exist on the repo, run 2026-08-28)

---
*Architecture research for: helldivers.bot milestone — SSE, Loadout Builder, Archive Analytics, Dependabot auto-merge, staging deploy, docs accuracy*
*Researched: 2026-08-28*
