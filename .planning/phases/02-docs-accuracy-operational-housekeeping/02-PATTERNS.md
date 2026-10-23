# Phase 2: Docs Accuracy & Operational Housekeeping - Pattern Map

**Mapped:** 2026-10-23
**Files analyzed:** 27 (docs/config/comment edits; no feature code)
**Analogs found:** 27 / 27 (all tracked in git; no gitignored mirror paths used)

This phase edits prose, comments and one config ternary. "Analog" means: the correct source text to copy wording from, or the shape of a sibling edit to copy.

## File Classification

| Modified File | Role | Data Flow | Closest Analog / Source of truth | Match |
|---|---|---|---|---|
| `AGENTS.md` (§ Stack 184-206, § Frontend Layout 210-212, § Task Tracking 220) | config/doc | n/a | `deploy/README.md:27-32`, `src/update/lease.mjs:5-18` | exact (wording) |
| `src/app/api/h1/update/route.js` (`:34`, `:75-77`) | comment | request-response | same file `:27-29` (already correct) | exact |
| `src/shared/utils/initializeWorker.mjs` (`:2-6`) | comment | event-driven | `deploy/staging/compose.yaml:58-67` | exact (wording) |
| `.example.env` (`:11-13`) | config | n/a | `deploy/staging/compose.yaml:58-67` | exact (wording) |
| `public/workers/cron.js` (`:13`) | comment | event-driven | `src/instrumentation.node.js:16` (real caller) | exact |
| `next.config.mjs` (`:15`, `:212-223`) | config | build | itself, edit shape in RESEARCH § HOUSE-03 | exact |
| `src/app/docs/architecture/{page.mdx,dataFlowDefinition.mjs,dataFlowConfig.mjs}` | docs + Mermaid | render | itself; add lease node following existing node/flows/details | exact |
| `src/app/docs/data-flow/page.mdx` | docs (text fences) | n/a | `deploy/README.md:27-32` for lease subsection | role-match |
| `src/app/docs/infrastructure/page.mdx` | docs | n/a | env table at `:400-407`; workflow table in RESEARCH § E | exact |
| `src/app/docs/database/page.mdx` | docs (ER fence) | n/a | `prisma/schema.prisma:237-266` | exact |
| `src/app/docs/testing/page.mdx` | docs | n/a | `CLAUDE.md` § Test Layout (link target) | exact |
| `src/app/docs/notifications/{page.mdx,notificationFlowConfig.mjs,pushFlowConfig.mjs}` | docs + Mermaid detail text | n/a | `route.js:189,196` (prevEvents from lease) | exact |
| `src/app/docs/page.mdx`, `src/app/docs/overviewConfig.mjs` | docs | n/a | `route.js:212` (`GET`, `POST = methodNotAllowed`) | exact |
| `docs/roadmap.md` | doc (pointer) | n/a | none needed; ~5 lines | n/a |
| `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS,CONCERNS}.md` | map | n/a | code facts in RESEARCH § A/B | exact |
| `.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md` | planning doc | n/a | ARCH-10 line/row, Phase 11 block | exact |
| `CHANGELOG.md`, `package.json`, `package-lock.json` | release | n/a | commit `1d2298f9` (0.95.6) | exact |

## Pattern Assignments

### Lease wording (AGENTS.md, initializeWorker.mjs, .example.env, route.js, data-flow, infrastructure, notifications)

**Source 1:** `deploy/README.md:27-32`
```
- Every replica runs the cron thread, but only the lease holder polls (`src/update/lease.mjs`,
  #517): `worker_heartbeat.holder_id` names it, `lease_until` is renewed every poll (60 s TTL), and
  the others answer `200 { role: 'standby' }`. ...
  Kill the holder's task and the row moves to another replica within ~1 min, carrying
  `prev_events` / `last_season_observed` with it.
```
**Source 2:** `deploy/staging/compose.yaml:58-67`
```
# One service, N replicas, exactly one poller: every replica runs the cron
# thread, but each poll must claim the lease row in worker_heartbeat first
# (src/update/lease.mjs, #517). Postgres serialises the claim, so one instance
# does the work and the rest answer "standby". A dead holder is replaced
# within the 60 s TTL with no election. The poller's state lives in the same
# row, so a handover neither misses nor duplicates a transition.
# Because of that, no placement constraint and no separate worker service:
# `docker service scale` is safe at any N.
```
**Source 3:** `src/update/lease.mjs:5-18` (JSDoc block: claim row, failover bounded by `LEASE_TTL_S`, state in same row, "Not pg_advisory_lock").
**Facts:** `LEASE_TTL_S = 60`, `WORKER_TYPE = 'cron_api_poller'`. Keep the 403 for `!isWorkerEnabled()` at `route.js:78-79`; fix only the comment. `route.js:27-29` already says state lives in the lease row, so copy that sentence into `:75-77`.

Rules: do not copy private IPs, DB host or secret names from `deploy/README.md:22` into public `/docs`. Staging = 2 replicas (D-05). Production = one container (D-04). Do not state a production `UPDATE_INTERVAL`; cite `.example.env:10` (`"20"`).

### `next.config.mjs` (config, build)

**Current block** (`:212-223`):
```js
export default process.env.SENTRY_AUTH_TOKEN ?
    withSentryConfig(finalConfig, {
        // No `silent: true`. It suppresses console.error ... See #496.
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        sentryUrl: process.env.SENTRY_URL,
    })
:   finalConfig;
```
**Edit:** delete line 15 `productionBrowserSourceMaps: true,`; add before the closing `})`:
```js
        sourcemaps: { deleteSourcemapsAfterUpload: true },
```
Prettier: 4 spaces, `experimentalTernaries` (keep the `:   finalConfig;` form). Keep the `silent` comment. A token-less build proves nothing; verify on `Build: Staging` image (D-15).

### Mermaid diagram + config (architecture; detail text on notifications and overview)

**Analog:** `src/app/docs/architecture/dataFlowDefinition.mjs` (node IDs use underscores; `buildMermaidDefinition` from `@/app/docs/_diagram.mjs`):
```js
subgraph Processing["PROCESSING"]
    worker["Worker Thread<br/><small>cron.js — setTimeout loop<br/>poll > validate > bucket-upsert</small>"]
...
api_status -->|"~15s"| worker          // replace "~15s" with UPDATE_INTERVAL wording
classDef processing fill:#1c1b1b,stroke:#a855f7,color:#c084fc
```
Config entry shape (`dataFlowConfig.mjs:125-135`): `worker: { title, subtitle, sections: [{ type: 'text', content }, { type: 'tags', ... }] }`. A new node (lease/standby) needs its ID added to `flows` and `details` in the config; renaming an ID silently loses panel and highlight (`MermaidDiagram.jsx:13-20`). Fix `flows.snapshot`: drop `h1_statistic` and `h1_event_progress`. Page usage: `architecture/page.mdx:19-24` (`<MermaidDiagram id definition mobileDefinition config />`). Text-only `mermaid` fences elsewhere are not rendered; check them with `mermaid.parse` (RESEARCH § Code Examples 4). Fix `database/page.mdx:170` `PK-FK` → `PK, FK`.

### `src/app/docs/infrastructure/page.mdx` env table

**Analog:** same file `:400-407`, row shape:
```
| Variable          | Required | Category | Description |
| `UPDATE_INTERVAL` | **Yes**  | Updates  | Polling interval in seconds (e.g., `"20"`); passed to the worker thread |
```
Add rows `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`, `FORCE_SEED`, `*_FILE` note; remove `POSTGRES_SSL`, `SKIP_MIGRATIONS` (`:433-434`). Keep column alignment (Prettier-free MDX, but match widths). Workflow list: the 10-file table in RESEARCH § E is the source.

### `docs/roadmap.md` (pointer, ~5 lines)

Contents: one title, one sentence ("Execution order lives in `.planning/ROADMAP.md`"), link to it, and a commit permalink to the last full version (bb01517d). Repoint `AGENTS.md:220`, `.planning/PROJECT.md:49,51,65,93`. Leave `REQUIREMENTS.md:37`, `ROADMAP.md:96`, CHANGELOG entries untouched.

### ARCH-11 (REQUIREMENTS.md and ROADMAP.md)

**Requirement line analog** (`.planning/REQUIREMENTS.md:86`):
```
- [ ] **ARCH-10**: Closed-season aggregates are cached (not recomputed per request); ...
```
Add after it: `- [ ] **ARCH-11**: #469 — Archives map hides factions until their introduction point`.
**Traceability row** (`:216`): `| ARCH-10 | Phase 12 | Pending |` → add `| ARCH-11 | Phase 11 | Pending |`.
**Coverage footer** (`:242-243`): `v1 requirements: 79 total` / `Mapped to phases: 79` → 80 / 80.
**ROADMAP.md Phase 11** (`:229-235`): change `**Requirements**: ARCH-02, ARCH-03, ARCH-04, ARCH-05` to add `, ARCH-11`; add success criterion line 5 in the existing form:
```
  4. A player can scrub a season's timeline with the map evolving and control play/pause/speed (ARCH-05)
  5. <archives map hides factions before their introduction point> (ARCH-11)
```
Also update the Phase 11 summary at `:26` if it lists requirements, and any ROADMAP coverage count.

### Release bump (CHANGELOG.md, package.json, package-lock.json)

**Analog:** commit `1d2298f9 chore(release): 0.95.6` touches `CHANGELOG.md` (+2), `package.json`, `package-lock.json` (version lines). CHANGELOG shape:
```
## Unreleased

## 0.95.8

### Changed

- <entry>
```
Entries sit under `## Unreleased` while working; the last commit inserts `## X.Y.Z` directly under `## Unreleased`. Sections used: `### Changed`, `### Fixed`. Wrap lines at about 75 columns. Next number after 0.95.7 is 0.95.8 (patch). Two PRs (A and B) merge sequentially: the second takes the next patch.

### Test layout rule (testing page, D-11)

Replace the tree/table with a short paragraph linking to AGENTS.md § Test Layout (`CLAUDE.md` symlinks `AGENTS.md`):
> a test at `unit/<dir>/<Base>[.<qualifier>].test.*` must have a source file at `<root>/<dir>/<Base>.*` or `<root>/<dir>/<Base>/<Base>.*`

### Codebase maps (`.planning/codebase/*.md`)

Facts to write: `updateStatus` writes `h1_season`, `h1_event`, `h1_status`, `h1_statistic`, `h1_event_progress` (`src/update/status.mjs:8-12,101,118`); `updateSeason` writes `h1_season`, `h1_event`, `h1_status` only (`src/update/season.mjs:10-12`); 403 stays but reason is "worker disabled on this instance" (`route.js:78-79`); no dedicated worker service; production = one container. Resolve `CONCERNS.md:35-39` (module-level state concern) and update `:50-53` (#502). `.claude/CLAUDE.md` is gitignored and generated: regenerate in the main checkout after merge, never hand-edit.

## Shared Patterns

- **Verify chain:** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` (needs `npx prisma generate` first; stub env in RESEARCH § Standard Stack). `npm run lint` does not cover `.mdx`; `next build` is the only MDX gate.
- **Browser check:** render `/docs`, `/docs/architecture`, `/docs/notifications` (3 diagrams) in a lane server on :3100; fail on `[MermaidDiagram] render failed:` in the console.
- **Error handling:** no code paths change. If any comment edit touches code, keep `tryCatch` usage as is.
- **Version bump:** last commit of every PR into develop; `.planning/`-only PRs carry none.

## No Analog Found

| File | Reason |
|---|---|
| `docs/roadmap.md` pointer | Nothing similar exists; write 5 lines |
| GitHub issue texts (D-17 gaps, WR-07, WR-08) | Not repo files; RESEARCH § HOUSE-04 lists the content |

## Metadata

**Analog search scope:** `deploy/`, `src/update/`, `src/app/docs/`, `next.config.mjs`, `.planning/`, `CHANGELOG.md`, commit `1d2298f9`
**Tracked-source gate:** `git ls-files` confirmed `deploy/README.md`, `deploy/staging/compose.yaml`, `src/update/lease.mjs`, `next.config.mjs`, `AGENTS.md` are tracked.
**Not checked:** line numbers inside `02-RESEARCH.md` lines 422-699 (Code Examples, open questions) were not read; all other excerpts were read from the lane files this session.
