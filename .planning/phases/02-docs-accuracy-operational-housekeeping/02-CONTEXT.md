# Phase 2: Docs Accuracy & Operational Housekeeping - Context

**Gathered:** 2026-10-14 (assumptions mode); refreshed 2026-10-23 against develop 0.95.7
**Status:** Ready for planning

<domain>
## Phase Boundary

Documentation matches deployed reality, and the small open operational verification chores close.
Requirements: DOCS-01, DOCS-02, HOUSE-03, HOUSE-04, HOUSE-05 (see `.planning/ROADMAP.md` § Phase 2,
5 success criteria). The phase makes two production releases (D-21).

Not in this phase: docs pages outside the DOCS-02 list (DOCS-03, Phase 18), the test-layout move
(HOUSE-01, Phase 3), any change to the seed-refresh workflow, and the code-review findings WR-07
and WR-08 (D-25, D-26).
</domain>

<decisions>
## Implementation Decisions

### Ground truth and DOCS-01
- **D-01:** The reference for every docs check is the live code plus `deploy/staging/compose.yaml`
  and `deploy/README.md`. The `.planning/codebase/*.md` maps (2026-08-28) are a starting point only;
  they contain errors.
- **D-02:** Fix the 5 wrong map lines in the same pass: `.planning/codebase/STACK.md:85` (dedicated
  worker service — does not exist), `ARCHITECTURE.md:125` (#516 "stale state" 403 reason),
  `ARCHITECTURE.md:127` (`updateStatus` also writes `h1_event_progress`, `src/update/status.mjs:101,118`),
  `ARCHITECTURE.md:130` (`updateSeason` does not write `h1_statistic`/`h1_event_progress`),
  `INTEGRATIONS.md:80` ("production runs 3 app replicas" — contradicts D-04). Also fix
  `.planning/PROJECT.md:72` ("Vitest 4" → "Vitest 5"). Then regenerate the main checkout's
  `.claude/CLAUDE.md` from the maps (GSD `source:` markers at lines 1, 23, 169). Never hand-edit
  `.claude/CLAUDE.md` — it is gitignored (`.gitignore:58`) and generated; today it is stale at
  lines 13, 44, 62-64 and 87.
- **D-03:** DOCS-01 rewrites AGENTS.md § Architecture — Stack (lines 184-206), § Frontend Layout
  items (210-212) and § Task Tracking (220). Content: the closing pass reads/writes
  `last_season_observed` in the lease row; the `worker_heartbeat` lease (60 s TTL, holder/standby,
  `200 {role:'standby'}`); every replica spawns the cron thread, and `WORKER_ENABLED=false` is an
  optional opt-out, not a multi-replica requirement; `prevEvents` lives in the lease row;
  `updateSeason` writes `h1_season`, `h1_event`, `h1_status` only; current component names
  (`EventLog`, `LastUpdated`). The same pass fixes the comments that still describe the #516 model:
  `src/app/api/h1/update/route.js:75-77` (and the "~15s" at `:34`),
  `src/shared/utils/initializeWorker.mjs:2-6`, `.example.env:11-13`, `public/workers/cron.js:13`.

### Topology (Andrei, 2026-10-14)
- **D-04:** Production today = one app container on one Docker host behind the reverse proxy and
  CrowdSec (`docker-compose.yml:2-23`). The lease always has one holder there. Docs describe this
  as the current production.
- **D-05:** Staging = Pi Docker Swarm, 2 app replicas (`deploy/staging/compose.yaml:114`), one
  shared Postgres, lease-coordinated (`compose.yaml:58-67`, `deploy/README.md:16-29`). Docs
  describe this as the proven multi-replica topology.
- **D-06:** The planned production move to the swarm (≥2 replicas, same DB) is not described as
  current. Docs may state that the lease makes any replica count safe. No production
  `UPDATE_INTERVAL` value is stated — name the env var and the `.example.env:10` value (`20`).

### DOCS-02 scope
- **D-07:** Scope = the 5 listed pages (`src/app/docs/{architecture,data-flow,infrastructure,
  database,testing}/`, page plus diagram config `.mjs` files) plus the lease lines on 2 other pages:
  `notifications/page.mdx:115`, `notifications/notificationFlowConfig.mjs:175`,
  `notifications/pushFlowConfig.mjs:36` (push dedup "in memory" → lease row), and
  `src/app/docs/page.mdx:32`, `src/app/docs/overviewConfig.mjs:92`. All other pages wait for
  DOCS-03.
- **D-08:** data-flow gets a short poller-lease subsection (~15 lines) and loses the retired
  pieces (`?key=` auth, `initializeOpenApiSpec()`, module-level state, "on-demand" season pipeline).
- **D-09:** database drops `Review` and `App` (migration `20260416091157_drop_unused_tables`),
  adds the lease columns and `api_rate_limit`, and states `TIMESTAMP(3)` (naive UTC), not
  `TIMESTAMPTZ` (19 cells today).
- **D-10:** infrastructure (largest page, ~150-220 lines) gets a deployment-topology section per
  D-04..D-06, current workflow file names and the full workflow list (10 files), the distroless
  runtime image, a complete env table (adds `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`,
  `FORCE_SEED`, the `*_FILE` convention; removes `POSTGRES_SSL`, `SKIP_MIGRATIONS` at
  `:433-434`), and the post-HOUSE-03 Sentry block (`:373-387`): no `productionBrowserSourceMaps`,
  no `silent`, the wrapper only when `SENTRY_AUTH_TOKEN` is set, maps deleted after upload.
  `.planning/codebase/CONCERNS.md:50-53` (#502) is updated in the same pass.
- **D-11:** testing: fix all drift outside the test layout now. Replace the enumerated directory
  tree, mermaid directory list and naming table with a short rule statement that links to
  AGENTS.md § Test Layout, so Phase 3 changes one paragraph. Remove the "euraika/aegis" reference
  (`:22`), the "Audience: … AI assistants" line (`:11`) and the instruction aimed at AI assistants
  (`:114`). `:271` (Playwright 1.64.1) and `:280,296` (`.vitest-attachments/`) are already correct.
- **D-12:** § Drift Inventory in `02-DISCUSSION-LOG.md` (re-checked 2026-10-23) is the executor's
  starting checklist. Each item is re-verified against code before editing. Criterion 2 closes on a
  final page-by-page check against the live code, recorded in the phase verification.
- **D-23:** Every edited Mermaid diagram is rendered in a real browser (DevTools) before the PR.
  mermaid went 11 → 12 (commit f58e3052) with no re-render of the docs pages, and
  `data-flow/page.mdx:55` styles a subgraph that no longer exists. `next build` does not execute
  client-side mermaid, so the build proves nothing about rendering.

### HOUSE-03 sourcemap strip
- **D-13:** The #502 gate is met. Evidence: GlitchTip HELLDIVERSBOT-6C, event
  `69dc63bfe21b4745a561db74d2f99c35`, release `0.95.2`, environment `production`, a real Opera user;
  raw frame `29db8qr-sdvxo.js:2:2648` resolves to `src/features/notifications/NotificationToggle.jsx:118`
  with source context. Record this on #502 (the issue has 0 comments today).
- **D-14:** The change has 2 parts: delete `productionBrowserSourceMaps: true` (`next.config.mjs:15`)
  and add `sourcemaps: { deleteSourcemapsAfterUpload: true }` to the `withSentryConfig` options
  (`next.config.mjs:213-222`, inside the ternary at `:212-223`). Verified against
  `@sentry/nextjs` 11.8.0 (the version on develop since f58e3052): a user-set
  `productionBrowserSourceMaps` still cancels the SDK's own map switch and delete default
  (`withSentryConfig/getFinalConfigObjectBundlerUtils.js:127-129`, default delete at `:135-146`);
  the option name is unchanged (`types/config/types.d.ts:391`) and covers the Turbopack build the
  project uses (`package.json` `build` has no `--webpack`; delete globs in
  `getBuildPluginOptions.js:128-139`, applied in `handleRunAfterProductionCompile.js:43-58`).
  Keep the explicit option even though it matches the v11 default: it fixes the intent in place.
  Without `SENTRY_AUTH_TOKEN` the wrapper is skipped entirely, so after the change token-less
  builds (docker-smoke, self-hosters) produce no browser maps at all. This change also resolves
  review finding IN-03 (`01-REVIEW.md:207-214`; its import half landed in f58e3052) — mark it in
  `01-REVIEW-DISPOSITION.md`.
- **D-15:** Verification, all three recorded on #502 before it closes: (1) `.map` count and size in
  the image vs v0.95.2 (`docker create` + `docker export | tar -t` — the runtime is distroless,
  `Dockerfile.app:107`, no shell); (2) a production `.js.map` URL returns 404; (3) a symbolicated
  GlitchTip event from the phase-end release (D-21). Measure in a lane worktree after `npm ci`:
  the main checkout's `node_modules` still holds Sentry 10 and vitest 4.
- **D-16:** Server maps in `.next/standalone` (~46 files, ~184 KB) stay. They are not served over
  HTTP (`Dockerfile.app:137`).
- **D-24:** Sentry 11 symbolication on GlitchTip is proven on the first release (0.95.7, D-21)
  before the strip ships. The 0.95.2 proof used the old `sentry-cli` upload stack; f58e3052
  replaced it with `@sentry/bundler-plugins` 11.8.0 + `sentry` 0.45.0 (debug-ID artifact bundles),
  which already reports "Successfully uploaded source maps" on the staging build (run 39574238756).
  Evidence = one 0.95.7 production event in GlitchTip whose frames resolve to source paths. If it
  does not symbolicate, HOUSE-03 blocks until the uploader is fixed; the public maps stay as the
  fallback meanwhile. The GlitchTip MCP connector needs re-authentication before this check.

### HOUSE-04 and HOUSE-05
- **D-17:** #501 closes on the real run: run 35578125172 (2026-09-21) → PR #531 (only
  `prisma/seed/seasons/season-160.json`, bot commit `76865ef3`) → merged 2026-09-21 by merge
  commit `66093080`. The workflow runs Mondays (`scheduled-seed-refresh.yml:5`); the 4 runs since
  (09-28, 10-05, 10-12, 10-19) opened no PR, since season 161 is still active. The closing comment
  also records 2 gaps, both still in the current file (only setup-node changed since, fd0bd38c):
  (1) the PR is opened with `GH_TOKEN: ${{ github.token }}` (`:49`), so no workflow runs on it —
  #531 had 0 check runs and merged with no version bump; (2) a second run while the PR is open
  rebuilds the branch from develop (`:59`) with `push --force` (`:62`) and deletes any bump commit
  on it — exactly the commit the PR body (`:65`) and `prisma/seed/readme.md:49-51` tell the human
  to push. The gaps go into one new issue (milestone Engineering Health). The workflow does not
  change in this phase.
- **D-18:** Before `docs/roadmap.md` is retired, #469 (open, "Archives map: hide factions until
  their introduction point", milestone Archive Analytics & Dashboard) gets a requirement,
  **ARCH-11** (ARCH-10 is already closed-season caching, Phase 12), mapped to Phase 11 (War
  Playback, ARCH-05, shares the archives map surface) in `REQUIREMENTS.md` (requirement line,
  traceability table, coverage footer 79 → 80) and `ROADMAP.md`. Today `docs/roadmap.md:168` and
  `PROJECT.md:43` are its only schedule entries.
- **D-19:** `docs/roadmap.md` (576 lines, last change bb01517d) becomes a pointer of about 5 lines
  to `.planning/ROADMAP.md`. Update AGENTS.md:220 and `.planning/PROJECT.md:49,51,65,93`;
  `PROJECT.md:49` cites "`docs/roadmap.md` § Track F" for the four SSE questions — repoint it to
  SSE-01 / Phase 17, which already list them. Keep REQUIREMENTS.md:37, ROADMAP.md:96, CHANGELOG
  entries (`:566,1643,1651`) and the dated `.planning/research/*.md` files unchanged — the pointer
  keeps their links working.
- **D-20:** The prep ladder, per-issue prediction unblock gates and feature-reach table are not
  migrated. The pointer links to the last full version of the file (commit permalink), so the
  content stays one click away.

### Release
- **D-21:** Two production releases (Andrei, 2026-10-23). (1) At the start of Phase 2: release
  develop as it stands (0.95.7: the Dependabot round incl. Sentry 11; `## Unreleased` is empty) —
  the develop/main gap is already at the STAB-07 limit of ~5 versions, and this release is the
  D-24 symbolication proof. (2) At phase end: HOUSE-03 and the docs, with D-15 check 3 on it.
  Each release follows AGENTS.md § Git Workflow rule 3 (develop → main PR, `vX.Y.Z` tag,
  merge-back). The Phase 1 STAB-06 gate is satisfied (window closed 2026-10-16, re-count done
  2026-10-21).
- **D-22:** Each PR into develop carries its version bump and CHANGELOG move as its last commit
  (AGENTS.md rule 2). `Check: Version Bump` enforces this only for `src/**`, `prisma/**`,
  `public/**` and `package.json` (`.github/workflows/check-version.yml:10`); PRs that touch only
  `next.config.mjs`, AGENTS.md, `.example.env`, `docs/roadmap.md` or `.planning/**` get no CI
  reminder and must bump by hand. `.planning/`-only PRs (this context, plan docs) carry no bump.

### Review findings outside the requirements (Andrei, 2026-10-23)
- **D-25:** WR-07 (`01-REVIEW.md:137-146`: the rewrites at `next.config.mjs:67-74` proxy
  `/api/record` and `/api/websites/:id/recorder` to the fixed Umami host on every deployment) is
  filed as a GitHub issue and deferred. It is not a ride-along: the suggested build-time env gate
  would strip the rewrites from production images, since `UMAMI_*` exist only at runtime
  (`:65-66`) and `Dockerfile.app` has no UMAMI build arg. The safe fix is a route handler like
  `/stats.js`. Natural home: Phase 5 (SEO-09 owns the Umami proxy wiring).
- **D-26:** WR-08 (`01-REVIEW.md:148-157`: the catch-all `public, s-maxage=30` rule at
  `next.config.mjs:193-199` caches HTML whose root layout renders `MinistryTriggerWidget` from the
  session, `src/app/layout.jsx:84-91,237`) is filed as a GitHub issue (milestone Engineering
  Health) and deferred. Impact is an easter-egg trigger with no privileged action behind it.

### Claude's Discretion
- Exact wording and structure of each rewritten docs section, within D-03..D-11.
- How the work is split into plans and PRs.
- Semver level of each bump (patch fits docs and config).
- Wording of the new issues (D-17 seed-refresh gaps, D-25 WR-07, D-26 WR-08).
- Whether AGENTS.md:222/224 "Phase N" milestone wording is touched (out of scope unless trivial).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` § Phase 2 — goal and 5 success criteria
- `.planning/REQUIREMENTS.md` — DOCS-01, DOCS-02, HOUSE-03, HOUSE-04, HOUSE-05 (lines 33-43); STAB-07 (line 21); ARCH section (D-18)
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-DISCUSSION-LOG.md` § Drift Inventory — per-file stale statement → code fact, with line numbers re-checked 2026-10-23
- `.planning/phases/01-stability-fixes-release/01-CONTEXT.md` — D-03 (symbolication)
- `.planning/phases/01-stability-fixes-release/01-RELEASE-RECORD.md` — v0.95.2 release and deployment record
- `.planning/phases/01-stability-fixes-release/01-GLITCHTIP-RECOUNT.md` — re-count method (`release:<version>` filter)
- `.planning/phases/01-stability-fixes-release/01-REVIEW.md`, `01-REVIEW-DISPOSITION.md` — WR-07, WR-08, IN-03

### Lease and topology (DOCS-01, DOCS-02)
- `src/update/lease.mjs` — `claimLease`, `persistPollerState`, TTL, `worker_type`
- `src/app/api/h1/update/route.js` — lease claim, standby, closing pass, `prevEvents`
- `src/shared/utils/initializeWorker.mjs` — `WORKER_ENABLED`, thread spawn, `process.exit(1)`
- `src/instrumentation.js`, `src/instrumentation.node.js` — where `initializeWorker()` is called
- `public/workers/cron.js`, `public/workers/cronLogic.js` — poll loop, Bearer auth, startup header
- `src/update/status.mjs`, `src/update/season.mjs` — which tables each path writes
- `deploy/staging/compose.yaml`, `deploy/README.md` — staging topology; `docker-compose.yml` — production
- `prisma/schema.prisma` — `worker_heartbeat` (237-250), `api_rate_limit` (258-266), timestamp types
- `.example.env` — env var reference; `src/__tests__/unit/_meta/exampleEnv.test.mjs` — what it asserts

### Docs pages (DOCS-02)
- `src/app/docs/architecture/`, `src/app/docs/data-flow/`, `src/app/docs/infrastructure/`, `src/app/docs/database/`, `src/app/docs/testing/`
- `src/app/docs/notifications/page.mdx`, `notificationFlowConfig.mjs`, `pushFlowConfig.mjs`
- `src/app/docs/page.mdx`, `src/app/docs/overviewConfig.mjs`
- `.github/workflows/*.yml` — current workflow names and triggers (10 files)
- `Dockerfile.app`, `Dockerfile.migrate`, `docker-compose.yml`

### Sourcemaps (HOUSE-03)
- GitHub issue #502 — gate and prescribed change
- `next.config.mjs` — line 15 and the `withSentryConfig` ternary (212-223)
- `@sentry/nextjs` 11.8.0 sources (run `npm ci` in the lane first; the main checkout has 10.68.0):
  `build/cjs/config/withSentryConfig/getFinalConfigObjectBundlerUtils.js` (123-147),
  `build/cjs/config/getBuildPluginOptions.js` (128-139, 184),
  `build/cjs/config/handleRunAfterProductionCompile.js` (43-58), `build/types/config/types.d.ts` (391)
- `.github/workflows/check-version.yml` — Version Bump trigger paths (D-22)

### Seed refresh and roadmap (HOUSE-04, HOUSE-05)
- GitHub issue #501; PR #531; run https://github.com/elfensky/helldivers.bot/actions/runs/35578125172
- `.github/workflows/scheduled-seed-refresh.yml`, `prisma/seed/readme.md`
- GitHub issue #469
- `docs/roadmap.md`, `AGENTS.md` § Task Tracking, `.planning/PROJECT.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deploy/README.md:24-29`, `deploy/staging/compose.yaml:58-67` and `src/update/lease.mjs:5-18`
  describe the lease and handover accurately — reuse their wording for the docs topology sections.
  (`src/app/docs/utilities/page.mdx:849` does NOT mention the lease; the 2026-10-14 note was wrong.)
- `.claude/CLAUDE.md` (generated) already has a correct lease description; its stack lines are
  regenerated from the maps after D-02.
- `vitest.visual.config.mjs:12-14` pins `.vitest-attachments/` under Vitest 5, so the testing page's
  lines 280 and 296 stay true.

### Established Patterns
- Docs pages are MDX app routes under `src/app/docs/**`; diagrams are Mermaid definition + config `.mjs` files rendered by `MermaidDiagram` (node IDs use underscores).
- Docs go live on production only with a `vX.Y.Z` tag (`.github/workflows/build-release.yml:3-5`).
- `src/__tests__/unit/_meta/exampleEnv.test.mjs` asserts only `PORT="3000"`, `DEPLOY_ENV=""` and the absence of `POSTGRES_SSL=` — comment edits to `.example.env` are safe.
- `next.config.mjs` header rules show their real effect only in a production build (Phase 1 lesson, `/opengraph-image`).

### Integration Points
- AGENTS.md is the file behind the `CLAUDE.md` symlink — every session loads it.
- `.planning/codebase/*.md` feed the generated `.claude/CLAUDE.md`.
- #502, #501 and the new issues (D-17, D-25, D-26) are closed or opened by the executor with written evidence.
- The main checkout's `node_modules` is stale (Sentry 10, vitest 4); every build or measurement runs in a lane worktree after `npm ci`.
</code_context>

<specifics>
## Specific Ideas

- Production topology came from Andrei directly (D-04..D-06, 2026-10-14): "today it's a single container. We will be moving it to the swarm cluster, where at least 2 replicas will exist of the app, talking to the same db."
- The HOUSE-03 gate evidence (D-13) was read from the GlitchTip MCP on 2026-10-14.
- 2026-10-23 refresh (Andrei): two releases (D-21); WR-08 filed and deferred, not a ride-along (D-26).
</specifics>

<deferred>
## Deferred Ideas

- **Production move to the Pi swarm** (≥2 app replicas, one shared DB) — Andrei's stated plan. No requirement covers it; Phase 16 covers staging only. It needs a GitHub issue first (PROJECT.md § Out of Scope: new work gets an issue first).
- **Seed-refresh workflow gaps** (no CI on the bot PR; force-push deletes a bump commit) — new issue per D-17, later phase.
- **WR-07 Umami rewrite open proxy** — issue per D-25; route-handler fix in Phase 5.
- **WR-08 session-dependent HTML in shared cache** — issue per D-26; ~6-line cookie exclusion on the catch-all header rule, verified in a production build.
- **Docs drift outside the DOCS-02 list** (api, utilities, frontend-layout, …) — DOCS-03, Phase 18.
- **Lighthouse `valid-source-maps` audit** in `scheduled-pagespeed.yml` may change after D-14 — minor; check on the next PageSpeed run.
- **AGENTS.md:222/224 "Phase N" milestone wording** collides with GSD phase numbers — adjacent to D-03, touch only if trivial.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 2.
</deferred>
