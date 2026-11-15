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

Page architecture: CHECKED

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

Page overview: CHECKED

## /docs/notifications

| Item | Stale statement | Fix | Code evidence |
|------|-----------------|-----|---------------|
| `src/app/docs/notifications/page.mdx:115` | "Keeps previous events in memory ... Resets on server restart (acceptable — misses one transition at most)" | The previous event snapshot is stored in the lease row (`worker_heartbeat.prev_events`); the update route passes it in and writes the new snapshot back after each check; a restart or a handover neither misses nor repeats a push. The restart caveat is removed | `src/app/api/h1/update/route.js:200`, `src/app/api/h1/update/route.js:206`, `src/update/pushNotifier.mjs:118` |
| `src/app/docs/notifications/notificationFlowConfig.mjs:175` (`pushcheck` panel) | "Keeps previous events in memory"; table row `Reset: On server restart (ok)` | "Compares against the previous event snapshot in the lease row (worker_heartbeat.prev_events)"; row `Baseline: Lease row, survives restarts` | `src/update/pushNotifier.mjs:146`, `src/app/api/h1/update/route.js:206` |
| `src/app/docs/notifications/pushFlowConfig.mjs:36` | "keeps previous events in memory. Resets on server restart" | The same fact in one sentence: the baseline is the lease-row snapshot, so restarts and handovers neither miss nor repeat a push | `src/update/pushNotifier.mjs:115`, `src/app/api/h1/update/route.js:206` |
| Out of scope, DOCS-03 (unchanged) | The three notifications diagrams label the update route `POST /api/h1/update` (`src/app/docs/notifications/inAppFlowDefinition.mjs:7`, `src/app/docs/notifications/pushFlowDefinition.mjs:4`, `src/app/docs/notifications/inAppFlowConfig.mjs:36`, `src/app/docs/notifications/notificationFlowConfig.mjs:37`). The worker calls it with GET | Left as is: D-07 limits this plan to the lease lines | `public/workers/cronLogic.js:30`, `src/app/api/h1/update/route.js:63` |
| Out of scope, DOCS-03 (unchanged) | "polls every ~20s" in `src/app/docs/notifications/notificationFlowDefinition.mjs:5` and `src/app/docs/notifications/inAppFlowDefinition.mjs:6`; "polls ... every ~20 seconds" in `notificationFlowConfig.mjs:37` | Left as is: the cadence is `UPDATE_INTERVAL` (20 s on both stacks), and the "~20s" label is correct for the deployed value | `deploy/production/compose.yaml:79`, `deploy/staging/compose.yaml:74` |

Lane commit: 0f2a2432d907e3ccb75f1e95fdf7a6d347e0c7cb

Page notifications: CHECKED
