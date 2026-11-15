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
