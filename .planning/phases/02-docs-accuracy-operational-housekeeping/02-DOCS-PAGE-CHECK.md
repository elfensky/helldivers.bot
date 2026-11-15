# Phase 2 — Docs page-by-page check

Every plan of this phase that edits documentation appends one section to this file. A section has four parts. First, one row per Drift Inventory item (`02-DISCUSSION-LOG.md` § Drift Inventory) that the plan re-verified against the code, plus any extra drift found: the line, the stale statement, the fix, and the code evidence as a repo-relative `path:line`. Second, a line `Lane commit: <40-hex output of git -C <lane> rev-parse HEAD>`, written after the lane commit that the section describes. Third, a closing line `<Section>: CHECKED`. The read itself is manual: the record binds the read to the lane commit, and phase verification re-reads the pages at the release tag (plan 02-11).

## AGENTS.md and code comments

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| AGENTS.md § Architecture invariants, "Exactly one poller across replicas" | No statement of the lease TTL, the standby answer, the opt-out or the replica count | Added: every replica spawns the cron thread; each poll claims the lease (60 s, `LEASE_TTL_S`); a non-holder answers `200 {role:'standby'}`; `WORKER_ENABLED=false` is an optional opt-out; both stacks run 2 app replicas | `src/update/lease.mjs:20`, `src/app/api/h1/update/route.js:93`, `src/instrumentation.node.js:22`, `deploy/production/compose.yaml:118`, `deploy/staging/compose.yaml:114` |
| AGENTS.md § Branches, merge line (D-27) | `gh pr merge --rebase` with gh's own branch-delete flag removes a lane worktree that has the branch checked out | Merge with `gh pr merge <n> --rebase`, then `git push origin --delete <branch>` once `gh pr view <n> --json state` reports `MERGED`; a release PR never deletes `develop` | handbook `git-and-prs.md` § Merging (outside this repo); the new text is at `AGENTS.md:44-48` |
| `route.js` throttle comment | "The worker polls every ~15s" | "every `UPDATE_INTERVAL` seconds (20 on both stacks)" | `deploy/production/compose.yaml:79`, `deploy/staging/compose.yaml:74` |
| `route.js` guard comment | "A web-only replica must never run the update: prevEvents and lastSeasonObserved live in this process ... (#516)" | The replica opted out with `WORKER_ENABLED=false`; the poller state lives in the lease row (#517); the guard is an operator choice. The 403 guard code is unchanged | `src/app/api/h1/update/route.js:77-82`, `src/update/lease.mjs:6-14` |
| `initializeWorker.mjs` JSDoc | "N web replicas with WORKER_ENABLED=false and one worker replica" | Optional per-replica opt-out; every replica may run the worker; the lease lets one holder poll; no deployment needs a separate worker replica | `src/shared/utils/initializeWorker.mjs:2-6`, `deploy/staging/compose.yaml:114` |
| `cron.js` lifecycle comment | "Spawned by src/instrumentation.js" | Spawned by `initializeWorker()`, which `src/instrumentation.node.js` calls at server start after `migrateOrWait()` | `public/workers/cron.js:13`, `src/instrumentation.node.js:18` |
| Extra check: private infrastructure detail | none found | No IPv4 address, node label or secret name in `AGENTS.md` | `AGENTS.md:82-88` |

Lane commit: 50fe508c7254cc5d7556b3da4b68f40a1f091d71

AGENTS.md: CHECKED

## Codebase maps

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `.planning/codebase/STACK.md:85` | "`WORKER_ENABLED="false"` on scaled web replicas, one dedicated 1-replica worker service" | Every replica runs the cron thread; only the lease holder polls; the opt-out is optional; both stacks run 2 app replicas; no dedicated worker service | `src/update/lease.mjs:20`, `deploy/production/compose.yaml:118`, `deploy/staging/compose.yaml:114` |
| `.planning/codebase/STACK.md:86` | Images "pulled by `docker-compose.yml`" | Pulled by the two Swarm stacks, applied by Arcane Git Sync | `deploy/production/compose.yaml:118`, `deploy/staging/compose.yaml:114` |
| `.planning/codebase/ARCHITECTURE.md:125` (step 2) | "a web-only replica must 403 rather than run stale-state logic" | The 403 stays; its reason is the explicit `WORKER_ENABLED=false` opt-out | `src/app/api/h1/update/route.js:81-82`, `src/shared/utils/initializeWorker.mjs:8-11` |
| `.planning/codebase/ARCHITECTURE.md:126` (step 3) | `lease.mjs:42`, `route.js:89-90` | `lease.mjs:45`, `route.js:92-93` | `src/update/lease.mjs:45`, `src/app/api/h1/update/route.js:92` |
| `.planning/codebase/ARCHITECTURE.md:127` (step 4) | `updateStatus()` upserts only `h1_status` and `h1_statistic` | It also upserts `h1_event_progress`, `h1_season` and `h1_event` | `src/update/status.mjs:8`, `src/update/status.mjs:12` |
| `.planning/codebase/ARCHITECTURE.md:128` (step 5) | closing pass at `route.js:119-143` | `route.js:130-153` | `src/app/api/h1/update/route.js:138` |
| `.planning/codebase/ARCHITECTURE.md:130` (step 7) | `updateSeason()` writes `h1_event_progress` and `h1_statistic` | It bucket-upserts `h1_event`, `h1_season` and `h1_status` only | `src/update/season.mjs:10`, `src/update/season.mjs:12` |
| `.planning/codebase/ARCHITECTURE.md` worker bootstrap trigger | "guarded by `isWorkerEnabled()` so a web-only replica doesn't spawn it" | `instrumentation.node.js` calls `initializeWorker()` after `migrateOrWait()`; `WORKER_ENABLED=false` does not spawn the thread. Extra drift, found while reading | `src/instrumentation.node.js:18`, `src/instrumentation.node.js:22` |
| `.planning/codebase/ARCHITECTURE.md` throttle reference | `route.js:38` | `route.js:40`. Extra drift | `src/app/api/h1/update/route.js:40` |
| `.planning/codebase/INTEGRATIONS.md:79-80` | "Production runs 3 app replicas"; `docker-compose.yml` as the Swarm config | Both stacks are Swarm stacks with 2 app replicas, applied by Arcane Git Sync; `docker-compose.yml` is a single-host compose; the lease picks the poller | `deploy/production/compose.yaml:118`, `deploy/staging/compose.yaml:114`, `docker-compose.yml:3` |
| `.planning/codebase/STACK.md:16,79` | Node 24 and `node = "24"` | Node 26 and `node = "26"`. Extra drift, found while reading | `mise.toml:2` |
| `.planning/codebase/CONCERNS.md` poller-state concern | Described the pre-#517 module-level state as open | One line: resolved in Phase 2 (DOCS-01, plan 02-02) | `src/update/lease.mjs:6-14` |
| `.planning/codebase/CONCERNS.md` #501 concern | Said the seed-refresh path was unverified | One line: verified on the season-161 run (#642); #501 closed; gaps in #658. The #502 concern is untouched (plan 02-10 owns it) | `.github/workflows/scheduled-seed-refresh.yml:66` |
| `.planning/milestones/M7-phases/01-stability-fixes-release/01-REVIEW-DISPOSITION.md` WR-07, WR-08 | Disposition `open` | `deferred → #662` and `deferred → #663`; no other row changed | `next.config.mjs:68`, `next.config.mjs:194` |

Lane commit: 50fe508c7254cc5d7556b3da4b68f40a1f091d71

Codebase maps: CHECKED

## /docs/architecture

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/architecture/page.mdx:34` | "A dedicated thread polls the official API every 5-15 seconds" | Every app replica runs a worker thread that calls the update route every `UPDATE_INTERVAL` seconds; each call claims the `worker_heartbeat` lease first; one replica polls, the others stand by | `public/workers/cron.js:34`, `src/app/api/h1/update/route.js:93`, `src/update/lease.mjs:45` |
| `src/app/docs/architecture/dataFlowConfig.mjs` worker detail (was `:125-150`) | "Both API endpoints polled every ~15s"; the update cycle had no lease step; tag `~15s loop` | `UPDATE_INTERVAL` wording and tag; the cycle starts with "Claim or renew the poller lease (a standby replica stops here)" | `public/workers/cron.js:34`, `src/app/api/h1/update/route.js:93` |
| `dataFlowConfig.mjs` and `dataFlowDefinition.mjs` (new node) | No lease node: the diagram showed one worker polling alone | Node `lease` in the Processing subgraph, edge `worker -->\|"claim / renew"\| lease`, `details.lease` with the 60 s TTL, and `lease` in `flows.live` and `flows.snapshot` | `src/update/lease.mjs:20`, `src/update/lease.mjs:45`, `src/app/api/h1/update/route.js:93` |
| `dataFlowConfig.mjs:6,65,69,90` and `dataFlowDefinition.mjs:30-31` | Label `Live Polling (~15s)`, "Polled every ~15 seconds", tags `~15s poll`, edge labels `~15s` and `~15s + on demand` | `Live Polling`; `UPDATE_INTERVAL`, `UPDATE_INTERVAL poll` and `UPDATE_INTERVAL + on demand`. Both stacks set 20 s | `deploy/production/compose.yaml:79`, `deploy/staging/compose.yaml:74` |
| `dataFlowConfig.mjs` `flows.snapshot` (was `:24-31`) | Lists `h1_statistic` and `h1_event_progress` | Lists `api_snapshot`, `worker`, `lease`, `h1_season`, `h1_status`, `h1_event`: `updateSeason` writes those three tables only | `src/update/season.mjs:10`, `src/update/season.mjs:12` |
| `dataFlowConfig.mjs:153` (`seed_script`) | Subtitle `prisma db seed`; "Runs on first deploy"; tag `first deploy only` | Subtitle `prisma/seed/seed.mjs`; runs as `node --experimental-strip-types prisma/seed/seed.mjs`; `migrateOrWait` runs it under an advisory lock when the seed hash changed; tag `when seed data changed` | `src/update/migrateOnStart.mjs:35`, `src/update/migrateOnStart.mjs:112` |
| `dataFlowDefinition.mjs:12` and the `seed_files` label | Seed label `prisma db seed / startup`; seed files "Bootstrap (first deploy)"; edge `once` | Label `prisma/seed/seed.mjs` with "on start, when seed data changed"; "Bootstrap (seed data)"; edge `when changed` | `src/update/migrateOnStart.mjs:35`, `src/update/migrateOnStart.mjs:83` |
| `dataFlowConfig.mjs:121` (seed file list) | List ends at `season-155.json` | List ends at `season-161.json`, the highest file in `prisma/seed/seasons/` after plan 02-04 | `src/update/migrateOnStart.mjs:84` |
| Extra check: private infrastructure detail (D-06) | none found | No IPv4 address, host name, node label or secret name in the five architecture-page files. The env var names `UPDATE_INTERVAL` and `UPDATE_KEY` are documented in the public docs already | `src/app/docs/architecture/dataFlowConfig.mjs:6`, `src/app/docs/architecture/dataFlowDefinition.mjs:12` |

Lane commit: 0f2a2432d907e3ccb75f1e95fdf7a6d347e0c7cb

Earlier closing line (lane commit 0f2a2432): CHECKED. It missed the drift in § Gap closure: /docs/architecture.

## /docs (overview)

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/page.mdx:32` | Update Flow described as "worker pipeline, two-table strategy, and snapshot throttling" | "worker pipeline, poller lease, and bucketed upserts" | `src/update/lease.mjs:45`, `src/update/season.mjs:10` |
| `src/app/docs/overviewConfig.mjs:92` (`api_update`) | "Internal POST endpoint called by the worker thread" | Internal GET endpoint (Bearer `UPDATE_KEY`); only the lease holder does the work; other replicas answer standby; POST answers 405 | `src/app/api/h1/update/route.js:63`, `src/app/api/h1/update/route.js:223` |
| `src/app/docs/overviewConfig.mjs` `worker` panel. Extra drift | "polling the official HD1 API every 10-20 seconds" | Calls the update route every `UPDATE_INTERVAL` seconds; every replica runs it; only the lease holder polls | `public/workers/cron.js:34`, `deploy/production/compose.yaml:79` |
| `src/app/docs/overviewConfig.mjs` `db` panel. Extra drift | "Two-table strategy: rebroadcast_* tables store raw API JSON" | Normalized `h1_*` tables hold the war record; `worker_heartbeat` holds the poller lease; there are no raw-cache tables | `src/update/lease.mjs:45`, `src/update/season.mjs:12` |
| `src/app/docs/overviewConfig.mjs` `api_rb` panel. Extra drift | "Returns cached raw JSON from the rebroadcast tables" | Reconstructs the official wire format from the normalized `h1_*` tables | `src/update/season.mjs:10`, `src/update/season.mjs:12` |
| `src/app/docs/overviewDefinition.mjs:19`. Extra drift | Node label "Polls every 10-20s" | "Calls every UPDATE_INTERVAL s" | `deploy/staging/compose.yaml:74` |

Lane commit: 0f2a2432d907e3ccb75f1e95fdf7a6d347e0c7cb

Earlier closing line (lane commit 0f2a2432): CHECKED. It missed the drift in § Gap closure: /docs (overview).

## /docs/notifications

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/notifications/page.mdx:115` | "Keeps previous events in memory ... Resets on server restart (acceptable — misses one transition at most)" | The previous event snapshot is stored in the lease row (`worker_heartbeat.prev_events`); the update route passes it in and writes the new snapshot back after each check; a restart or a handover neither misses nor repeats a push. The restart caveat is removed | `src/app/api/h1/update/route.js:200`, `src/app/api/h1/update/route.js:206`, `src/update/pushNotifier.mjs:118` |
| `src/app/docs/notifications/notificationFlowConfig.mjs:175` (`pushcheck` panel) | "Keeps previous events in memory"; table row `Reset: On server restart (ok)` | "Compares against the previous event snapshot in the lease row (worker_heartbeat.prev_events)"; row `Baseline: Lease row, survives restarts` | `src/update/pushNotifier.mjs:146`, `src/app/api/h1/update/route.js:206` |
| `src/app/docs/notifications/pushFlowConfig.mjs:36` | "keeps previous events in memory. Resets on server restart" | The same fact in one sentence: the baseline is the lease-row snapshot, so restarts and handovers neither miss nor repeat a push | `src/update/pushNotifier.mjs:115`, `src/app/api/h1/update/route.js:206` |
| Out of scope, DOCS-03 (unchanged) | The three notifications diagrams label the update route `POST /api/h1/update` (`src/app/docs/notifications/inAppFlowDefinition.mjs:7`, `src/app/docs/notifications/pushFlowDefinition.mjs:4`, `src/app/docs/notifications/inAppFlowConfig.mjs:36`, `src/app/docs/notifications/notificationFlowConfig.mjs:37`). The worker calls it with GET | Left as is: D-07 limits this plan to the lease lines | `public/workers/cronLogic.js:30`, `src/app/api/h1/update/route.js:63` |
| Out of scope, DOCS-03 (unchanged) | "polls every ~20s" in `src/app/docs/notifications/notificationFlowDefinition.mjs:5` and `src/app/docs/notifications/inAppFlowDefinition.mjs:6`; "polls ... every ~20 seconds" in `notificationFlowConfig.mjs:37` | Left as is: the cadence is `UPDATE_INTERVAL` (20 s on both stacks), and the "~20s" label is correct for the deployed value | `deploy/production/compose.yaml:79`, `deploy/staging/compose.yaml:74` |

Lane commit: 0f2a2432d907e3ccb75f1e95fdf7a6d347e0c7cb

Earlier closing line (lane commit 0f2a2432): CHECKED. It missed the drift in § Gap closure: /docs/notifications.

## /docs/data-flow

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/data-flow/page.mdx:4` (metadata) | "two-table strategy, snapshot throttling" | "Worker pipeline, poller lease, bucketed upserts" | `src/update/lease.mjs:45`, `src/shared/utils/bucketing.mjs:20` |
| `page.mdx:55` (overview fence) | `style Raw ...` for a `Raw` subgraph that no longer exists | Line removed; a `LEASE` node (`claimLease()`, standby replicas stop there) now feeds `FETCH`; the seed node reads "Applied on start when the seed data changed" | `src/update/migrateOnStart.mjs:35`, `src/update/lease.mjs:45` |
| `page.mdx:90` (season pipeline bullet) | "runs on-demand when historical season data is needed" | Runs every poll for the active season (with `protectedBucket`), in the closing pass, and on demand | `src/app/api/h1/update/route.js:162`, `src/app/api/h1/update/route.js:141` |
| `page.mdx:102-103` (startup fence) | `instrumentation.js` calls `initializeEnvironmentVariables()` then `initializeOpenApiSpec()`; no migration step | Chain `register()` -> `initializeHelldivers1Api()` -> `initializeEnvironmentVariables()` -> `migrateOrWait()` -> `initializeWorker()` -> `isWorkerEnabled()` branch -> `new Worker(cron.js)`; the OpenAPI-spec node is gone | `src/instrumentation.js:9`, `src/instrumentation.node.js:18`, `src/instrumentation.node.js:22` |
| `page.mdx:117` (startup paragraph) | "`initializeWorker()` is called from `src/instrumentation.js`" | Called from `src/instrumentation.node.js` after `migrateOrWait()`; migrations and seed run under an advisory lock with retries after 30 s, 60 s, 2 min, then every 5 min; `WORKER_ENABLED=false` logs and serves web only | `src/instrumentation.node.js:22`, `src/update/migrateOnStart.mjs:182`, `src/shared/utils/initializeWorker.mjs:20` |
| `page.mdx:153` (message-loop sample) | `GET http://localhost:${port}/api/h1/update?key=${key}` | `Authorization: Bearer ${key}` header, `X-Worker-Startup` on the first poll only, optional heartbeat POST to `GLITCHTIP_HEARTBEAT_URL` after a 2xx | `public/workers/cronLogic.js:27`, `public/workers/cronLogic.js:32`, `public/workers/cronLogic.js:42` |
| `page.mdx:170-192` (parent handler, shutdown). Extra drift | Exit handler only logs and nulls the worker; shutdown has no flag | A worker exit outside a shutdown calls `process.exit(1)`; SIGINT and SIGTERM set `shuttingDown` first | `src/shared/utils/initializeWorker.mjs:67`, `src/shared/utils/initializeWorker.mjs:70` |
| New `### Poller lease` subsection (D-08) | No lease description on the page | 13 lines: claim, holder vs standby, 60 s TTL, `prev_events` and `last_season_observed` in the row, holder-guarded `persistPollerState()`, `WORKER_ENABLED=false` gives 403; links to `/docs/database` and `/docs/infrastructure` | `src/update/lease.mjs:20`, `src/update/lease.mjs:86`, `src/app/api/h1/update/route.js:81` |
| `page.mdx:190` and `:200` (section 3 intro) | "`GET /api/h1/update?key=...` on every worker tick", "persists it to both table families" | Bearer-header GET: key check (401), opt-out 403, lease claim with early standby answer, then `updateStatus()`, the closing pass, `updateSeason()`, warnings, `after()` push check, heartbeat | `src/app/api/h1/update/route.js:66`, `src/app/api/h1/update/route.js:93`, `src/app/api/h1/update/route.js:199` |
| `page.mdx` section 3 steps. Extra drift | Calls named `queryUpsert*`; event progress before `h1_status`; event progress and statistic failures "logged, do not throw"; `getSeasonFromStatus` reads `defend_event` | Real names `upsertSeason`, `upsertEvent`, `upsertStatus`, `upsertStatistic`, `upsertEventProgress`; order season, events, status, statistic, event progress, confirm; statistic writes throw, only event progress goes to `warnings`; the season comes from `campaign_status` and `statistics` only; return value includes `time` and `warnings` | `src/update/status.mjs:73`, `src/update/status.mjs:84`, `src/update/status.mjs:99`, `src/shared/utils/getSeason.mjs:18` |
| `page.mdx:441` (section 4 "On-demand invocation") | "`updateSeason()` is not called on a schedule"; two callers | Sub-section "Where `updateSeason` runs" (every poll, closing pass, on demand); "On-demand invocation" lists `getCampaignOrSeed` (`/archives`, `/api/h1/campaign`), `/api/h1/rebroadcast`, `backfillAndRetry` via `backfillSeason` (the four `/api/v1/h1/*` routes), `reseedSeason` (admin Refresh) | `src/db/queries/getCampaignOrSeed.mjs:27`, `src/app/api/h1/rebroadcast/route.js:126`, `src/shared/utils/api/backfillSeason.mjs:15`, `src/features/archives/reseedSeason.mjs:55` |
| `page.mdx:460-462` (closing pass) | "module-level state (`lastSeasonObserved`)"; "resets on worker restart, so a restart ... will miss one closing snapshot" | Previous season comes from the lease row; the pass runs once when the season increases; `persistPollerState()` writes the new season; it survives restarts and handovers; the restart edge case is removed | `src/app/api/h1/update/route.js:137`, `src/app/api/h1/update/route.js:155`, `src/update/lease.mjs:86` |
| `page.mdx` section 4 steps and section 5. Extra drift | `updateSeason` metadata "season_duration"; steps listed in the wrong order; return value without `time` and `warnings`; section 5 omits `worker_heartbeat` and the `/api/v1/h1/*` readers | `updateSeason` writes `h1_season` (`introduction_order`, `points_max`), `h1_status` (frames in or after `protectedBucket` skipped) and `h1_event`; `season_duration` comes from `updateStatus` only; section 5 names `worker_heartbeat` as the non-war-record sixth table | `src/update/season.mjs:71`, `src/update/season.mjs:86`, `src/update/status.mjs:46` |
| `page.mdx` section 6. Extra drift | "typically every few seconds"; function names `queryUpsert*`; history of `snapshotTimers.mjs` | `UPDATE_INTERVAL` seconds on the lease holder; `upsertStatus`, `upsertStatistic`, `upsertEventProgress`; the sample matches the source (`Number.isFinite` guard); the removed-module history is dropped | `src/shared/utils/bucketing.mjs:11`, `src/db/queries/upsertStatus.mjs:28` |
| `page.mdx` section 7. Extra drift | `getApiURL()` with three environment URLs; `fetchInvalidHttps`; "throws in two cases" | One constant `HD1_API_URL`; internal `fetchWithUntrustedCert`; three throw cases; `fetchSeason` throws `Invalid season` | `src/update/fetch.mjs:8`, `src/update/fetch.mjs:10`, `src/update/fetch.mjs:50` |
| Extra check: the update route ignores `X-Worker-Startup` | The old comments say the header triggers "a one-time startup pass" | The page says the header is sent on the first poll and that the route declares its name but does not act on it. Nothing in `src/` reads the header; recorded for Andrei, no code change | `src/app/api/h1/update/route.js:26`, `public/workers/cronLogic.js:33` |
| Extra check: secret values (T-02-12) | none found | The samples use `${key}` and `<key>` placeholders; no UUID-shaped value on the page | `public/workers/cronLogic.js:32` |

Fail-first output of `node scripts/check-mermaid-fences.mjs` before any page edit (exit 1):

```
OK src/app/docs/architecture/page.mdx fence@46
OK src/app/docs/data-flow/page.mdx fence@19
OK src/app/docs/data-flow/page.mdx fence@100
OK src/app/docs/infrastructure/page.mdx fence@13
OK src/app/docs/infrastructure/page.mdx fence@129
OK src/app/docs/infrastructure/page.mdx fence@205
FAIL src/app/docs/database/page.mdx fence@73 Parse error on line 97:
OK src/app/docs/database/page.mdx fence@231
OK src/app/docs/testing/page.mdx fence@24
checked 9 fences in 5 files
```

Lane commit: 12c795317abfe681283b85108903b6bb77b40089

Page data-flow: CHECKED

## /docs/database

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/database/page.mdx:130,174-178,188-192` (ER fence), `:523` (`### Review`), `:578` (`## 7. App Configuration Model`), `User.reviews` row | `Review` and `App` entities, relation and model sections | Removed from the ER fence, the User relation table and the sections; the later `##` sections renumbered (7 Worker Health, 8 Rate Limiting, 9 Index and Constraint Summary, no gap) | `prisma/migrations/20260416091157_drop_unused_tables/migration.sql:9`, `prisma/schema.prisma:70` |
| `page.mdx:194-201` (ER) and `:596-611` (`### worker_heartbeat`) | Six columns; "one row per worker type, e.g. `cron`"; "upserted by `cron.js`" | Ten columns incl. `holder_id`, `lease_until`, `prev_events`, `last_season_observed`; one row `cron_api_poller`; 60 s TTL; `started_at` resets on holder change; written by `claimLease` and the route heartbeat; link to the Data Flow section "Poller lease" | `prisma/schema.prisma:247`, `src/update/lease.mjs:19`, `src/update/lease.mjs:20`, `src/app/api/h1/update/route.js:49` |
| ER fence and new `## 8. Rate Limiting` / `### api_rate_limit`, index table | `api_rate_limit` missing | Entity with `key`, `route_group`, `window_start` (Int), `count`; section with the composite `@@id` and `@@index([window_start])`; two index rows; hourly purge by the lease holder | `prisma/schema.prisma:284`, `src/shared/utils/api/rateLimit.mjs:36`, `src/app/api/h1/update/route.js:98` |
| 19 `PostgreSQL Type` cells | `TIMESTAMPTZ` | `TIMESTAMP(3)`; new `### Timestamp type` states naive UTC and `AT TIME ZONE 'UTC'` in raw SQL. All 19 cells were replaced; two of them (`Review`) left with the model and `worker_heartbeat` gained `lease_until` as `TIMESTAMP(3)` | `src/update/lease.mjs:46`, `src/update/lease.mjs:55` |
| `page.mdx:41,51` (`prisma.config.mjs` sample and sentence) | `import 'dotenv/config'`, "loads `.env`" | The file's lines 1-3 verbatim; the CLI loads `.env.development`, then falls back to `.env`; in Docker `POSTGRES_URL` comes from the environment | `prisma.config.mjs:2`, `prisma/schema.prisma:14` |
| `page.mdx:57-67` (runtime client sample). Extra drift | `connectionString: process.env.POSTGRES_URL` inline | Sample matches `getConnectionString()`, which throws when `POSTGRES_URL` is unset | `src/db/db.js:4`, `src/db/db.js:12` |
| `page.mdx:170` (ER `Settings` attribute). Extra drift | `PK-FK`: mermaid 12 rejects it (fence@73, parse error on line 97) | `PK, FK` | `src/app/docs/database/page.mdx:183`, `prisma/schema.prisma:94` |
| `h1_*` and `push_subscription` models | none found | Re-read against the schema: fields, types, indexes and relations match | `prisma/schema.prisma:117`, `prisma/schema.prisma:225` |

Fail-first output of `node scripts/check-mermaid-fences.mjs` before any page edit (exit 1):

```
OK src/app/docs/architecture/page.mdx fence@46
OK src/app/docs/data-flow/page.mdx fence@19
OK src/app/docs/data-flow/page.mdx fence@104
OK src/app/docs/infrastructure/page.mdx fence@13
OK src/app/docs/infrastructure/page.mdx fence@129
OK src/app/docs/infrastructure/page.mdx fence@205
FAIL src/app/docs/database/page.mdx fence@73 Parse error on line 97:
OK src/app/docs/database/page.mdx fence@231
OK src/app/docs/testing/page.mdx fence@24
checked 9 fences in 5 files
```

Lane commit: 3387d4be5c01216f99b4c392ad9c7f93792fb23e

Page database: CHECKED

## /docs/testing

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/testing/page.mdx:11` | "Audience: project owner and AI assistants" | Removed | `AGENTS.md:67` |
| `page.mdx:22` | "following conventions from the euraika/aegis projects" | Removed; the overview now lists the three configs, including `vitest.visual.config.mjs` (`vitest.visual.config.mjs:12`) | `.github/workflows/check-ci.yml:24` |
| `page.mdx:24-62` (mermaid directory fence), `:66-90` (tree), missing rule | Non-existent dirs `queries/`, `routes/`, `utils/`; no mirror rule | One paragraph under `## Directory Structure`: unit tests mirror the source tree under `src/__tests__/unit/`, enforced by `mirrorTree.test.mjs`; smoke, visual and utils named. The fence is gone, so the page has no mermaid fence | `src/__tests__/unit/_meta/mirrorTree.test.mjs:11`, `AGENTS.md:67` |
| `page.mdx:224-232` (`## Test Naming Conventions`) | Naming table (no `.jsx`, no qualifier, no escape hatches) | Section removed; nothing linked to it | `src/__tests__/unit/_meta/mirrorTree.test.mjs:11` |
| `page.mdx:103-112` (scripts table) | "`npm test` runs unit then smoke"; `test:smoke` and `test:all` missing | `npm test` and `test:unit` are `vitest run`; `test:smoke`, `test:e2e` (alias), `test:all` (unit, then smoke), `test:visual`, `test:visual:update` (`package.json:15-22`) | `src/__tests__/smoke/smoke.test.mjs:1` |
| `page.mdx:114` | "Never start the dev server from Claude — ask the user" | Removed; neutral note on `TEST_SERVER_URL` (default `http://localhost:3000`), fail with no server, `SMOKE_ALLOW_SKIP=1` | `src/__tests__/smoke/smoke.test.mjs:11` |
| `page.mdx:137` (coverage excludes) | "malformed enum files" | The three globs of `vitest.config.mjs`, plus the include glob | `vitest.config.mjs:30` |
| `page.mdx:143-188` (global mocks). Extra drift | "All models from the schema"; "Sentry never fires"; `vi.clearAllMocks()` in `beforeEach` | Models the app uses (list in `vitest.setup.mjs`); "error reporter"; `next/cache` and `next/server` added, `LiveDataContext` and `react-slot-counter` named; `beforeEach` runs `vi.resetAllMocks()` (`vitest.setup.mjs:305`, `next/cache` mock at `vitest.setup.mjs:200`) | `src/__tests__/utils/index.mjs:12`, `src/__tests__/smoke/smoke.test.mjs:1` |
| `page.mdx:261` (smoke base URL). Extra drift | Fixed `http://localhost:3000` | `TEST_SERVER_URL`, default `http://localhost:3000`; no server fails; `SMOKE_ALLOW_SKIP=1` skips | `src/__tests__/smoke/smoke.test.mjs:1`, `src/__tests__/smoke/smoke.test.mjs:11` |
| `page.mdx:282` (CI reference) | `.github/workflows/ci.yml` | `.github/workflows/check-ci.yml`, job `Visual Regression`; runs on PR and push to `main` and `develop` | `.github/workflows/check-ci.yml:24`, `.github/workflows/check-ci.yml:8` |
| `page.mdx:271` and the rest of the visual section, utilities, API route pattern, gitignore | none found | `:271` (image tag `v1.64.1-noble`) matches the script and the job; the five baselines, the utilities exports, the healthcheck example and the gitignore entries match the files | `scripts/visual-tests.sh:12`, `.github/workflows/check-ci.yml:33`, `src/__tests__/utils/index.mjs:42` |

Lane commit: 3387d4be5c01216f99b4c392ad9c7f93792fb23e

Page testing: CHECKED

## /docs/infrastructure

Line numbers in the "Stale statement" column are the lines of the page at `develop` before this plan.

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| Missing section (D-04..D-06) | No deployment-topology section | New `## Deployment topology`: two Swarm stacks with 2 `app` and 2 `cloudflared` replicas each, one Postgres outside the stack, `UPDATE_INTERVAL` 20 on both; ingress by Cloudflare Tunnel; the lease makes any replica count safe and no worker service exists; start-first rollover with the observed `/_next/static` 404 then cached 200; `docker-compose.yml` is a single-host compose. No IP address, host name, node label or secret name | `deploy/production/compose.yaml:118`, `deploy/production/compose.yaml:151`, `deploy/staging/compose.yaml:114`, `deploy/staging/compose.yaml:148`, `deploy/production/compose.yaml:79`, `deploy/staging/compose.yaml:74` |
| Missing release path (D-10) | Only a diagram that ended at "Create GitHub Release" | Tag on `main` -> Build: Release (verify, per-arch app and migrate legs, manifests, GitHub Release, Pin Production) -> `deploy/production` -> Arcane Git Sync; rollback is a dispatch of an earlier tag; staging: Check: CI -> Build: Staging -> Bump Staging Tag -> `deploy/staging`, version `<version>-dev.<sha7>` | `.github/workflows/build-release.yml:278`, `.github/workflows/build-staging.yml:213`, `.github/workflows/build-staging.yml:283` |
| `:43,:80` image tags | Only the `:staging` tag | `:staging` and `:sha-<commit>` for staging; `:<tag>`, `:production`, `:latest` for a release | `.github/workflows/build-staging.yml:245`, `.github/workflows/build-release.yml:128` |
| `:49-57` Dockerfile.migrate steps | Step 3 "Upgrade npm to 11.7.0"; no `USER node`; no validators copied | The npm upgrade is gone. Steps: tini via apk, project manifest to `/tmp`, lockfile, `prisma/`, `prisma.config.mjs` and the two seed modules, a minimal 5-package manifest, `npm install`, `prisma generate`, cleanup, `USER node`, tini entrypoint. Tini stays: the migrate image keeps it | `Dockerfile.migrate:42`, `Dockerfile.migrate:107`, `Dockerfile.migrate:135`, `Dockerfile.migrate:138` |
| `:88-98` runner stage | `NODE_ENV=staging`, user `nextjs` uid 1001 / group `nodejs` gid 1001, `--chown=nextjs:nodejs`, entrypoint `/sbin/tini --` | `NODE_ENV=production` from both pipelines; numeric user `65532:65532`, `--chown=65532:65532`, no init wrapper, `CMD ["node", "server.js"]`, `MIGRATE_ROOT`, `CHECKPOINT_DISABLE`; healthcheck line unchanged (30 s, 5 s, 900 s start period, 3 retries) | `Dockerfile.app:152`, `Dockerfile.app:167`, `Dockerfile.app:177`, `Dockerfile.app:184`, `Dockerfile.app:190` |
| `:165` staging build arg | "Both build jobs pass `NODE_ENV=staging`" | `NODE_ENV=production` | `.github/workflows/build-staging.yml:140`, `.github/workflows/build-staging.yml:211` |
| `:100-110` docker-compose.yml | `helldiversbot (helldiversbot:staging)`; no `platform` | Image `ghcr.io/elfensky/helldiversbot:staging`, `platform: linux/amd64`, one container on one host, the compose healthcheck replaces the image one, not a Swarm stack file | `docker-compose.yml:7`, `docker-compose.yml:8`, `docker-compose.yml:23` |
| `:149,:171,:177,:195` retired workflow names | `staging.docker.yml`, `release.docker.yml`, `ci.yml`, `metrics.yml` | The 11 files with their declared names in one table (file, name, trigger, purpose); subsections for `build-staging.yml` and `build-release.yml` | `.github/workflows/build-staging.yml:1`, `.github/workflows/build-release.yml:1`, `.github/workflows/check-ci.yml:4`, `.github/workflows/scheduled-pagespeed.yml:1`, `.github/workflows/cleanup-ghcr.yml:1` |
| `:129` CI/CD fence | Push, CI, "Build Migrate Image", "Cleanup untagged images"; one production build box | Rebuilt: Check: CI, Detect Migration Changes, per-arch build legs, Publish Manifest jobs, Bump Staging Tag, Pin Production, Arcane Git Sync; valid mermaid | `.github/workflows/build-staging.yml:39`, `.github/workflows/build-release.yml:278` |
| `:153` "direct merges" | "`develop` accepts direct merges without a PR" | Every change reaches `develop` and `main` through a pull request | `AGENTS.md:42` |
| `:193` release body | `softprops/action-gh-release`, body from `RELEASE.md` | `gh release create` with the `CHANGELOG.md` section extracted by `awk` | `.github/workflows/build-release.yml:224`, `.github/workflows/build-release.yml:263` |
| `:205-258` initialization flow | `initializeOpenApiSpec()` step and fence node; `initialize.openapi.mjs`; "staging falls through"; no migration step; no worker opt-out | `register()` -> `initializeHelldivers1Api()` -> `initializeEnvironmentVariables()` (with `hydrateFileSecrets()`) -> `migrateOrWait()` -> `initializeWorker()` with the `WORKER_ENABLED=false` branch; three crash paths, including the worker `exit` -> `process.exit(1)`; migration failure retries and does not crash | `src/instrumentation.js:5`, `src/instrumentation.node.js:9`, `src/instrumentation.node.js:18`, `src/shared/utils/initializeWorker.mjs:20`, `src/shared/utils/initializeWorker.mjs:67` |
| `:241` env check names and auth count | `checkDatabase()`, `checkUpdates()`; "BETTER_AUTH_SECRET + 5 auth vars" | `validateDatabase()`, `validateUpdates()`; seven further auth vars (URL plus three provider pairs) | `src/shared/utils/initializeEnv.mjs:28`, `src/shared/utils/initializeEnv.mjs:34` |
| `:304` tracing rate | `tracesSampleRate: 1.0` for both runtimes | Server 1.0; client 0.1 in production, 1.0 otherwise | `sentry.server.config.js:31`, `src/instrumentation-client.js:24` |
| Sentry block (plan 02-10) "next.config.mjs Sentry settings" | Checked: ternary on `SENTRY_AUTH_TOKEN`, `authToken`, `org`, `project`, `sentryUrl`, `sourcemaps.deleteSourcemapsAfterUpload: true`, no `silent`, no `productionBrowserSourceMaps` | No drift; block unchanged | `next.config.mjs:213`, `next.config.mjs:225` |
| `:395-430` env table | Missing `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`, `FORCE_SEED`, `LEGACY_POSTGRES_URL`, `SEED_TEST_API_KEY`, `SEED_TEST_API_KEY_HASH`, `SMOKE_ALLOW_SKIP`, `TEST_SERVER_URL`; `POSTGRES_SSL` row; no `*_FILE` convention | All nine rows added with the `.example.env` descriptions; `POSTGRES_SSL` removed (no code reads it); new subsection "The `*_FILE` convention" (`SENTRY_DSN` stays plain; build-time keys and scripts cannot use it); `NODE_ENV` and `NEXT_RUNTIME` moved out of the table into a note because `.example.env` does not hold them; every table key is in `.example.env` | `src/shared/utils/hydrateFileSecrets.mjs:19`, `src/shared/utils/bucketing.mjs:13`, `src/update/lease.mjs:30`, `prisma/seed/seed.mjs:207` |
| `:453` `.docker.env` paragraph. Extra drift | "The `.docker.env` file ... is referenced by both services in `docker-compose.yml`" | `docker-compose.yml` has one service and reads a local env file; the Swarm stacks use `POSTGRES_URL_FILE` | `docker-compose.yml:11` |
| `:11` intro. Extra drift | "Audience: project owner and AI assistants" | Removed (same call as the testing page) | `AGENTS.md:67` |
| `:309` client SDK settings. Extra drift | `autoSessionTracking: false` listed as a client option | Removed: the client config has no such key; added `release` and the `beforeSend` chunk-error reload | `src/instrumentation-client.js:10`, `src/instrumentation-client.js:35` |
| `:465` web app manifest. Extra drift | Source `src/app/site.webmanifest` | `public/site.webmanifest` | `public/site.webmanifest:1`, `src/app/layout.jsx:66` |
| `:483-492` cache headers. Extra drift | Icons, images, SVGs 7 days; service worker 1-day `max-age` | Icons, images, SVGs 1 year; `/sw.js` is `no-cache, no-store, must-revalidate`; page routes `s-maxage=30`; security headers; the service worker is built from `src/sw.js` by `serwist build` | `next.config.mjs:120`, `next.config.mjs:151`, `serwist.config.js:10` |
| Extra check: private infrastructure detail (D-06, T-02-43) | none found | No non-loopback IPv4 address, host name, node label, constraint or Swarm secret name on the page; `127.0.0.1` appears only in the local compose and connection strings | `deploy/production/compose.yaml:79`, `docker-compose.yml:10` |
| Out of scope | `docker-compose.ci.yml:70` still sets `POSTGRES_SSL: 'false'` | Not changed here; noted in the PR body | `docker-compose.ci.yml:70` |

Lane commit: c6bcfdb34b7d763c0364eb27b69c9d6cecf1afbc

Page infrastructure: CHECKED

## Final check (develop 709126df159c180b050756887257a0b2be1d02d3)

R is the develop head after the cut PR #682 (0.99.0), the live-polling fix #671 and the S159 statistics fix #677 (rebase merges). Date: 2026-11-15. The lane is `chore-release-2`, detached at R, with `npm ci` done. An earlier run of the same four checks passed on the head after PR #681 (12704b0c); Andrei then decided to include #671 and #677 in 0.99.0, so the check was repeated on the new head.

| Check | Command (run under `bash` at R) | Hit lines |
|-------|---------------------------------|-----------|
| Sweep 1 (retired strings) | `/usr/bin/grep -rnE 'TIMESTAMPTZ\|initializeOpenApiSpec\|\?key=\|staging\.docker\.yml\|release\.docker\.yml\|metrics\.yml\|[^-a-z]ci\.yml\|euraika\|aegis\|POSTGRES_SSL\|SKIP_MIGRATIONS\|5-15 seconds\|silent: true\|snapshot throttling\|AI assistants\|distroless\|uid 1001\|RELEASE\.md\|softprops\|prisma db seed' $PAGES` | 0 |
| Sweep 2 (fixed interval, state) | `/usr/bin/grep -rnE '~15 ?s\|every ~15\|in memory' $PAGES` | 0 |
| AGENTS.md sweep | `/usr/bin/grep -nE 'module-level state\|~15 seconds\|~15s\|--delete-b[r]anch' AGENTS.md` | 0 |
| Fence script | `node scripts/check-mermaid-fences.mjs` | exit 0, `checked 8 fences in 5 files` |

`$PAGES` is `src/app/docs/architecture src/app/docs/data-flow src/app/docs/infrastructure src/app/docs/database src/app/docs/testing src/app/docs/notifications src/app/docs/page.mdx src/app/docs/overviewConfig.mjs`.

Sweep 2 found one hit before the fix: `src/app/docs/data-flow/page.mdx:513` ("keeps no state in memory"). The sentence was correct. PR #681 reworded it to "The bucket math is deterministic and stateless." and added no CHANGELOG note, because the unreleased `/docs/data-flow` note covers the page.

Checked pages and files, each with its own `CHECKED` line above: AGENTS.md, the codebase maps, and the pages architecture, overview, notifications, data-flow, database, testing and infrastructure.

### Intended changes since the CHECKED lane commit c6bcfdb3

Ten hunks changed the checked pages or their code evidence after c6bcfdb3. Each was read against the code at R.

| Change | Where | Evidence |
|--------|-------|----------|
| #679 `errorHandler` rethrows Sentry step errors; the infrastructure page shows the option and states that a failed upload fails the build | `src/app/docs/infrastructure/page.mdx` (Sentry block and bullet) | `next.config.mjs:226-229` |
| #673 migrate-tools stage deletes PGlite and the query compilers of other providers; the stage-table row says so | `src/app/docs/infrastructure/page.mdx:154` | `Dockerfile.app:126-128` |
| #672 version reload waits 60 s after the first mismatch; the notifications paragraph states the delay (no mermaid fence) | `src/app/docs/notifications/page.mdx:80` | `src/shared/hooks/useLiveData.mjs:34`, `src/shared/hooks/useLiveData.mjs:134` |
| #681 sweep fix: "keeps no state in memory" became "stateless" | `src/app/docs/data-flow/page.mdx:513` | `src/shared/utils/bucketing.mjs` (pure `computeBucket()`) |
| #671 the version-reload paragraph states that a browser without `localStorage` gets no reload | `src/app/docs/notifications/page.mdx:80` | `src/shared/utils/reloadGuard.mjs:16-17` (`if (!storage) return;`), `src/shared/utils/storage.mjs:11` |
| #671 the `tryCatch` bullet of AGENTS.md names `getLocalStorage()` as the sync exception that reports nothing | `AGENTS.md:61-63` | `src/shared/utils/storage.mjs:11-17` (sync, returns null, no report) |
| #677 data-flow step 7: a faction with more `accidentals` than `deaths` is stored and adds a `statistics.implausible` warning | `src/app/docs/data-flow/page.mdx:318` | `src/update/status.mjs:87-94` (warning pushed before `upsertStatistic`; the row is still written); the S159 Illuminate figures (1.86 billion accidentals, 284,289 deaths) match `docs/reports/2026-11-15-s159-friendly-fire.html` and `prisma/migrations/20261115120000_fix_s159_illuminate_statistics/migration.sql` |
| #677 data-flow step 8 wording: "the one non-fatal step" became "A failure here is non-fatal" | `src/app/docs/data-flow/page.mdx:329` | `src/update/status.mjs:116-121` |
| #677 data-flow return value: `warnings` holds the implausible statistics of step 7 and the non-fatal failures of step 8 | `src/app/docs/data-flow/page.mdx:345` | `src/update/status.mjs:144-150` |
| #677 data-flow error handling: the exceptions that go into `warnings` are implausible statistics (step 7) and event-progress failures (step 8) | `src/app/docs/data-flow/page.mdx:362` | `src/update/status.mjs:89-94`, `src/update/status.mjs:116-133` |

This check is the release gate; phase verification owns the D-12 page-by-page read at tag v0.99.0.

Final check: PASS

## Gap closure: /docs/architecture

Plan 02-16 re-read `page.mdx`, `dataFlowConfig.mjs` and `dataFlowDefinition.mjs` statement by statement at the lane commit below, in D-01 source order, after the plan 02-05 check recorded CHECKED (02-VERIFICATION.md truth 2; 02-REVIEW.md WR-02).

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/architecture/page.mdx:74` (§ PWA & Service Worker), update sentence | "new SWs wait for explicit client approval before activating" | "A new service worker activates as soon as it installs and takes control of open tabs (`skipWaiting: true`, `clientsClaim: true` in `src/sw.js`)" | `src/sw.js:6`, `src/sw.js:7` |
| `page.mdx:74`, caching clause | "network-first for HTML documents and stale-while-revalidate for static assets": no cache-first group, no NetworkOnly rule | One sentence per strategy class that `src/sw.js` and the installed `@serwist/next` 9.5.13 `defaultCache` construct: network-first (HTML pages, RSC payloads, `.json`/`.xml`/`.csv` files), cache-first (`/_next/static` scripts, the site's own audio and video), stale-while-revalidate (the site's own images, font files, other scripts, stylesheets), NetworkOnly for `/api/*` ahead of `defaultCache`. No group under two strategies; no CacheOnly | `src/sw.js:12`, `src/sw.js:15` |
| `page.mdx:74`, Notifications link | Link target `/docs/notifications#pwa--offline`: the fragment never resolves, because docs headings carry no id | Link without a fragment, pointing at the PWA & Offline section by name; no heading id or rehype plugin added | `mdx-components.jsx:6`, `mdx-components.jsx:9`, `next.config.mjs:208`, `src/app/docs/notifications/page.mdx:186` |
| `dataFlowConfig.mjs:200,210` (`h1_season` panel) | `season_duration` shown as an array (`Int[]`, "season_duration[]") and every table said to FK to `h1_season` | `season_duration` is an `Int` scalar; `h1_status`, `h1_statistic` and `h1_event` FK to the season, `h1_event_progress` links to `h1_event` | `prisma/schema.prisma:128`, `prisma/schema.prisma:220` |
| `dataFlowConfig.mjs:240,273,341` (three `bucket` rows) | `bucket` typed `DateTime` | `Int (window start)` | `prisma/schema.prisma:165`, `prisma/schema.prisma:182`, `prisma/schema.prisma:212` |
| `dataFlowConfig.mjs:240-244` (`h1_status` rows) | Rows `points / points_max` and `players` | Rows `time`, `points / points_taken`, `status`; no `players` row, no `points_max` row | `prisma/schema.prisma:165`, `prisma/schema.prisma:176` |
| `dataFlowConfig.mjs:273` (`h1_statistic` rows) | No `players` row | Row `players` `Int` before the kills row | `prisma/schema.prisma:190` |
| `dataFlowConfig.mjs:295-300` (`h1_event` tag and key row) | Tag "upsert by event_id"; `event_id` "Int @unique" | Tag "upsert by (type, event_id)"; `event_id` "Int (unique with type)" | `prisma/schema.prisma:155` |
| `dataFlowConfig.mjs:322-341` (`h1_event_progress` panel) | "One row per (event_id, bucket)", tag "bucket-upsert by (event_id, bucket)", row `event_id` "Int FK", `points_max` row | Key `(type, event_id, bucket)`; rows `type`, `event_id`, `type + event_id` FK to `h1_event`, `bucket`, `points`; no `points_max` row (it is constant and lives on `h1_event`) | `prisma/schema.prisma:212`, `prisma/schema.prisma:220`, `src/db/queries/upsertEventProgress.mjs:38` |
| `dataFlowConfig.mjs:322,331`, `:35`, `dataFlowDefinition.mjs:55`. Extra drift | "Used by archives to show event progression charts", tag "Archives progression", edge `h1_event_progress --> fe_archives`, `h1_event_progress` in the archives flow and in the `fe_archives` panel | The app only writes the table; nothing in `src/` reads it, and the offline scripts in `scripts/analysis` do. Panel sentence and tag say so; the edge, the flow entry and the `fe_archives` text no longer name it | `src/db/queries/upsertEventProgress.mjs:38`, `scripts/analysis/lib/dataset.mjs:99`, `src/db/queries/getCampaign.mjs:113` |
| `dataFlowConfig.mjs:34,35,354-380`, `dataFlowDefinition.mjs:50,55`. Extra drift | `fe_live` and `fe_archives` read `h1_status` only, yet render player counts | `h1_statistic` joins both: edges `h1_statistic --> fe_live` and `--> fe_archives`, flow entries, panel text and tags. `players` lives on `h1_statistic` | `src/db/queries/getCampaign.mjs:73`, `src/db/queries/getCampaign.mjs:113`, `prisma/schema.prisma:190` |
| `dataFlowConfig.mjs:180` and `seed_files` panel. Extra drift | Seed "processed through the same normalization pipeline used by live updates" | The script writes `h1_season`, `h1_status` and `h1_event` with its own inlined copy of the bucket math, because it cannot import `@/*` aliases | `prisma/seed/seed.mjs:40`, `prisma/seed/seed.mjs:88`, `prisma/seed/seed.mjs:116`, `prisma/seed/seed.mjs:152` |
| Class: worker versus lease-holder polling | `page.mdx:34`, `worker` and `lease` panels, cycle text | Checked, no drift: every replica runs the thread, the lease claim comes first, a non-holder answers standby | `src/app/api/h1/update/route.js:87`, `src/app/api/h1/update/route.js:93`, `src/update/lease.mjs:45` |
| Judgment: edges from `api_status` and `api_snapshot` into `worker` stay | The diagram has no update-route node | Left as is: its `worker` node stands for the thread plus the route it calls, and the `worker` panel says that only the lease holder polls | `public/workers/cronLogic.js:30`, `src/app/api/h1/update/route.js:121` |
| Class: file paths | Every path the five files name | Checked with `git ls-files`: `src/sw.js`, `public/workers/cron.js`, `src/update/lease.mjs`, `prisma/seed/seed.mjs`, `prisma/seed/seasons`, `scripts/analysis` all exist | `prisma/seed/seed.mjs:1`, `public/workers/cron.js:34` |
| Class: auth providers | none named in the architecture files | Checked, no statement to correct | `src/auth.js:29` |
| Checked, no drift | Client Polling fence, Confirm Pattern, On-Demand Fetching, `fe_rebroadcast`, `api_status` shape, region 1-10 and 11 | Fence: 10 s poll, leader election, `getCampaign` and `computeMapState`; confirm sets `last_updated` in the last step; archive seasons come from the active season number; the rebroadcast reads four tables; the status response shape matches the validator | `src/shared/hooks/useLiveData.mjs:31`, `src/app/api/h1/live/route.js:13`, `src/update/status.mjs:138`, `src/app/archives/page.jsx:53`, `src/db/queries/rebroadcast.mjs:47`, `src/validators/isValidStatus.mjs:4`, `src/shared/enums/worlds.mjs:2` |
| Why plan 02-05 missed it | Its check inventoried the lease drift and the interval wording | It did not read the service-worker sentence against `src/sw.js`, nor the panels and edges against `prisma/schema.prisma` and the readers of each table | `src/sw.js:6`, `prisma/schema.prisma:117` |
| Extra check: private infrastructure detail (D-06, T-02-57) | none found | No IPv4 address, host name, node label or secret name in the three files and the edits | `src/app/docs/architecture/dataFlowConfig.mjs:6`, `src/app/docs/architecture/dataFlowDefinition.mjs:12` |

Lane commit: 5087ee615207218dc4354202a9d435731c3d85cf

Page architecture: CHECKED

## Gap closure: /docs (overview)

Plan 02-16 re-read `page.mdx`, `overviewConfig.mjs` and `overviewDefinition.mjs` statement by statement at the lane commit below, in D-01 source order (02-REVIEW.md WR-04).

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/overviewDefinition.mjs:28` | Edge `worker --> hd1`: the worker thread only calls the update route | Edge `api_update --> hd1`; the lease holder's update route calls the official API. `worker --> api_update` stays | `public/workers/cronLogic.js:30`, `src/app/api/h1/update/route.js:121`, `src/update/fetch.mjs:8` |
| `src/app/docs/overviewConfig.mjs:21` (`dash` subtitle) | `src/app/(app)/page.jsx`: that route group does not exist | `src/app/page.jsx` | `src/app/page.jsx:65` |
| `overviewConfig.mjs:103` (`auth_api` text) | "Discord and GitHub OAuth flows" | "Discord, GitHub and Google OAuth flows" | `src/auth.js:39`, `src/auth.js:43`, `src/auth.js:47` |
| Class: worker versus lease-holder polling | `worker`, `api_update` and `hd1` panels, edge labels | Checked, no further drift after the edge fix | `src/app/api/h1/update/route.js:87`, `public/workers/cron.js:34` |
| Class: file paths | Every subtitle path and the `page.mdx` links | Checked with `git ls-files`: every subtitle path and the thirteen linked docs routes exist | `src/app/archives/page.jsx:53`, `src/app/profile/page.jsx:12` |
| Class: auth providers | `auth_api` text, `profile` text, `page.mdx` Authentication blurb | Fixed above; the 503 when `BETTER_AUTH_SECRET` is absent and the profile redirects match | `src/app/api/auth/[...all]/route.js:10`, `src/app/profile/page.jsx:15` |
| Class: service worker, scalar versus array types | none on the overview page | Checked, no statement to correct | `src/sw.js:6` |
| Checked, no drift | `dash` 10 s poll, `api_live` without authentication, `api_rb` with API key, `archives` season range, `db` table list, `hd1` URL | All match | `src/shared/hooks/useLiveData.mjs:31`, `src/app/api/h1/live/route.js:13`, `src/app/api/h1/rebroadcast/route.js:28`, `src/app/archives/page.jsx:53`, `src/update/fetch.mjs:8` |
| Not checkable in the repo | `hd1` panel: "Updates roughly every second" | Left as is: the official API's own update rate is outside this repository | `src/update/fetch.mjs:8` |
| UI review: Rebroadcast label | `src/app/docs/page.mdx:39` labels `/docs/api` "Rebroadcast" (02-UI-REVIEW.md) | Not edited: a label choice, not a contradiction. Result: out of scope, DOCS-03 | `src/app/docs/page.mdx:39` |
| UI review: testing blurb | `src/app/docs/page.mdx:47` lists unit and smoke tests, not visual regression (02-UI-REVIEW.md) | Not edited: an incomplete list, not a contradiction. Result: out of scope, DOCS-03 | `src/app/docs/page.mdx:47` |
| Why plan 02-05 missed it | Its check inventoried the lease and interval drift | It did not read the diagram edges against the call path, nor the Dashboard path and OAuth list against the route files and `src/auth.js` | `src/auth.js:29`, `public/workers/cronLogic.js:30` |
| Extra check: private infrastructure detail (D-06, T-02-57) | none found | No IPv4 address, host name, node label or secret name in the three files; the official API host in the `hd1` node was already public | `src/app/docs/overviewDefinition.mjs:21`, `src/app/docs/overviewConfig.mjs:21` |

Lane commit: 5087ee615207218dc4354202a9d435731c3d85cf

Page overview: CHECKED

## Gap closure: /docs/notifications

Plan 02-17 re-read the seven notifications files (`page.mdx`, the three config and definition pairs, `pushFlowConfig.mjs` and `pushFlowDefinition.mjs`) at the lane commit below, for every lease line and every statement of the five classes. The notifications page is an extra site of DOCS-02 (D-07), so drift outside those two groups is recorded and left (02-VERIFICATION.md truth 2; 02-REVIEW.md WR-03).

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/notifications/notificationFlowConfig.mjs:37,44` (`worker` panel, WR-03) | "Dedicated Worker Thread that polls the official Helldivers 1 API every ~20 seconds"; Poll interval row "UPDATE_INTERVAL env (default 20s)" | "Every replica runs it, and it calls POST /api/h1/update ... every UPDATE_INTERVAL seconds. Only the poller lease holder polls the official Helldivers 1 API."; row "UPDATE_INTERVAL env (required; 20 in both stacks)" | `public/workers/cronLogic.js:30`, `src/update/lease.mjs:45`, `src/config/server.mjs:37`, `src/shared/utils/initializeWorker.mjs:30`, `deploy/production/compose.yaml:79`, `deploy/staging/compose.yaml:74` |
| `src/app/docs/notifications/inAppFlowDefinition.mjs:23` | Edge `hd1_api --> worker`: the worker thread only calls the update route | Edge `hd1_api -->\|"lease holder fetches"\| post_update`; `worker --> post_update` stays; the 12 node ids are unchanged | `src/app/api/h1/update/route.js:87`, `src/update/fetch.mjs:8` |
| `src/app/docs/notifications/inAppFlowConfig.mjs:25` (`hd1_api` panel) | "the worker polls less frequently to avoid overload" | "Only the poller lease holder fetches it, once per UPDATE_INTERVAL seconds." | `src/app/api/h1/update/route.js:93`, `deploy/production/compose.yaml:79` |
| `src/app/docs/notifications/page.mdx:220,256` | The web app manifest is at `src/app/site.webmanifest` | `public/site.webmanifest`; the file under `src/app/` does not exist | `public/site.webmanifest:1`, `src/app/layout.jsx:66` |
| `src/app/docs/notifications/page.mdx:202-207` (§ Caching Strategy), class: service worker caching | One row "Static assets: Stale-while-revalidate": the `/_next/static` scripts and the site's own audio and video are cache-first | Two rows: cache-first for `/_next/static` scripts, the site's own audio and video; stale-while-revalidate for the site's own images, fonts, other scripts and stylesheets. The NetworkOnly and network-first rows stay. Same groups as the plan 02-16 clause on /docs/architecture (Serwist 9.5.13) | `src/sw.js:12`, `src/sw.js:15` |
| `src/app/docs/notifications/page.mdx:192`, class: service worker lifecycle. Extra drift | "Serwist handles registration automatically via the `register: true` config option" | Sentence removed. No `register` option exists in `serwist.config.js`, and no code under `src/` registers the worker. Replaced by the header that `next.config.mjs` sends for `/sw.js`, which is why the browser checks for a new version on each navigation | `serwist.config.js:8`, `next.config.mjs:151`, `src/sw.js:6`, `src/sw.js:7` |
| `src/app/docs/notifications/notificationFlowConfig.mjs:60,66` (`update` panel), `:221` (`db` panel), `inAppFlowConfig.mjs:47` (`post_update` panel). Lease lines | The update route is described as running for every call; the sequence has no lease step; the `db` panel says "The worker writes campaign status and snapshots" | The lease holder runs the updates; a replica without the lease answers standby; the sequence gains step 2 `claimLease()`; the `db` panel names the Update Route on the lease holder as the writer | `src/app/api/h1/update/route.js:87`, `src/app/api/h1/update/route.js:93`, `src/update/lease.mjs:45` |
| Class: worker versus lease-holder polling | Every statement on the seven files | Fixed above; `pushcheck`, `check_notify` and the page's "Client vs Server" text already say the baseline is the lease-row snapshot and match the code | `src/update/pushNotifier.mjs:118`, `src/app/api/h1/update/route.js:200`, `prisma/schema.prisma:249` |
| Class: file paths | Every path the seven files name | Checked with `git ls-files`: the update, live and subscribe routes, `src/sw.js`, `serwist.config.js`, `public/workers/cron.js`, `src/update/pushNotifier.mjs`, the hook, guard and toast files and `src/db/queries` all exist; the manifest path is fixed above | `src/app/api/notifications/subscribe/route.js:42`, `src/shared/utils/reloadGuard.mjs:4`, `src/features/notifications/LiveToasts.jsx:4` |
| Class: auth providers | none named in the seven files | Checked, no statement to correct | `src/auth.js:29` |
| Class: scalar versus array types | `prevEvents` and the event arrays | Checked, no drift: `prevEvents` is an object array or null, and the column is `Json?` | `src/update/pushNotifier.mjs:115`, `prisma/schema.prisma:249` |
| Checked, no drift | 10 s poll, visibility poll, leader election, 30 s TTL and 3 attempts, 60 s reload delay, `Object.freeze(INITIAL_STORE)`, first-message baseline, 50 concurrent pushes, 410 and 404 cleanup, Zod 2048 and 256 limits, same-origin icon and badge, `no-store` on the live endpoint, `skipWaiting` and `clientsClaim` | All match | `src/shared/hooks/useLiveData.mjs:31`, `src/shared/hooks/useLiveData.mjs:34`, `src/shared/utils/reloadGuard.mjs:5`, `src/update/pushNotifier.mjs:9`, `src/app/api/notifications/subscribe/route.js:12`, `src/sw.js:60`, `src/app/api/h1/live/route.js:25` |
| Kept deferral (D-07, Phase 18 DOCS-03) | The four `POST /api/h1/update` labels (`src/app/docs/notifications/notificationFlowConfig.mjs:37`, `src/app/docs/notifications/inAppFlowDefinition.mjs:7`, `src/app/docs/notifications/inAppFlowConfig.mjs:36`, `src/app/docs/notifications/pushFlowDefinition.mjs:4`). The route answers GET | Left as is. The new `worker` text keeps the label | `public/workers/cronLogic.js:30`, `src/app/api/h1/update/route.js:63` |
| Kept deferral (D-07, plan 02-05 decision) | The `polls every ~20s` node labels in `notificationFlowDefinition.mjs:5` and `inAppFlowDefinition.mjs:6` | Left as is: correct for the deployed value, and the worker does poll the update route | `deploy/production/compose.yaml:79`, `deploy/staging/compose.yaml:74` |
| Out of scope, DOCS-03 (unchanged) | `page.mdx:226` says `themeColor: #282828` | The layout sets `#1c1b1b` | `src/app/layout.jsx:58` |
| Out of scope, DOCS-03 (unchanged) | `page.mdx:214` names the offline cache key `hd1-live-cache` | The key is `hd1-live-cache-v1`; the `hook` panel already says so | `src/shared/hooks/useLiveData.mjs:30` |
| Out of scope, DOCS-03 (unchanged) | `page.mdx:132` and the `toast` panel: toasts sit bottom-right | Desktop is bottom-right; mobile is top-center | `src/features/notifications/LiveToasts.jsx:147` |
| Out of scope, DOCS-03 (unchanged) | Panels and page name `computeMapState()` for the live endpoint | The route calls `computeLiveMapState`, a wrapper | `src/app/api/h1/live/route.js:8` |
| Open question for plan 02-19 | Where the service worker gets registered | The repo shows no registration call and no `register` option; the page now makes no claim. Only a browser check can show whether the worker registers | `src/features/notifications/NotificationToggle.jsx:47` |
| Why plan 02-05 missed it | Its check fixed the in-memory baseline wording and recorded the POST and `~20s` labels as deferred | It did not read the worker and HD1 panels against the update route and the lease, the manifest path against the tree, or the caching and registration sentences against `src/sw.js` and the config | `src/sw.js:6`, `src/update/lease.mjs:45` |
| Extra check: private infrastructure detail (D-06, T-02-61) | none found | No IPv4 address, host name, node label or secret name in the seven files and the edits; the edits name repo paths and env var names only | `src/app/docs/notifications/notificationFlowConfig.mjs:37`, `src/app/docs/notifications/page.mdx:256` |

Lane commit: af0f68468405149f07a25c1b03613cdfb96ac83a

Page notifications: CHECKED
