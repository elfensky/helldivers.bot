# Phase 2: Docs Accuracy & Operational Housekeeping - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.
> Exception: CONTEXT.md D-12 names § Drift Inventory below as the executor's starting checklist.

**Date:** 2026-10-14; refreshed 2026-10-23 against develop 0.95.7 (c479fde1)
**Phase:** 02-docs-accuracy-operational-housekeeping
**Mode:** assumptions
**Areas analyzed:** Ground truth and DOCS-01, Topology, DOCS-02 scope and drift status, HOUSE-03 sourcemaps under Sentry 11, HOUSE-04/05 and requirement IDs, Release and process, WR-07/WR-08 triage

## Why a refresh

The 2026-10-14 context sat on an unmerged lane while develop moved 34 commits (Phase 1 close-out,
Dependabot round 0.95.3-0.95.7 incl. Sentry 10 → 11, vitest 4 → 5, mermaid 11 → 12). Every
decision was re-verified against today's code by a `gsd-assumptions-analyzer` run; the result is
below. Files relevant to Phase 2 that changed in that window: `48c056ee` (Sentry 11 scope text in
`INTEGRATIONS.md`, `STACK.md`, `infrastructure/page.mdx:302-313,375`), `f58e3052`
(`next.config.mjs:1` import), `1acff117` (`testing/page.mdx:271`, `STACK.md`, `TESTING.md`),
`fd0bd38c` (`scheduled-seed-refresh.yml` setup-node bump), `24011345` (`vitest.visual.config.mjs`).
Not changed: AGENTS.md, `.example.env`, `route.js`, `initializeWorker.mjs`, `public/workers/`,
`deploy/`, `docs/roadmap.md`, both Dockerfiles.

## Assumptions Presented (2026-10-23)

### Ground truth and DOCS-01
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| D-01 stands: live code + `deploy/` is the reference | Confident | `deploy/` unchanged since a3c10813 |
| D-02 changes: 5 wrong map lines + PROJECT.md:72; regenerate `.claude/CLAUDE.md` | Confident | `INTEGRATIONS.md:80` "3 app replicas"; `ARCHITECTURE.md:127` vs `status.mjs:101,118`; `.claude/CLAUDE.md:13,44,62-64,87` stale |
| D-03 stands, line numbers refreshed (`cron.js:13`, AGENTS.md 184-206/210-212/220) | Confident | none of the files changed |

### Topology
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| D-04..D-06 stand (from Andrei) | Confident | `docker-compose.yml:2-23`; `compose.yaml:58-67,76,114`; `deploy/README.md:16-29`; `.example.env:10` |

### DOCS-02 scope and drift status
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| D-07, D-08, D-09, D-12 stand; every inventory item still stale except `testing:271` | Confident | table below |
| D-10 changes: infrastructure also documents the post-HOUSE-03 Sentry block | Confident | `infrastructure/page.mdx:373-387` (`silent: true` at :379); `CONCERNS.md:50-53` |
| D-11 stands + remove `testing:11` | Confident | `:271` fixed by 1acff117; `:280,296` true via `vitest.visual.config.mjs:12-14` |
| NEW D-23: browser render-check of edited Mermaid blocks under mermaid 12 | Likely | f58e3052 re-rendered nothing; `data-flow:55` styles a removed subgraph |
| NEW: `utilities/page.mdx:849` has no lease text (old note wrong) | Confident | grep `lease|holder|standby` empty |

### HOUSE-03 sourcemaps under Sentry 11
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| D-13 stands as the gate (0.95.2 proof) | Confident | #502 has 0 comments |
| D-14 stands with v11 evidence; keep explicit `deleteSourcemapsAfterUpload: true` | Confident / Likely | `getFinalConfigObjectBundlerUtils.js:127-129,135-146`; `getBuildPluginOptions.js:128-139,184`; `handleRunAfterProductionCompile.js:43-58`; `types.d.ts:391`; Turbopack build (`package.json` build) |
| D-15, D-16 stand; measure in a lane after `npm ci` | Confident | `Dockerfile.app:107,137,138`; main checkout `node_modules` = Sentry 10 |
| NEW D-24: prove Sentry 11 symbolication before the strip | Likely | lockfile swaps `@sentry/cli` for `@sentry/bundler-plugins` 11.8.0 + `sentry` 0.45.0; staging run 39574238756 uploads OK |
| NEW: HOUSE-03 resolves IN-03 | Confident | `01-REVIEW.md:207-214`; `next.config.mjs:1` already fixed |

### HOUSE-04/05 and requirement IDs
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| D-17 stands; Mondays, 4 runs no PR, merge commit `66093080`, both gaps still present | Confident | `scheduled-seed-refresh.yml:5,49,59,62,65`; `prisma/seed/readme.md:49-51` |
| D-18 changes: ARCH-11 (not ARCH-10), Phase 11 | Likely | `REQUIREMENTS.md:86` holds ARCH-10; `ROADMAP.md:224-238` Phase 11 ARCH-05 |
| D-19 changes (line numbers): PROJECT.md 49,51,65,93; CHANGELOG 566,1643,1651 | Confident | PROJECT.md rewritten 2026-10-21 |
| D-20 stands | Confident | `docs/roadmap.md` last change bb01517d |

### Release and process
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| D-21 changes: two releases (gap at STAB-07 limit; Sentry 11 proof) | Likely → asked | main v0.95.2, develop 0.95.7, `## Unreleased` empty; `REQUIREMENTS.md:21` |
| D-22 changes: Version Bump check covers `src/**`, `prisma/**`, `public/**`, `package.json` only | Confident | `check-version.yml:10` |

### WR-07/WR-08 triage
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| NEW D-25: WR-07 → issue, defer to Phase 5 (not a ride-along) | Likely | `next.config.mjs:65-74`; no UMAMI build arg in `Dockerfile.app`; no existing issue |
| NEW D-26: WR-08 → issue, defer | Likely → asked | `next.config.mjs:193-199`; `layout.jsx:84-91,237`; no existing issue |

## Corrections Made

No corrections to the analyzer's assumptions. Andrei answered the two open questions (2026-10-23):

### Release
- **Question:** One release at phase end, or two?
- **Answer:** Two releases (recommended): 0.95.7 now as the Sentry 11 symbolication proof; HOUSE-03 + docs at phase end.
- **Effect:** D-21 rewritten; D-24 added; D-15 check 3 moves to the phase-end release.

### WR-08
- **Question:** File an issue and defer, or ride along with the HOUSE-03 `next.config.mjs` PR?
- **Answer:** File an issue and defer (recommended).
- **Effect:** D-26; the cookie-exclusion fix goes to Deferred.

### Carried from 2026-10-14 (not re-asked)
- Production topology (free text): "today it's a single container. We will be moving it to the swarm cluster, where at least 2 replicas will exist of the app, talking to the same db." → D-04..D-06.
- Seed-refresh gaps: record, close #501, open a new issue → D-17.

## Derived by Claude (not asked)
- D-18: ARCH-11 in Phase 11 rather than Phase 15 (Map Visuals): #469 changes the archives map, and its own constraint says do not destabilise the live map.
- D-14: keep the explicit `deleteSourcemapsAfterUpload: true` although v11 defaults to it — one line that survives a default change.
- D-25: WR-07's natural home is Phase 5 (SEO-09) rather than an unscheduled Engineering Health issue.

## External Research
- GlitchTip MCP (2026-10-14): HELLDIVERSBOT-6C symbolicated on release 0.95.2 (D-13).
- GlitchTip MCP (2026-10-23): connector needed re-authentication; the Sentry 11 symbolication check could not run. Open item → D-24.
- GitHub (2026-10-23): #502, #501, #469 open, unchanged since August, 0 comments; no issue for WR-07/WR-08; seed-refresh runs 09-28, 10-05, 10-12, 10-19 all green, no PR; `prisma/seed/seasons/` ends at season-160.
- `@sentry/nextjs` 11.8.0 read from the lockfile-pinned tarball (integrity matches `package-lock.json:4930`), because the main checkout's `node_modules` is stale.

## Drift Inventory (re-checked 2026-10-23)

Starting checklist for the executor (re-verify each against code before editing). Paths relative to
repo root. Status: **stale** = still wrong today; **fixed** = already correct; **new** = found in the
refresh. Line numbers are current.

**AGENTS.md** (~12-15 lines)
- :187 stale — both paths write `h1_statistic`/`h1_event_progress` → `updateSeason` writes only `h1_status` of the shared tables (`season.mjs:10-12`).
- :188 stale — "~15 seconds" → `UPDATE_INTERVAL` 20 on staging and in `.example.env:10`; production value not stated.
- :189 stale — module-level `lastSeasonObserved` → lease row (`route.js:84-91`, `:144`); restart edge case gone.
- :191 stale — no lease → every replica spawns the thread unless `WORKER_ENABLED=false` (`initializeWorker.mjs:21-26`); 60 s TTL (`lease.mjs:20,42-75`); standby (`route.js:89-90`); thread death → `process.exit(1)` (`initializeWorker.mjs:61-69`); staging 2 replicas.
- :195 stale — tracesSampleRate 0.1 prod → client only (`instrumentation-client.js:24`); server 1.0 (`sentry.server.config.js:31`).
- :200 stale — `updateSeason` writes `h1_statistic` + `h1_event_progress` → it does not.
- :203 stale — push baseline `prevEvents` lives in the lease row — not stated (`route.js:188-196`).
- :210 stale — "Phase 6/7/9" → old milestone numbers, collide with GSD phases.
- :211-212 stale — `TimelineSection`, `ConnectionStatus` → `src/features/timeline/EventLog.jsx` (commit `1cc13141`), `src/shared/components/LastUpdated.jsx`.
- :220 stale — `docs/roadmap.md` → `.planning/ROADMAP.md`. (:222/:224 "Phase N" milestone wording adjacent; out of scope unless trivial.)

**Code / env / maps still describing #516** (~15 lines)
- `src/app/api/h1/update/route.js:75-77` stale; optional `:34` "~15s".
- `src/shared/utils/initializeWorker.mjs:2-6` stale.
- `.example.env:11-13` stale (`exampleEnv.test.mjs` asserts only `PORT`, `DEPLOY_ENV`, no `POSTGRES_SSL=` — comment edit safe).
- `public/workers/cron.js:13` stale (was cited as :12) — "Spawned by src/instrumentation.js" → `instrumentation.node.js:16` → `initializeWorker`.
- `.planning/codebase/STACK.md:85` stale; `ARCHITECTURE.md:125` stale; `ARCHITECTURE.md:130` stale; **new** `ARCHITECTURE.md:127` omits `h1_event_progress` from `updateStatus` (`status.mjs:101,118`); **new** `INTEGRATIONS.md:80` "Production runs 3 app replicas".
- `.claude/CLAUDE.md:87` stale, plus `:13,:44,:62-64` (old versions; `:13` comes from `PROJECT.md:72` "Vitest 4") — regenerate after the map and PROJECT.md fixes.

**src/app/docs/architecture/** (~10-15 lines)
- `page.mdx:34` stale — "polls every 5-15 seconds", no lease/replicas.
- `dataFlowConfig.mjs:125-150` stale — worker node has no lease/standby.
- `dataFlowConfig.mjs:153` stale — seed via `prisma db seed` → `node --experimental-strip-types prisma/seed/seed.mjs` (`Dockerfile.migrate:166`).
- `dataFlowConfig.mjs:121` stale — file list ends at `season-155.json` → 160 files.

**src/app/docs/data-flow/page.mdx** (~70-90 lines + ~15-line lease subsection)
- :4 and `docs/page.mdx:32` stale — "two-table strategy, snapshot throttling".
- :55 stale — `style Raw` targets a removed subgraph; render-check under mermaid 12 (D-23).
- :90 stale — season pipeline "on-demand" → every poll with `protectedBucket` (`route.js:149-152`).
- :102-123 stale — `initializeOpenApiSpec()` (gone); :117 "called from src/instrumentation.js"; missing `instrumentation.node.js` step and `WORKER_ENABLED` branch.
- :150-155 stale (url at :153) — `?key=` URL → `Bearer` header, `X-Worker-Startup` on first poll, GlitchTip heartbeat POST (`cronLogic.js:30-43`).
- :177-180 stale — exit handler without `process.exit(1)`.
- :200 stale — `?key=`; §3 lacks lease claim / standby.
- :441 stale — "not called on a schedule" → every poll (`route.js:150`).
- :460-462 stale — module-level state + restart edge case → lease row.

**src/app/docs/infrastructure/page.mdx** (~150-220 lines; lines after 302 moved +4 by 48c056ee)
- :24 stale — `Dockerfile` + `npm start` → `Dockerfile.app`, `CMD ["server.js"]` (`:146`).
- :43,80 stale — only `:staging` tag → also `:sha-<commit>` (`build-staging.yml:210`).
- :49-57 stale — Dockerfile.migrate steps changed (npm 11.7.0 step gone, copies validators, `USER node` at `Dockerfile.migrate:149`; alpine+tini still true `:38,47,152`).
- :88-103 stale — base `node:24` Debian (`Dockerfile.app:8`); runtime distroless `nodejs24-debian12:nonroot` uid 65532, no tini (`:107,131-139`); healthcheck node fetch, 30 s start period (`:150-151`).
- :95,171 stale — staging `NODE_ENV=staging` → `production` (`build-staging.yml:158,212`).
- :105-125, :452 stale — `docker-compose.yml`: `env_file` `.env.development`, port `127.0.0.1:50001`, no `SKIP_MIGRATIONS` (`docker-compose.yml:6-7,17-20`).
- :155,177,185,201 stale — old workflow names: `staging.docker.yml`→`build-staging.yml` (triggered by `Check: CI`), `release.docker.yml`→`build-release.yml`, `metrics.yml`→`scheduled-pagespeed.yml`, `ci.yml`→`check-ci.yml`.
- §2 (:133-205) stale — missing check-codeql, check-dependencies, check-docker-smoke, check-migrate-arm64, check-version, scheduled-seed-refresh; merge-migrate, per-arch migrate runners, `bump-staging-tag` + Arcane Git Sync, amd64/arm64 app build (`build-release.yml:64`). 10 workflow files today.
- :159 stale — "develop accepts direct merges without a PR" → PR-only.
- :199 stale — release body from `RELEASE.md` → awk-extracted from `CHANGELOG.md` (`build-release.yml:176-180`).
- missing — deployment-topology section (`deploy/README.md:9-33`) → add per D-04..D-06, D-10.
- :209-265 stale (refs :217, :250) — `initializeOpenApiSpec`, `src/utils/initialize.openapi.mjs` (gone); missing `WORKER_ENABLED` branch.
- :310 stale — tracesSampleRate 1.0.
- :373-387 stale — `silent: true` (:379), wrapper always applied → no `silent`, wrapper only with `SENTRY_AUTH_TOKEN` (`next.config.mjs:212-223`); import at :375 already fixed; must also show the post-HOUSE-03 block (D-10, D-14).
- :401-436 stale — env table: missing `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`, `FORCE_SEED`, `*_FILE` convention (`src/shared/utils/hydrateFileSecrets.mjs`); :433 `POSTGRES_SSL` removed; :434 `SKIP_MIGRATIONS` unused.

**src/app/docs/database/page.mdx** (~70-90 lines; file unchanged)
- `Review` (ER :130,174-178; §5 :507-519) and `App` (ER :187-191; §7 :561-573) stale — dropped by `20260416091157_drop_unused_tables`.
- `worker_heartbeat` (ER :193-200; §8 :577-594; index :627) stale — missing `holder_id`, `lease_until`, `prev_events`, `last_season_observed` (`schema.prisma:237-250`); `worker_type` is `'cron_api_poller'` (`lease.mjs:19`); `started_at` resets on holder change (`lease.mjs:61-63`); written by `claimLease` + `route.js:47-59`, not `cron.js`.
- `api_rate_limit` (`schema.prisma:258-266`) missing from ER, model sections, index table (:602-627).
- 19 cells say `TIMESTAMPTZ` → `TIMESTAMP(3)` (no `@db.Timestamptz`; `lease.mjs:46-50`).
- :41,51 stale — `dotenv/config` → `prisma.config.mjs:1-3` loads `.env.development` then `.env`.
- `h1_*` and `push_subscription` models match.

**src/app/docs/testing/page.mdx** (~15 non-layout lines + ~40 layout lines → rule statement per D-11)
- :11 **new** — "Audience: project owner and AI assistants" — remove.
- :22 stale — "euraika/aegis" conventions — remove.
- :27-35, :68-90 stale — non-existent dirs (`utils/`, `queries/`, `routes/`); real: `_meta`, `app`, `config`, `db`, `features`, `shared`, `update`, `validators`, `workers`, plus `auth.test.mjs`, `utils/hd1.mjs`.
- missing — the mirror rule / `mirrorTree.test.mjs`.
- :107 stale — `npm test` runs unit then smoke → `vitest run`, unit only; `test:smoke`, `test:all` missing.
- :114 stale — instruction aimed at AI assistants on a public page — remove.
- :137 stale — "malformed enum files" → 3 exclude globs (`vitest.config.mjs:30-35`).
- :224-230 stale — no `.jsx`, qualifier segment, contract/integration escape hatches.
- :256-261 stale — no `TEST_SERVER_URL`, fail-when-no-server, `SMOKE_ALLOW_SKIP` (`src/__tests__/smoke/smoke.test.mjs:1-21`).
- :271 **fixed** — Playwright `v1.64.1-noble` (1acff117; matches `check-ci.yml:33`, `scripts/visual-tests.sh:12`).
- :280,296 correct — `.vitest-attachments/` (`vitest.visual.config.mjs:12-14`).
- :282 stale — `ci.yml` → `check-ci.yml`.

**Other pages — lease lines only** (~6 lines)
- `src/app/docs/notifications/page.mdx:115`, `notificationFlowConfig.mjs:175`, `pushFlowConfig.mjs:36` stale — push dedup "in memory" → lease row.
- `src/app/docs/overviewConfig.mjs:92` stale — "Internal POST endpoint" → GET; POST is `methodNotAllowed` (`route.js:61,212`).

**docs/roadmap.md references (HOUSE-05)**
- Edit: AGENTS.md:220, `.planning/PROJECT.md:49,51,65,93` (:49 "§ Track F" → SSE-01 / Phase 17).
- Keep: REQUIREMENTS.md:37, ROADMAP.md:96 (requirement text), `.planning/research/{ARCHITECTURE,FEATURES,PITFALLS,SUMMARY}.md`, CHANGELOG.md:566,1643,1651. `graphify-out/` is gitignored.
- Content not in `.planning/`: prep ladder (`docs/roadmap.md:28-43`), per-issue prediction unblock gates (`:233-238`), feature-reach table (`:352-376`), #469 at `:168` (→ D-18).

**Analyzer caveats (2026-10-23):** no build ran and no docs page was rendered; the v0.95.2
`.map` baseline (142 maps / ~24.6 MB in `.next/static`) is from the 2026-10-14 main-checkout build.
The main checkout's `node_modules` holds Sentry 10 and vitest 4 — build or measure only in a lane
after `npm ci`. GlitchTip was not re-queried (connector needed re-authentication).
