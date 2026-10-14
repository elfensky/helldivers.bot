# Phase 2: Docs Accuracy & Operational Housekeeping - Context

**Gathered:** 2026-10-14 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Documentation matches deployed reality, and the small open operational verification chores close.
Requirements: DOCS-01, DOCS-02, HOUSE-03, HOUSE-04, HOUSE-05 (see `.planning/ROADMAP.md` § Phase 2,
5 success criteria). The phase ends with one production release.

Not in this phase: docs pages outside the DOCS-02 list (DOCS-03, Phase 18), the test-layout move
(HOUSE-01, Phase 3), and any change to the seed-refresh workflow.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and DOCS-01
- **D-01:** The reference for every docs check is the live code plus `deploy/staging/compose.yaml`
  and `deploy/README.md`. The `.planning/codebase/*.md` maps (2026-08-28) are a starting point only;
  they contain errors.
- **D-02:** Fix the 3 wrong map lines in the same pass: `.planning/codebase/STACK.md:85` (dedicated
  worker service — does not exist), `ARCHITECTURE.md:125` (#516 "stale state" 403 reason),
  `ARCHITECTURE.md:130` (`updateSeason` does not write `h1_statistic`/`h1_event_progress`). Then
  regenerate the main checkout's `.claude/CLAUDE.md` from the maps (GSD `source:codebase/*`
  markers). Never hand-edit `.claude/CLAUDE.md` — it is gitignored (`.gitignore:58`) and generated.
- **D-03:** DOCS-01 rewrites AGENTS.md § Architecture (lines ~187-212) and § Task Tracking (~220).
  Content: the closing pass reads/writes `last_season_observed` in the lease row; the
  `worker_heartbeat` lease (60 s TTL, holder/standby, `200 {role:'standby'}`); every replica spawns
  the cron thread, and `WORKER_ENABLED=false` is an optional opt-out, not a multi-replica
  requirement; `prevEvents` lives in the lease row; `updateSeason` writes `h1_season`, `h1_event`,
  `h1_status` only; current component names (`EventLog`, `LastUpdated`). The same pass fixes the
  comments that still describe the #516 model: `src/app/api/h1/update/route.js:75-77`,
  `src/shared/utils/initializeWorker.mjs:2-6`, `.example.env:11-13`, `public/workers/cron.js:12`.

### Topology (Andrei, 2026-10-14)
- **D-04:** Production today = one app container on one Docker host behind the reverse proxy and
  CrowdSec. The lease always has one holder there. Docs describe this as the current production.
- **D-05:** Staging = Pi Docker Swarm, 2 app replicas, one shared Postgres, lease-coordinated
  (`deploy/README.md`). Docs describe this as the proven multi-replica topology.
- **D-06:** The planned production move to the swarm (≥2 replicas, same DB) is not described as
  current. Docs may state that the lease makes any replica count safe. No production
  `UPDATE_INTERVAL` value is stated — name the env var and the `.example.env` value.

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
  `TIMESTAMPTZ`.
- **D-10:** infrastructure (largest page, ~150-220 lines) gets a deployment-topology section per
  D-04..D-06, current workflow file names and the full workflow list, the distroless runtime image,
  and a complete env table (adds `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`,
  `FORCE_SEED`, the `*_FILE` convention; removes `POSTGRES_SSL`, `SKIP_MIGRATIONS`).
- **D-11:** testing: fix all drift outside the test layout now. Replace the enumerated directory
  tree, mermaid directory list and naming table with a short rule statement that links to
  AGENTS.md § Test Layout, so Phase 3 changes one paragraph. Remove the "euraika/aegis" reference
  and the instruction aimed at AI assistants.
- **D-12:** § Drift Inventory in `02-DISCUSSION-LOG.md` is the executor's starting checklist. Each
  item is re-verified against code before editing. Criterion 2 closes on a final page-by-page check
  against the live code, recorded in the phase verification.

### HOUSE-03 sourcemap strip
- **D-13:** The #502 gate is met. Evidence: GlitchTip HELLDIVERSBOT-6C, event
  `69dc63bfe21b4745a561db74d2f99c35`, release `0.95.2`, environment `production`, a real Opera user;
  raw frame `29db8qr-sdvxo.js:2:2648` resolves to `src/features/notifications/NotificationToggle.jsx:118`
  with source context. Record this on #502.
- **D-14:** The change has 2 parts: delete `productionBrowserSourceMaps: true` (`next.config.mjs:15`)
  and add `sourcemaps: { deleteSourcemapsAfterUpload: true }` to the `withSentryConfig` options
  (`next.config.mjs:212-222`). The #502 prescription alone is not enough: line 15 makes the Sentry
  SDK skip its own delete default, and token-less builds (docker-smoke, self-hosters) would still
  ship ~24.6 MB of public maps.
- **D-15:** Verification, all three recorded on #502 before it closes: (1) `.map` count and size in
  the image vs v0.95.2 (`docker create` + `docker export | tar -t` — the runtime is distroless, no
  shell); (2) a production `.js.map` URL returns 404; (3) a symbolicated GlitchTip event from the
  new release. Check (3) needs the D-21 release.
- **D-16:** Server maps in `.next/standalone` (~46 files, ~184 KB) stay. They are not served over
  HTTP.

### HOUSE-04 and HOUSE-05
- **D-17:** #501 closes on the real run: run 35578125172 (2026-09-21) → PR #531 (only
  `prisma/seed/seasons/season-160.json`) → merged 2026-09-21, commit `76865ef3`. The closing comment
  also records 2 gaps: (1) the PR is opened with `GITHUB_TOKEN`, so no workflow runs on it — #531
  had 0 check runs and merged with no version bump; (2) a second run while the PR is open rebuilds
  the branch from develop with `push --force` and deletes any bump commit on it. The gaps go into
  one new issue (milestone Engineering Health). The workflow does not change in this phase.
- **D-18:** Before `docs/roadmap.md` is retired, #469 (open, "Archives map: hide factions until
  their introduction point", milestone Archive Analytics & Dashboard) gets a requirement, ARCH-10,
  mapped to Phase 11 in `REQUIREMENTS.md` and `ROADMAP.md`. Today `docs/roadmap.md` is its only
  schedule entry.
- **D-19:** `docs/roadmap.md` becomes a pointer of about 5 lines to `.planning/ROADMAP.md`.
  Update AGENTS.md § Task Tracking (~220) and `.planning/PROJECT.md:47,49,63,91`. Keep
  CHANGELOG entries and the dated `.planning/research/*.md` files unchanged — the pointer keeps
  their links working.
- **D-20:** The prep ladder, per-issue prediction unblock gates and feature-reach table are not
  migrated. The pointer links to the last full version of the file (commit permalink), so the
  content stays one click away.

### Release
- **D-21:** One production release at the end of Phase 2 (develop → main PR, `vX.Y.Z` tag,
  merge-back), per AGENTS.md § Git Workflow rule 3. It must not ship before Phase 1's STAB-06
  window closes (2026-10-16T11:22:13Z) and plan 01-09's GlitchTip re-count of v0.95.2 is done —
  an earlier release would change the release under measurement.
- **D-22:** Each PR into develop carries its version bump and CHANGELOG move as its last commit
  (AGENTS.md rule 2). Changes under `src/**` trigger `Check: Version Bump`.

### Claude's Discretion
- Exact wording and structure of each rewritten docs section, within D-03..D-11.
- How the work is split into plans and PRs.
- Semver level of each bump (patch fits docs and config).
- Wording of the new seed-refresh-gaps issue (D-17).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` § Phase 2 — goal and 5 success criteria
- `.planning/REQUIREMENTS.md` — DOCS-01, DOCS-02, HOUSE-03, HOUSE-04, HOUSE-05; ARCH section (D-18)
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-DISCUSSION-LOG.md` § Drift Inventory — per-file stale statement → code fact, with line numbers
- `.planning/phases/01-stability-fixes-release/01-CONTEXT.md` — D-02 (48h window), D-03 (symbolication)
- `.planning/phases/01-stability-fixes-release/01-RELEASE-RECORD.md` — v0.95.2 release and deployment record

### Lease and topology (DOCS-01, DOCS-02)
- `src/update/lease.mjs` — `claimLease`, `persistPollerState`, TTL, `worker_type`
- `src/app/api/h1/update/route.js` — lease claim, standby, closing pass, `prevEvents`
- `src/shared/utils/initializeWorker.mjs` — `WORKER_ENABLED`, thread spawn, `process.exit(1)`
- `public/workers/cron.js`, `public/workers/cronLogic.js` — poll loop, Bearer auth, startup header
- `deploy/staging/compose.yaml`, `deploy/README.md` — staging topology
- `prisma/schema.prisma` — `worker_heartbeat`, `api_rate_limit`, timestamp types
- `.example.env` — env var reference

### Docs pages (DOCS-02)
- `src/app/docs/architecture/`, `src/app/docs/data-flow/`, `src/app/docs/infrastructure/`, `src/app/docs/database/`, `src/app/docs/testing/`
- `src/app/docs/notifications/page.mdx`, `notificationFlowConfig.mjs`, `pushFlowConfig.mjs`
- `src/app/docs/page.mdx`, `src/app/docs/overviewConfig.mjs`
- `.github/workflows/*.yml` — current workflow names and triggers
- `Dockerfile.app`, `Dockerfile.migrate`, `docker-compose.yml`

### Sourcemaps (HOUSE-03)
- GitHub issue #502 — gate and prescribed change
- `next.config.mjs` — line 15 and the `withSentryConfig` block (~212-222)
- `node_modules/@sentry/nextjs/build/cjs/config/withSentryConfig/getFinalConfigObjectBundlerUtils.js`, `getBuildPluginOptions.js` — delete-after-upload behavior (SDK 10.68.0)

### Seed refresh and roadmap (HOUSE-04, HOUSE-05)
- GitHub issue #501; PR #531; run https://github.com/elfensky/helldivers.bot/actions/runs/35578125172
- `.github/workflows/scheduled-seed-refresh.yml`, `prisma/seed/readme.md`
- GitHub issue #469
- `docs/roadmap.md`, `AGENTS.md` § Task Tracking, `.planning/PROJECT.md`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deploy/README.md` already describes the staging lease and handover accurately — reuse its wording for the docs topology sections.
- `src/app/docs/utilities/page.mdx:849` already describes the lease correctly — a consistency reference.
- `.claude/CLAUDE.md` (generated) already has a correct lease description; only its stack line 87 is wrong.

### Established Patterns
- Docs pages are MDX app routes under `src/app/docs/**`; diagrams are Mermaid definition + config `.mjs` files rendered by `MermaidDiagram` (node IDs use underscores).
- Docs go live on production only with a `vX.Y.Z` tag (`.github/workflows/build-release.yml:3-5`).
- `src/__tests__/unit/_meta/exampleEnv.test.mjs` asserts `.example.env` content — edits to `.example.env` comments must keep it green.

### Integration Points
- AGENTS.md is the file behind the `CLAUDE.md` symlink — every session loads it.
- `.planning/codebase/*.md` feed the generated `.claude/CLAUDE.md`.
- #502, #501 and the new gaps issue are closed or opened by the executor with written evidence.
</code_context>

<specifics>
## Specific Ideas

- Production topology came from Andrei directly (D-04..D-06): "today it's a single container. We will be moving it to the swarm cluster, where at least 2 replicas will exist of the app, talking to the same db."
- The HOUSE-03 gate evidence (D-13) was read from the GlitchTip MCP on 2026-10-14.
</specifics>

<deferred>
## Deferred Ideas

- **Production move to the Pi swarm** (≥2 app replicas, one shared DB) — Andrei's stated plan. No requirement covers it; Phase 16 covers staging only. It needs a GitHub issue first (PROJECT.md § Out of Scope: new work gets an issue first).
- **Seed-refresh workflow gaps** (no CI on the bot PR; force-push deletes a bump commit) — new issue per D-17, later phase.
- **Docs drift outside the DOCS-02 list** (api, utilities, frontend-layout, …) — DOCS-03, Phase 18.
- **Lighthouse `valid-source-maps` audit** in `scheduled-pagespeed.yml` may change after D-14 — minor; check on the next PageSpeed run.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 2.
</deferred>
</content>
</invoke>
