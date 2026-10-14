# Phase 2: Docs Accuracy & Operational Housekeeping - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.
> Exception: CONTEXT.md D-12 names § Drift Inventory below as the executor's starting checklist.

**Date:** 2026-10-14
**Phase:** 02-docs-accuracy-operational-housekeeping
**Mode:** assumptions
**Areas analyzed:** Ground truth and DOCS-01, DOCS-02 scope, HOUSE-03 sourcemap strip, HOUSE-04 and HOUSE-05, Release

## Assumptions Presented

### Ground truth and DOCS-01
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Live code is the reference; fix 3 wrong map lines; regenerate `.claude/CLAUDE.md` | Likely | `.planning/codebase/STACK.md:85`, `ARCHITECTURE.md:125,130`, `deploy/staging/compose.yaml:58-66,114`, `src/update/season.mjs:10-12` |
| DOCS-01 rewrites AGENTS.md:187-220 and the 3 comments still describing #516 | Likely | `src/update/lease.mjs:5-14`, `route.js:75-77,89-90`, `initializeWorker.mjs:2-6`, `.example.env:11-13` |
| `.claude/CLAUDE.md` is regenerated, never hand-edited | Confident | `.gitignore:58`, GSD `source:codebase/STACK.md` markers |

### DOCS-02 scope
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| 5 pages + ~6 lease lines on notifications and the docs index | Likely | `notifications/page.mdx:115`, `route.js:189-195`, `pushNotifier.mjs:115` |
| Testing page: non-layout fixes now, tree → rule statement | Likely | ROADMAP Phase 3 criterion 4 names only CLAUDE.md § Test Layout; `testing/page.mdx:27-35,68-90` list non-existent dirs |

### HOUSE-03 sourcemap strip
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| #502 gate met | Confident | GlitchTip HELLDIVERSBOT-6C event `69dc63bf…`, release 0.95.2, production, `29db8qr-sdvxo.js:2:2648` → `NotificationToggle.jsx:118` |
| Two-part change: delete line 15 + `deleteSourcemapsAfterUpload: true` | Likely | `next.config.mjs:15,212-222`; SDK `getFinalConfigObjectBundlerUtils.js:108-110`, `getBuildPluginOptions.js:125-137,181` |
| 3-check verification (image maps, 404, symbolicated event) | Confident | `Dockerfile.app:107,131-139` (distroless); main-checkout build: 142 maps / ~24.6 MB in `.next/static` |

### HOUSE-04 and HOUSE-05
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| #501 closes on the real run | Confident | run 35578125172 → PR #531 (`season-160.json` only) → merged 2026-09-21, commit `76865ef3` |
| Two workflow gaps exist | Confident | `gh pr checks 531`: no checks; check-runs total_count 0; `scheduled-seed-refresh.yml:49,59-63` |
| `docs/roadmap.md` → pointer; #469 needs a requirement first | Likely | #469 OPEN, not in REQUIREMENTS.md or ROADMAP.md; refs at AGENTS.md:220, PROJECT.md:47,49,63,91 |

### Release
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| One release at phase end | Unclear → asked | `build-release.yml:3-5` (tags only); HOUSE-03 criterion 3 needs production |

## Corrections Made

No corrections — all assumptions confirmed. Andrei answered three open questions:

### Release
- **Question:** Release at the end of Phase 2?
- **Answer:** One release at phase end (recommended option).

### Production topology
- **Question:** How does production run the app?
- **Answer (free text):** "today it's a single container. We will be moving it to the swarm cluster, where at least 2 replicas will exist of the app, talking to the same db."
- **Effect:** CONTEXT.md D-04..D-06; the swarm move goes to Deferred.

### Seed-refresh gaps
- **Question:** Record the 2 gaps or fix them in Phase 2?
- **Answer:** Record, close #501, open a new issue (recommended option).

## Derived by Claude (not asked)
- D-21: the Phase 2 release waits for Phase 1's STAB-06 window (ends 2026-10-16T11:22:13Z), so v0.95.2's GlitchTip re-count stays clean.
- D-18: #469 becomes ARCH-10 in Phase 11 before `docs/roadmap.md` is retired.

## External Research
- GlitchTip MCP (2026-10-14): HELLDIVERSBOT-6C symbolicated on release 0.95.2 (D-13).
- GitHub: #469 open; PR #531 zero check runs; season 161 active on production `/api/h1/live`.

## Drift Inventory

Starting checklist for the executor (re-verify each against code before editing). Paths relative to repo root.

**AGENTS.md** (~12-15 lines)
- :187 both paths write `h1_statistic`/`h1_event_progress` → `updateSeason` writes only `h1_status` of the shared tables (`season.mjs:10-12`).
- :188 "~15 seconds" → `UPDATE_INTERVAL` 20 on staging and in `.example.env:9`; production value not stated.
- :189 module-level `lastSeasonObserved` → lease row (`route.js:84-91`, `:144`); restart edge case gone.
- :191 no lease → every replica spawns the thread unless `WORKER_ENABLED=false` (`initializeWorker.mjs:21-26`); 60 s TTL (`lease.mjs:20,42-75`); standby (`route.js:89-90`); thread death → `process.exit(1)` (`initializeWorker.mjs:63-70`); staging 2 replicas.
- :195 tracesSampleRate 0.1 prod → client only (`instrumentation-client.js:23`); server 1.0 (`sentry.server.config.js:25`).
- :200 `updateSeason` writes `h1_statistic` + `h1_event_progress` → it does not.
- :203 push baseline `prevEvents` lives in the lease row — not stated.
- :210 "Phase 6/7/9" → old milestone numbers, collide with GSD phases.
- :211-212 `TimelineSection`, `ConnectionStatus` → `src/features/timeline/EventLog.jsx` (commit `1cc13141`), `src/shared/components/LastUpdated.jsx`.
- :220 `docs/roadmap.md` → `.planning/ROADMAP.md`.

**Code / env / maps still describing #516** (~15 lines)
- `src/app/api/h1/update/route.js:75-77`; `src/shared/utils/initializeWorker.mjs:2-6`; `.example.env:11-13`; `public/workers/cron.js:12` ("Spawned by src/instrumentation.js" → `instrumentation.node.js` → `initializeWorker`).
- `.planning/codebase/STACK.md:85`, `ARCHITECTURE.md:125`, `ARCHITECTURE.md:130`; generated `.claude/CLAUDE.md:87`.

**src/app/docs/architecture/** (~10-15 lines)
- `page.mdx:32-34` "polls every 5-15 seconds", no lease/replicas.
- `dataFlowConfig.mjs:125-140` worker node has no lease/standby.
- `dataFlowConfig.mjs:153` seed via `prisma db seed` → `node --experimental-strip-types prisma/seed/seed.mjs` (`Dockerfile.migrate:166`).
- `dataFlowConfig.mjs:121` file list ends at `season-155.json` → 160 files.

**src/app/docs/data-flow/page.mdx** (~70-90 lines + ~15-line lease subsection)
- :4 and `docs/page.mdx:32` "two-table strategy, snapshot throttling".
- :55 `style Raw` targets a removed subgraph.
- :90 season pipeline "on-demand" → every poll with `protectedBucket` (`route.js:149-152`).
- :102-123 `initializeOpenApiSpec()` (gone); missing `instrumentation.node.js` step and `WORKER_ENABLED` branch.
- :142-155 `?key=` URL → `Bearer` header, `X-Worker-Startup` on first poll, GlitchTip heartbeat POST (`cronLogic.js:27-35`).
- :177-180 exit handler without `process.exit(1)`.
- :200 `?key=`; §3 lacks lease claim / standby.
- :441 "not called on a schedule" → every poll (`route.js:150`).
- :460-462 module-level state + restart edge case → lease row.

**src/app/docs/infrastructure/page.mdx** (~150-220 lines)
- :24-25 `Dockerfile` + `npm start` → `Dockerfile.app`, `CMD ["server.js"]` (`:146`).
- :43,80 only `:staging` tag → also `:sha-<commit>` (`build-staging.yml:210`).
- :47-57 Dockerfile.migrate steps changed (no npm 11.7.0 upgrade, copies validators, `USER node`; `Dockerfile.migrate:38-166`).
- :86-103 base `node:24` Debian (`Dockerfile.app:8`); runtime distroless `nodejs24-debian12:nonroot` uid 65532, no tini (`:107,131-139`); healthcheck node fetch, 30 s start period (`:150-151`).
- :95,171 staging `NODE_ENV=staging` → `production` (`build-staging.yml:158,212`).
- :105-125, :448 `docker-compose.yml`: `env_file` `.env.development`, port `127.0.0.1:50001`, no `SKIP_MIGRATIONS`.
- :155,177,183,185,201 old workflow names: `staging.docker.yml`→`build-staging.yml` (triggered by `Check: CI`), `release.docker.yml`→`build-release.yml`, `metrics.yml`→`scheduled-pagespeed.yml`, `ci.yml`→`check-ci.yml`.
- §2 missing check-codeql, check-dependencies, check-docker-smoke, check-migrate-arm64, check-version, scheduled-seed-refresh; merge-migrate, per-arch migrate runners, `bump-staging-tag` + Arcane Git Sync, amd64/arm64 app build (`build-release.yml:64`).
- :159 "develop accepts direct merges without a PR" → PR-only.
- :199 release body from `RELEASE.md` → awk-extracted from `CHANGELOG.md` (`build-release.yml:177-180`).
- No deployment-topology section (`deploy/README.md:9-33`) → add per D-10.
- :211-265 `initializeOpenApiSpec`, `src/utils/initialize.openapi.mjs` (gone); missing `WORKER_ENABLED` branch.
- :306 tracesSampleRate 1.0; :373-381 `silent: true`, wrapper always applied → no `silent`, wrapper only with `SENTRY_AUTH_TOKEN` (`next.config.mjs:211-222`).
- :399-432 env table: missing `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`, `FORCE_SEED`, `*_FILE` convention (`src/shared/utils/hydrateFileSecrets.mjs`); :429 `POSTGRES_SSL` removed (`_meta/exampleEnv.test.mjs` asserts absent); :430 `SKIP_MIGRATIONS` unused.

**src/app/docs/database/page.mdx** (~70-90 lines)
- `Review` (ER :130,174-178; §5 :507-519) and `App` (ER :187-191; §7 :561-573) dropped by `20260416091157_drop_unused_tables`.
- `worker_heartbeat` (ER :193-200; §8 :579-594): missing `holder_id`, `lease_until`, `prev_events`, `last_season_observed` (`schema.prisma:237-250`); `worker_type` is `'cron_api_poller'` (`lease.mjs:19`); `started_at` resets on holder change (`lease.mjs:61-63`); written by `claimLease` + `route.js:47-59`, not `cron.js`.
- `api_rate_limit` (`schema.prisma:258-266`) missing from ER, model sections, index table (:602-627).
- 19 cells say `TIMESTAMPTZ` → `TIMESTAMP(3)` (no `@db.Timestamptz`; `lease.mjs:46-50`).
- :41,51 `dotenv/config` → `prisma.config.mjs:1-3` loads `.env.development` then `.env`.
- `h1_*` and `push_subscription` models match.

**src/app/docs/testing/page.mdx** (~15 non-layout lines + ~40 layout lines → rule statement per D-11)
- :22 "euraika/aegis" conventions — remove.
- :27-35, :68-90 non-existent dirs (`utils/`, `queries/`, `routes/`); real: `_meta`, `app`, `config`, `db`, `features`, `shared`, `update`, `validators`, `workers`, plus `auth.test.mjs`, `utils/hd1.mjs`.
- No mention of the mirror rule / `mirrorTree.test.mjs`.
- :107 `npm test` runs unit then smoke → `vitest run`, unit only (`package.json:15`); `test:smoke`, `test:all` missing.
- :114 instruction aimed at AI assistants on a public page — remove.
- :137 "malformed enum files" → 3 exclude globs (`vitest.config.mjs:30-35`).
- :224-230 no `.jsx`, qualifier segment, contract/integration escape hatches.
- :256-261 no `TEST_SERVER_URL`, fail-when-no-server, `SMOKE_ALLOW_SKIP` (`src/__tests__/smoke/smoke.test.mjs:1-21`).
- :282 `ci.yml` → `check-ci.yml`.

**Other pages — lease lines only** (~6 lines)
- `src/app/docs/notifications/page.mdx:115`, `notificationFlowConfig.mjs:175`, `pushFlowConfig.mjs:36`: push dedup "in memory" → lease row.
- `src/app/docs/overviewConfig.mjs:92` "Internal POST endpoint" → GET; POST is `methodNotAllowed` (`route.js:61,212`).

**docs/roadmap.md references (HOUSE-05)**
- Edit: AGENTS.md:220, `.planning/PROJECT.md:47,49,63,91`.
- Keep: REQUIREMENTS.md:37, ROADMAP.md:96 (requirement text), `.planning/research/{ARCHITECTURE,FEATURES,PITFALLS,SUMMARY}.md`, CHANGELOG.md:474,1551,1559.
- Content not in `.planning/`: prep ladder (`docs/roadmap.md:28-43`), per-issue prediction unblock gates (`:233-238`), feature-reach table (`:352-376`), #469 (→ D-18).

**Analyzer caveats:** no build ran in the worktree; image-size/`.map` counts come from an existing main-checkout build that may lack a Sentry token.
</content>
</invoke>
