# Phase 2: Docs Accuracy & Operational Housekeeping - Research

**Researched:** 2026-10-23
**Domain:** Documentation accuracy (MDX docs pages, AGENTS.md, codebase maps), Sentry 11 sourcemap strip (Next.js 16 / Turbopack / Docker distroless), GitHub Actions seed-refresh verification, planning-doc retirement
**Confidence:** HIGH for in-repo facts and Sentry 11.8.0 behaviour (read from files this session); MEDIUM for GlitchTip-side symbolication of a Sentry 11 upload (not testable here)
**Lane:** `/Users/andrei/Developer/helldivers.bot/.worktrees/docs-phase-02-plan`, branch `docs/phase-02-plan`, `package.json` version `0.95.7` (read this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ground truth and DOCS-01**
- **D-01:** The reference for every docs check is the live code plus `deploy/staging/compose.yaml` and `deploy/README.md`. The `.planning/codebase/*.md` maps (2026-08-28) are a starting point only; they contain errors.
- **D-02:** Fix the 5 wrong map lines in the same pass: `.planning/codebase/STACK.md:85` (dedicated worker service — does not exist), `ARCHITECTURE.md:125` (#516 "stale state" 403 reason), `ARCHITECTURE.md:127` (`updateStatus` also writes `h1_event_progress`, `src/update/status.mjs:101,118`), `ARCHITECTURE.md:130` (`updateSeason` does not write `h1_statistic`/`h1_event_progress`), `INTEGRATIONS.md:80` ("production runs 3 app replicas" — contradicts D-04). Also fix `.planning/PROJECT.md:72` ("Vitest 4" → "Vitest 5"). Then regenerate the main checkout's `.claude/CLAUDE.md` from the maps (GSD `source:` markers at lines 1, 23, 169). Never hand-edit `.claude/CLAUDE.md` — it is gitignored (`.gitignore:58`) and generated; today it is stale at lines 13, 44, 62-64 and 87.
- **D-03:** DOCS-01 rewrites AGENTS.md § Architecture — Stack (lines 184-206), § Frontend Layout items (210-212) and § Task Tracking (220). Content: the closing pass reads/writes `last_season_observed` in the lease row; the `worker_heartbeat` lease (60 s TTL, holder/standby, `200 {role:'standby'}`); every replica spawns the cron thread, and `WORKER_ENABLED=false` is an optional opt-out, not a multi-replica requirement; `prevEvents` lives in the lease row; `updateSeason` writes `h1_season`, `h1_event`, `h1_status` only; current component names (`EventLog`, `LastUpdated`). The same pass fixes the comments that still describe the #516 model: `src/app/api/h1/update/route.js:75-77` (and the "~15s" at `:34`), `src/shared/utils/initializeWorker.mjs:2-6`, `.example.env:11-13`, `public/workers/cron.js:13`.

**Topology (Andrei, 2026-10-14)**
- **D-04:** Production today = one app container on one Docker host behind the reverse proxy and CrowdSec (`docker-compose.yml:2-23`). The lease always has one holder there. Docs describe this as the current production.
- **D-05:** Staging = Pi Docker Swarm, 2 app replicas (`deploy/staging/compose.yaml:114`), one shared Postgres, lease-coordinated (`compose.yaml:58-67`, `deploy/README.md:16-29`). Docs describe this as the proven multi-replica topology.
- **D-06:** The planned production move to the swarm (≥2 replicas, same DB) is not described as current. Docs may state that the lease makes any replica count safe. No production `UPDATE_INTERVAL` value is stated — name the env var and the `.example.env:10` value (`20`).

**DOCS-02 scope**
- **D-07:** Scope = the 5 listed pages (`src/app/docs/{architecture,data-flow,infrastructure,database,testing}/`, page plus diagram config `.mjs` files) plus the lease lines on 2 other pages: `notifications/page.mdx:115`, `notifications/notificationFlowConfig.mjs:175`, `notifications/pushFlowConfig.mjs:36` (push dedup "in memory" → lease row), and `src/app/docs/page.mdx:32`, `src/app/docs/overviewConfig.mjs:92`. All other pages wait for DOCS-03.
- **D-08:** data-flow gets a short poller-lease subsection (~15 lines) and loses the retired pieces (`?key=` auth, `initializeOpenApiSpec()`, module-level state, "on-demand" season pipeline).
- **D-09:** database drops `Review` and `App` (migration `20260416091157_drop_unused_tables`), adds the lease columns and `api_rate_limit`, and states `TIMESTAMP(3)` (naive UTC), not `TIMESTAMPTZ` (19 cells today).
- **D-10:** infrastructure (largest page, ~150-220 lines) gets a deployment-topology section per D-04..D-06, current workflow file names and the full workflow list (10 files), the distroless runtime image, a complete env table (adds `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`, `FORCE_SEED`, the `*_FILE` convention; removes `POSTGRES_SSL`, `SKIP_MIGRATIONS` at `:433-434`), and the post-HOUSE-03 Sentry block (`:373-387`): no `productionBrowserSourceMaps`, no `silent`, the wrapper only when `SENTRY_AUTH_TOKEN` is set, maps deleted after upload. `.planning/codebase/CONCERNS.md:50-53` (#502) is updated in the same pass.
- **D-11:** testing: fix all drift outside the test layout now. Replace the enumerated directory tree, mermaid directory list and naming table with a short rule statement that links to AGENTS.md § Test Layout, so Phase 3 changes one paragraph. Remove the "euraika/aegis" reference (`:22`), the "Audience: … AI assistants" line (`:11`) and the instruction aimed at AI assistants (`:114`). `:271` (Playwright 1.64.1) and `:280,296` (`.vitest-attachments/`) are already correct.
- **D-12:** § Drift Inventory in `02-DISCUSSION-LOG.md` (re-checked 2026-10-23) is the executor's starting checklist. Each item is re-verified against code before editing. Criterion 2 closes on a final page-by-page check against the live code, recorded in the phase verification.
- **D-23:** Every edited Mermaid diagram is rendered in a real browser (DevTools) before the PR. mermaid went 11 → 12 (commit f58e3052) with no re-render of the docs pages, and `data-flow/page.mdx:55` styles a subgraph that no longer exists. `next build` does not execute client-side mermaid, so the build proves nothing about rendering.

**HOUSE-03 sourcemap strip**
- **D-13:** The #502 gate is met. Evidence: GlitchTip HELLDIVERSBOT-6C, event `69dc63bfe21b4745a561db74d2f99c35`, release `0.95.2`, environment `production`, a real Opera user; raw frame `29db8qr-sdvxo.js:2:2648` resolves to `src/features/notifications/NotificationToggle.jsx:118` with source context. Record this on #502 (the issue has 0 comments today).
- **D-14:** The change has 2 parts: delete `productionBrowserSourceMaps: true` (`next.config.mjs:15`) and add `sourcemaps: { deleteSourcemapsAfterUpload: true }` to the `withSentryConfig` options (`next.config.mjs:213-222`, inside the ternary at `:212-223`). Verified against `@sentry/nextjs` 11.8.0 (the version on develop since f58e3052): a user-set `productionBrowserSourceMaps` still cancels the SDK's own map switch and delete default (`withSentryConfig/getFinalConfigObjectBundlerUtils.js:127-129`, default delete at `:135-146`); the option name is unchanged (`types/config/types.d.ts:391`) and covers the Turbopack build the project uses (`package.json` `build` has no `--webpack`; delete globs in `getBuildPluginOptions.js:128-139`, applied in `handleRunAfterProductionCompile.js:43-58`). Keep the explicit option even though it matches the v11 default: it fixes the intent in place. Without `SENTRY_AUTH_TOKEN` the wrapper is skipped entirely, so after the change token-less builds (docker-smoke, self-hosters) produce no browser maps at all. This change also resolves review finding IN-03 (`01-REVIEW.md:207-214`; its import half landed in f58e3052) — mark it in `01-REVIEW-DISPOSITION.md`.
- **D-15:** Verification, all three recorded on #502 before it closes: (1) `.map` count and size in the image vs v0.95.2 (`docker create` + `docker export | tar -t` — the runtime is distroless, `Dockerfile.app:107`, no shell); (2) a production `.js.map` URL returns 404; (3) a symbolicated GlitchTip event from the phase-end release (D-21). Measure in a lane worktree after `npm ci`: the main checkout's `node_modules` still holds Sentry 10 and vitest 4.
- **D-16:** Server maps in `.next/standalone` (~46 files, ~184 KB) stay. They are not served over HTTP (`Dockerfile.app:137`).
- **D-24:** Sentry 11 symbolication on GlitchTip is proven on the first release (0.95.7, D-21) before the strip ships. The 0.95.2 proof used the old `sentry-cli` upload stack; f58e3052 replaced it with `@sentry/bundler-plugins` 11.8.0 + `sentry` 0.45.0 (debug-ID artifact bundles), which already reports "Successfully uploaded source maps" on the staging build (run 39574238756). Evidence = one 0.95.7 production event in GlitchTip whose frames resolve to source paths. If it does not symbolicate, HOUSE-03 blocks until the uploader is fixed; the public maps stay as the fallback meanwhile. The GlitchTip MCP connector needs re-authentication before this check.

**HOUSE-04 and HOUSE-05**
- **D-17:** #501 closes on the real run: run 35578125172 (2026-09-21) → PR #531 (only `prisma/seed/seasons/season-160.json`, bot commit `76865ef3`) → merged 2026-09-21 by merge commit `66093080`. The workflow runs Mondays (`scheduled-seed-refresh.yml:5`); the 4 runs since (09-28, 10-05, 10-12, 10-19) opened no PR, since season 161 is still active. The closing comment also records 2 gaps, both still in the current file (only setup-node changed since, fd0bd38c): (1) the PR is opened with `GH_TOKEN: ${{ github.token }}` (`:49`), so no workflow runs on it — #531 had 0 check runs and merged with no version bump; (2) a second run while the PR is open rebuilds the branch from develop (`:59`) with `push --force` (`:62`) and deletes any bump commit on it — exactly the commit the PR body (`:65`) and `prisma/seed/readme.md:49-51` tell the human to push. The gaps go into one new issue (milestone Engineering Health). The workflow does not change in this phase.
- **D-18:** Before `docs/roadmap.md` is retired, #469 (open, "Archives map: hide factions until their introduction point", milestone Archive Analytics & Dashboard) gets a requirement, **ARCH-11** (ARCH-10 is already closed-season caching, Phase 12), mapped to Phase 11 (War Playback, ARCH-05, shares the archives map surface) in `REQUIREMENTS.md` (requirement line, traceability table, coverage footer 79 → 80) and `ROADMAP.md`. Today `docs/roadmap.md:168` and `PROJECT.md:43` are its only schedule entries.
- **D-19:** `docs/roadmap.md` (576 lines, last change bb01517d) becomes a pointer of about 5 lines to `.planning/ROADMAP.md`. Update AGENTS.md:220 and `.planning/PROJECT.md:49,51,65,93`; `PROJECT.md:49` cites "`docs/roadmap.md` § Track F" for the four SSE questions — repoint it to SSE-01 / Phase 17, which already list them. Keep REQUIREMENTS.md:37, ROADMAP.md:96, CHANGELOG entries (`:566,1643,1651`) and the dated `.planning/research/*.md` files unchanged — the pointer keeps their links working.
- **D-20:** The prep ladder, per-issue prediction unblock gates and feature-reach table are not migrated. The pointer links to the last full version of the file (commit permalink), so the content stays one click away.

**Release**
- **D-21:** Two production releases (Andrei, 2026-10-23). (1) At the start of Phase 2: release develop as it stands (0.95.7: the Dependabot round incl. Sentry 11; `## Unreleased` is empty) — the develop/main gap is already at the STAB-07 limit of ~5 versions, and this release is the D-24 symbolication proof. (2) At phase end: HOUSE-03 and the docs, with D-15 check 3 on it. Each release follows AGENTS.md § Git Workflow rule 3 (develop → main PR, `vX.Y.Z` tag, merge-back). The Phase 1 STAB-06 gate is satisfied (window closed 2026-10-16, re-count done 2026-10-21).
- **D-22:** Each PR into develop carries its version bump and CHANGELOG move as its last commit (AGENTS.md rule 2). `Check: Version Bump` enforces this only for `src/**`, `prisma/**`, `public/**` and `package.json` (`.github/workflows/check-version.yml:10`); PRs that touch only `next.config.mjs`, AGENTS.md, `.example.env`, `docs/roadmap.md` or `.planning/**` get no CI reminder and must bump by hand. `.planning/`-only PRs (this context, plan docs) carry no bump.

**Review findings outside the requirements (Andrei, 2026-10-23)**
- **D-25:** WR-07 (`01-REVIEW.md:137-146`: the rewrites at `next.config.mjs:67-74` proxy `/api/record` and `/api/websites/:id/recorder` to the fixed Umami host on every deployment) is filed as a GitHub issue and deferred. It is not a ride-along: the suggested build-time env gate would strip the rewrites from production images, since `UMAMI_*` exist only at runtime (`:65-66`) and `Dockerfile.app` has no UMAMI build arg. The safe fix is a route handler like `/stats.js`. Natural home: Phase 5 (SEO-09 owns the Umami proxy wiring).
- **D-26:** WR-08 (`01-REVIEW.md:148-157`: the catch-all `public, s-maxage=30` rule at `next.config.mjs:193-199` caches HTML whose root layout renders `MinistryTriggerWidget` from the session, `src/app/layout.jsx:84-91,237`) is filed as a GitHub issue (milestone Engineering Health) and deferred. Impact is an easter-egg trigger with no privileged action behind it.

### Claude's Discretion
- Exact wording and structure of each rewritten docs section, within D-03..D-11.
- How the work is split into plans and PRs.
- Semver level of each bump (patch fits docs and config).
- Wording of the new issues (D-17 seed-refresh gaps, D-25 WR-07, D-26 WR-08).
- Whether AGENTS.md:222/224 "Phase N" milestone wording is touched (out of scope unless trivial).

### Deferred Ideas (OUT OF SCOPE)
- **Production move to the Pi swarm** (≥2 app replicas, one shared DB) — Andrei's stated plan. No requirement covers it; Phase 16 covers staging only. It needs a GitHub issue first (PROJECT.md § Out of Scope: new work gets an issue first).
- **Seed-refresh workflow gaps** (no CI on the bot PR; force-push deletes a bump commit) — new issue per D-17, later phase.
- **WR-07 Umami rewrite open proxy** — issue per D-25; route-handler fix in Phase 5.
- **WR-08 session-dependent HTML in shared cache** — issue per D-26; ~6-line cookie exclusion on the catch-all header rule, verified in a production build.
- **Docs drift outside the DOCS-02 list** (api, utilities, frontend-layout, …) — DOCS-03, Phase 18.
- **Lighthouse `valid-source-maps` audit** in `scheduled-pagespeed.yml` may change after D-14 — minor; check on the next PageSpeed run.
- **AGENTS.md:222/224 "Phase N" milestone wording** collides with GSD phase numbers — adjacent to D-03, touch only if trivial.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | CLAUDE.md (= AGENTS.md) § Architecture describes the lease/`worker_heartbeat` model, `WORKER_ENABLED`, multi-replica web tier; no module-level `lastSeasonObserved` | § Drift Verification A (AGENTS.md + stale comments, all quoted lines confirmed); lease facts in § Code Examples 1 |
| DOCS-02 | 5 public `/docs` pages match the code, verified page-by-page | § Drift Verification B-F; § Mermaid findings (only 5 pages render diagrams; on-demand correction); § Validation (stale-string sweep) |
| HOUSE-03 | Sourcemaps uploaded at build, stripped from the image after symbolication is proven | § HOUSE-03 (Sentry 11.8.0 file/line evidence, measurement procedure, baseline tag `v0.95.2`, 404 probe, release sequencing) |
| HOUSE-04 | Seed-refresh PR path verified end-to-end, run recorded on #501 | § HOUSE-04 (workflow line numbers, run/PR facts, what #501's checklist did and did not get) |
| HOUSE-05 | `docs/roadmap.md` retired to a pointer at `.planning/ROADMAP.md` | § HOUSE-05 (full reference classification, ARCH-11 row positions, permalink) |
</phase_requirements>

## Summary

All line numbers in CONTEXT.md D-02, D-03, D-14, D-17, D-19 and the Drift Inventory were re-checked against the lane checkout and **hold** (see tables). Three CONTEXT/Drift claims need correction before planning, and four facts are new and change the plan:

1. **Mermaid fences in MDX are not rendered.** Only the `<MermaidDiagram>` component renders diagrams. Every ```` ```mermaid ```` fence in `data-flow`, `infrastructure`, `database` and `testing` is shown as raw source text in a `<pre>` (`mdx-components.jsx:26-30`, `next.config.mjs:205-209` has `remark-gfm` only). D-23 ("render every edited diagram in a browser") therefore applies to exactly 5 pages: `/docs/architecture`, `/docs`, `/docs/notifications` (3 diagrams). For the fences, the useful check is a `mermaid.parse` pass under mermaid 12.2.0 (script in § Code Examples 4). That pass found one real failure: `database/page.mdx:170` `String userId PK-FK` does not parse (should be `PK, FK`).
2. **"On-demand" season fetching is NOT retired.** `updateSeason` still has on-demand callers: `/archives` and `/api/h1/campaign` via `getCampaignOrSeed`, `/api/h1/rebroadcast` (`route.js:126`), the four `/api/v1/h1/*` routes via `backfillAndRetry`, and the admin refresh via `reseedSeason`. D-08's "loses the on-demand season pipeline" and Drift line `:90` must be read as "also runs every poll and in the closing pass", not "on-demand is gone". `data-flow/page.mdx:439-458` ("On-demand invocation", "Frontend on-demand fetching") stays true in substance; `:441` ("not called on a schedule") is the false sentence.
3. **`ARCHITECTURE.md:125` keeps its behaviour.** `route.js:78-79` still returns 403 when `!isWorkerEnabled()`. Only the stated reason (stale in-process state) is wrong. Do not delete the 403.
4. **A `next.config.mjs` change is only provable on a build that has `SENTRY_AUTH_TOKEN`.** A local `npm run build` skips `withSentryConfig`, so it proves nothing about the strip. The `Build: Staging` workflow builds with the real token; measure the staging image `ghcr.io/elfensky/helldiversbot:sha-<commit>` for D-15 check 1 before cutting the phase-end release.

Also confirmed: the 0.95.2 symbolication proof was already an **artifact-bundle** upload (`01-RELEASE-RECORD.md:370` "Upload type: artifact bundle"), so GlitchTip accepting Sentry-11 debug-ID bundles is plausible but still unproven for 0.95.7 (D-24 stands). Extra drift not in the inventory: `architecture/dataFlowConfig.mjs` and `dataFlowDefinition.mjs` carry nine "~15s" strings and a wrong `snapshot` flow (lists `h1_statistic` and `h1_event_progress`, which `updateSeason` does not write).

**Primary recommendation:** Run the work as: release 0.95.7 → wait for a 0.95.7 production event and prove symbolication → one code/docs PR group (DOCS-01, DOCS-02, HOUSE-03 + infrastructure Sentry block together, HOUSE-05, ARCH-11) → measure the staging image → phase-end release → record #502 checks 2 and 3, close #501/#502.

## Architectural Responsibility Map

This phase changes documents, one build config and CI evidence, not runtime tiers. The map assigns each capability to the place that owns its truth.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lease/poller description (DOCS-01/02) | Source code (`src/update/lease.mjs`, `route.js`, `initializeWorker.mjs`) | `deploy/` compose files | D-01: live code + `deploy/` is ground truth; docs and maps follow |
| Rendered diagrams | Browser (client-only `import('mermaid')`) | Next server (MDX compile) | `useMermaidRender.mjs:27` loads mermaid in an effect; SSR returns empty string; `next build` only compiles MDX |
| Sourcemap generation and delete | Build (`next build` + Sentry `runAfterProductionCompile` hook, Turbopack) | Docker build stage | Maps are made, uploaded and deleted inside the `RUN npm run build` layer (`Dockerfile.app:89-96`); the runner stage copies what is left |
| Symbolication | GlitchTip (server) | Browser SDK (sends minified frames + debug IDs) | Resolution happens on GlitchTip from the uploaded artifact bundle |
| Seed refresh PR | GitHub Actions (`scheduled-seed-refresh.yml`) | `prisma/seed/fetch-seasons.mjs` | Workflow creates branch + PR with `github.token` |
| Execution-order source of truth | `.planning/ROADMAP.md` | GitHub issues (what) | HOUSE-05, PROJECT.md decision row 93 |
| Version bump enforcement | CI (`check-version.yml`) | Human (AGENTS.md rule 2) | Path-filtered; root files escape it (D-22) |

## Standard Stack

No new packages are installed in this phase. The relevant installed versions were read from the lane:

| Library | Version (lane) | Purpose | Source |
|---------|---------------|---------|--------|
| `@sentry/nextjs` | 11.8.0 | `withSentryConfig`, build-time upload and delete | `[VERIFIED: node_modules/@sentry/nextjs/package.json]` `"version": "11.8.0"` |
| `mermaid` | 12.2.0 | Client-side diagram render | `[VERIFIED: node_modules/mermaid/package.json:3]` `"version": "12.2.0"` |
| `next` | 16.4.2 (`^16.4.2` in `package.json:39`) | Build, Turbopack default | `[VERIFIED: node_modules/next/package.json]` |
| `@next/mdx` | `^16.4.2` | MDX docs pages, `remark-gfm` only | `[VERIFIED: package.json:29, next.config.mjs:205-209]` |
| `jsdom` | `^30.1.3` (devDependency) | DOM for the offline `mermaid.parse` check | `[VERIFIED: package.json:75]` |
| `vitest` | `^5.0.5` | `npm run test:unit` | `[VERIFIED: package.json:82]` |

**Installation:** none. **Executor prerequisite** (lane has no Prisma client yet, so `typecheck`, `test:unit` and `build` fail until it exists). CI does it without any env file, so the executor can too `[VERIFIED: .github/actions/verify/action.yml]`:

```bash
cd /Users/andrei/Developer/helldivers.bot/.worktrees/docs-phase-02-plan
POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' npx prisma generate
# build needs the three stub vars (action.yml Build step):
POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' UPDATE_KEY='ci-stub-key' UPDATE_INTERVAL='20' npm run build
```

Node: my shell reported `v26.8.1`, while `mise.toml` pins `node = "24"` and `.node-version` is `24`. The executor must confirm `node --version` prints 24 before running the verify chain (same trap as MEMORY: untrusted mise falls back to Homebrew).

## Package Legitimacy Audit

No external package is installed or added in this phase (`package.json` is touched only by the version bump). The `package-legitimacy` gate is not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Work-flow diagram (phase data/evidence flow)

```
develop @0.95.7 ──release PR──▶ main ──tag v0.95.7──▶ Build: Release (verify, app+migrate images, GitHub Release)
                                                         │  (build log must show "Successfully uploaded source maps to Sentry")
                                                         ▼
                                  Andrei pulls image on production host by hand  (no deploy step in build-release.yml)
                                                         ▼
                      GlitchTip: event release:0.95.7 environment:production, frames resolve to src/...  ── D-24 gate
                                                         │ pass
                                                         ▼
 lane PR(s) ──▶ develop ──Check: CI ▶ Build: Staging (real SENTRY_AUTH_TOKEN) ──▶ ghcr ...:sha-<commit>
   DOCS-01 / DOCS-02 / HOUSE-03 / HOUSE-05 / ARCH-11                                  │
                                                                                      ▼
                                              D-15 check 1: docker create + export on the staging image (.map count)
                                                         │
                                  release PR ─▶ main ─▶ tag v0.95.N ─▶ production pull ─▶ D-15 check 2 (404) + check 3 (symbolicated event)
                                                                                      ▼
                                                    close #502 (3 checks), comment+close #501, file 3 issues
```

### Recommended PR slicing (Claude's discretion; this is the research recommendation)

Parallel PRs each carry their own bump and would conflict on `package.json` and `CHANGELOG.md`. Use **two lane PRs, merged one after the other**, then one release:

| PR | Contents | Version-Bump CI trigger? |
|----|----------|--------------------------|
| A | `next.config.mjs` (HOUSE-03), `infrastructure/page.mdx` Sentry block + rest of infrastructure, CONCERNS.md:50-53, `01-REVIEW-DISPOSITION.md` IN-03/WR-07/WR-08 rows | yes (`src/**`); bump is mandatory anyway because `next.config.mjs` alone would escape the check |
| B | AGENTS.md (DOCS-01), stale comments (`route.js`, `initializeWorker.mjs`, `.example.env`, `cron.js`), other 4 docs pages + 2 lease-line pages, codebase maps + PROJECT.md:72, `docs/roadmap.md` pointer, ARCH-11 rows | yes (`src/**`, `public/**`) |

Hold PR A until the 0.95.7 symbolication proof (D-24). PR B does not depend on it and can merge first. Whichever merges second rebases onto the first's bump and takes the next patch number. Because the bump commit edits `package.json`, every such PR triggers `Check: Version Bump` anyway (and passes); the "no CI reminder" in D-22 only matters if the author forgets the bump.

### Anti-Patterns to Avoid
- **Hand-editing `.claude/CLAUDE.md`.** Generated, gitignored (`.gitignore:58` is `.claude`). The lane has no `.claude/` directory at all. Regeneration targets the **main checkout** and can only run after the PR merges and `git pull --ff-only` there (the maps are tracked in git). Treat it as a post-merge step; the command family is `generate-claude-md` in `gsd-tools.cjs` `[CITED: ~/.claude/gsd-core/bin/gsd-tools.cjs:5097]`; exact flags `[ASSUMED]`.
- **Deleting the 403 in `route.js` while fixing its comment.** Only the comment at `route.js:75-77` is stale.
- **Copying private infra detail into public pages.** `deploy/README.md:22` names a private IP and DB host, and the swarm secrets. Reuse the lease wording from `deploy/README.md:27-32` and `compose.yaml:58-66`, but do not copy host names, IPs, tunnel or secret names into `/docs/infrastructure`.
- **Renaming a node ID in a Mermaid definition without updating its config.** `MermaidDiagram.jsx:13-20` extracts IDs with `/flowchart-(.+)-\d+$/`; `flows` and `details` in the config key on those IDs. A renamed node silently loses its detail panel and flow highlight.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sourcemap delete after upload | A `postbuild` script or a Dockerfile `find -delete` | `sourcemaps.deleteSourcemapsAfterUpload: true` | The SDK deletes only after its own upload, strips `//# sourceMappingURL=` comments afterwards (`handleRunAfterProductionCompile.js:56-58`), and warns about uncovered maps. A Dockerfile delete runs even when upload failed |
| Seed-refresh PR checks | Changing the workflow now | New issue only | D-17: workflow does not change in this phase |
| Mermaid syntax check | Eyeballing | `mermaid.parse` under jsdom (script below) | Same engine and version as the browser |
| Registry size/count measurement | `docker run ... find` | `docker create` + `docker export` | Distroless has no shell; `docker run` cannot exec `find` |

## Runtime State Inventory

Not a rename/refactor phase. The only rename-like change is the doc pointer for `docs/roadmap.md`.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no data keyed on any renamed string | none |
| Live service config | GitHub issue bodies cite `.github/workflows/seed-refresh.yml` (#501 body) — old name, file is now `scheduled-seed-refresh.yml` | Closing comment on #501 uses the current name |
| OS-registered state | Production host runs `docker-compose.yml` with image tag `:staging` (`docker-compose.yml:5,16`); the HOUSE-03 change reaches it only when Andrei pulls a new image | none in repo; human pull step after each release |
| Secrets/env vars | `SENTRY_AUTH_TOKEN`, `SENTRY_URL`, `SENTRY_ORG`, `SENTRY_PROJECT` (names unchanged; passed as BuildKit secrets, `Dockerfile.app:89-93`) | none |
| Build artifacts | `.claude/CLAUDE.md` in the main checkout is generated from the maps and stale | Regenerate after the maps merge (post-merge step) |

## Drift Verification (lane checkout, 2026-10-23)

Legend: **holds** = the quoted line still says the stale thing at the quoted number. **Moved** and **New** are flagged explicitly. No quoted number had moved.

### A. AGENTS.md and code comments (DOCS-01)

| Item | Result | Evidence |
|------|--------|----------|
| AGENTS.md § Stack 184-206, Frontend Layout 210-212, Task Tracking 220 | holds | `AGENTS.md:184` is `## Architecture — Stack`; `:186-206` are the bullets; `:210-212` are Mobile-first/Key components/Dashboard hero; `:220` is `**Execution order lives in [\`docs/roadmap.md\`](docs/roadmap.md)**` |
| AGENTS.md :188, :189, :191, :200, :211 stale | holds | `:188` "The worker polls both every ~15 seconds"; `:189` "module-level state (`lastSeasonObserved`)"; `:191` "Both API endpoints polled every ~15s"; `:211` lists `TimelineSection`, `ConnectionStatus` |
| `EventLog` / `LastUpdated` exist, old names gone | confirmed | `src/features/timeline/EventLog.jsx` and `src/shared/components/LastUpdated.jsx` exist; `grep TimelineSection\|ConnectionStatus src` returns no source file |
| AGENTS.md :195 tracesSampleRate | holds | client `src/instrumentation-client.js:24` is `tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,`; server `sentry.server.config.js:31` is `tracesSampleRate: 1.0,` |
| `route.js:75-77` stale comment, `:34` "~15s" | holds | `:75-77`: "A web-only replica must never run the update: prevEvents and / lastSeasonObserved live in this process, so a poll landing here would / diff against stale state and re-send push notifications (#516)."; `:34`: "The worker polls every ~15s, so" |
| `route.js` 403 still exists | **keep** | `route.js:78-79` `if (!isWorkerEnabled()) return errorResponse(403, start, 'worker disabled on this instance');` |
| `route.js` top comment (`:27-29`) already correct | note | says the season and event snapshot "both live in the lease row, not in this process" — the file contradicts itself until `:75-77` is fixed |
| `initializeWorker.mjs:2-6` | holds | "Lets a horizontally scaled web tier run with the poller switched off: the update path keeps state in memory (prevEvents, lastSeasonObserved), so exactly one instance may poll — see #516. Deployments run N web replicas with WORKER_ENABLED=false and one worker replica with it on" |
| `initializeWorker.mjs` exit handling | confirms D-03 | `worker.on('exit', ...)`: `if (!shuttingDown) process.exit(1);` |
| `.example.env:11-13` | holds | "# WORKER_ENABLED="false" — serve web only, no poller. Exactly ONE instance per / # database may poll (#516); scaled deployments set this on the web replicas and / # run a separate 1-replica worker service from the same image." |
| `.example.env:10` | holds | `UPDATE_INTERVAL="20" # update interval in seconds` |
| `public/workers/cron.js:13` | holds | " * 1. Spawned by src/instrumentation.js during application startup" ; real chain: `src/instrumentation.js` imports `./instrumentation.node` and `src/instrumentation.node.js:16` calls `initializeWorker()` |
| Lease facts for the new text | confirmed | `lease.mjs`: `export const WORKER_TYPE = 'cron_api_poller';`, `export const LEASE_TTL_S = 60; // 3 polls at the 20 s staging cadence`; standby: `route.js` `successResponse(200, start, { role: 'standby', holder: HOLDER_ID })`; closing pass reads `lastSeasonObserved` from the lease at `route.js:91,126,130` and writes it at `:144`; `prevEvents` persisted at `:196` |
| `updateSeason` writes only 3 tables | confirmed | `src/update/season.mjs:10-12` imports `upsertSeason`, `upsertEvent`, `upsertStatus` only |
| `updateStatus` writes 5 tables | confirmed | `src/update/status.mjs:8-12` imports `upsertSeason`, `upsertEvent`, `upsertStatus`, `upsertStatistic`, `upsertEventProgress`; `upsertEventProgress` calls at `:101,118` |

### B. Codebase maps (D-02)

All five quoted lines hold (`STACK.md:85` "one dedicated 1-replica worker service"; `ARCHITECTURE.md:125` "a web-only replica must 403 rather than run stale-state logic"; `:127` "upserts into `h1_status` / `h1_statistic`" without `h1_event_progress`; `:130` "`h1_event`, `h1_event_progress`, `h1_season` ..., and `h1_statistic`"; `INTEGRATIONS.md:80` "Production runs 3 app replicas"). `PROJECT.md:72` holds ("Vitest 4").
**New (not in D-02):** `.planning/codebase/CONCERNS.md:35-39` is an entire concern titled "Worker poller state: CLAUDE.md describes module-level state that code no longer has". DOCS-01 resolves it; mark it resolved or remove it in the same pass. `CONCERNS.md:50-53` (#502) is already in D-10.

### C. architecture page (`src/app/docs/architecture/`)

| Item | Result |
|------|--------|
| `page.mdx:34` "polls the official API every 5-15 seconds" | holds |
| `dataFlowConfig.mjs:125-150` worker node (no lease), `:121` ends at `season-155.json`, `:153` subtitle `'prisma db seed'` | holds; `prisma/seed/seasons/` has **160** files |
| seed command | `Dockerfile.migrate:157` "`node --experimental-strip-types prisma/seed/seed.mjs`" |
| **New** `~15s` strings | `dataFlowDefinition.mjs:30` `api_status -->|"~15s"| worker`, `:31` `"~15s + on demand"`; `dataFlowConfig.mjs:6,65,69,86,90,132,136` — poll interval is `UPDATE_INTERVAL` (20 in `.example.env:10`); replace with the env var wording, not a number |
| **New** wrong `snapshot` flow | `dataFlowConfig.mjs` `flows.snapshot` includes `h1_statistic` and `h1_event_progress`; `updateSeason` writes neither. `flows.live` is correct (status path writes all five) |
| **New** `dataFlowDefinition.mjs:11` `seed_script` label `prisma db seed / startup` | same seed-command drift as `:153` |
| Diagram parses under mermaid 12.2.0 | yes (`DEFINITION_LR` and `DEFINITION_TD` both OK) |
| Subgraph/node names that no longer exist | **none** — `Sources`, `Processing`, `Normalized`, `Frontend` and every node ID exist. The fix is adding a lease/standby element (new node ID needs entries in `flows`/`details`) and correcting labels |

### D. data-flow page (`src/app/docs/data-flow/page.mdx`)

All Drift Inventory line numbers hold: `:4`, `:55`, `:90`, `:102-103` (`initializeOpenApiSpec()`), `:117`, `:150-155` (url at `:153` `?key=${key}`), `:177-180`, `:200`, `:441`, `:460-462`.
- `:55` `style Raw fill:#1c1917,...` — there is no `Raw` subgraph or node in the block at `:19-58`. Mermaid ignores a `style` for an unknown ID (the block parses OK), so this is dead text, not a render failure. It is also never rendered (fence).
- **Correction to `:90` and D-08:** see Summary item 2. Keep "On-demand invocation" (`:439-446`) and "Frontend on-demand fetching" (`:448-458`) in substance; fix `:441` ("`updateSeason()` is not called on a schedule") and `:90` ("runs on-demand"), and add the callers `backfillAndRetry` (4 v1 routes) and `reseedSeason` to the list.
- The `?key=` replacement is the header `Authorization: Bearer ${key}` plus `X-Worker-Startup` on the first poll and an optional `GLITCHTIP_HEARTBEAT_URL` POST `[VERIFIED: public/workers/cronLogic.js:28-43]`.
- `X-Worker-Startup`: `route.js:17` `export const WORKER_STARTUP_HEADER = 'x-worker-startup';`.

### E. infrastructure page

All inventory lines hold (`:24`, `:43`, `:49`, `:80`, `:88`, `:95`, `:105`, `:133`, `:155`, `:159`, `:171`, `:177`, `:185`, `:199`, `:201`, `:209`, `:217`, `:250`, `:310`, `:373-387`, `:401`, `:433-434`, `:452`). `:375` already says `@sentry/nextjs/config`. Workflow facts for the new section (all read this session):

| File (`.github/workflows/`) | `name:` | Trigger |
|---|---|---|
| `build-release.yml` | `Build: Release` | `push: tags: 'v*.*.*'` (`:3-5`); app image `linux/amd64,linux/arm64`; tags `:<tag>`, `:production`, `:latest` (`:64-68`) |
| `build-staging.yml` | `Build: Staging` | `workflow_run` of `Check: CI` completed (`:21-25`); tags `:staging` and `:sha-<TESTED_SHA>` (`:208-211`); `NODE_ENV=production`, `NEXT_PUBLIC_DEPLOY_ENV=staging` (`:212-213`) |
| `check-ci.yml` | `Check: CI` | PR and push on `main`, `develop`; name is load-bearing for `build-staging.yml` (`:1-3` comment) |
| `check-codeql.yml` | `Check: CodeQL` | PR/push `main`, `develop`, plus `schedule` |
| `check-dependencies.yml` | `Check: Dependencies` | PR `main`, `develop` |
| `check-docker-smoke.yml` | `Check: Docker Smoke` | PR to `main` |
| `check-migrate-arm64.yml` | `Check: Migrate Image (arm64)` | PR `develop`, `main` |
| `check-version.yml` | `Check: Version Bump` | PR to `develop`, `main`, paths `['src/**', 'prisma/**', 'public/**', 'package.json']` (`:6-10`) |
| `scheduled-pagespeed.yml` | `Scheduled: Pagespeed` | cron `0 0 * * 1` and `0 6 * * 5` |
| `scheduled-seed-refresh.yml` | `Scheduled: Seed Refresh` | cron `0 3 * * 1`, `workflow_dispatch` |

Composite actions: `.github/actions/verify` (lint, typecheck, unit, build with stub env) and `.github/actions/docker-publish`. Runtime image facts: `Dockerfile.app:107` `FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runner`, `:146` `CMD ["server.js"]`, `:150-151` HEALTHCHECK `--interval=30s --timeout=5s --start-period=30s --retries=3` with a `node -e fetch(...)` probe.
The release body comes from `CHANGELOG.md` via awk (`build-release.yml:176-180`), not `RELEASE.md`.

### F. database page

Inventory holds. `Review` at ER `:130,174`, section `:507`; `App` at ER `:187`, section `:561-563`; `TIMESTAMPTZ` count is **19** (`grep -c`). Lease columns, verbatim from `prisma/schema.prisma:237-250`: `holder_id String?`, `lease_until DateTime?`, `prev_events Json?`, `last_season_observed Int?`. `api_rate_limit` at `schema.prisma:258-266`: `@@id([key, route_group, window_start])`, `@@index([window_start])`. No `@db.Timestamptz` anywhere in the schema (grep returned nothing). The migration exists: `prisma/migrations/20260416091157_drop_unused_tables`. **New:** the ER block fails `mermaid.parse` at diagram line 97, file line `database/page.mdx:170` `String userId PK-FK`; mermaid 12.2.0 expects `PK, FK`. Because the fence is not rendered, this is invisible to readers; fix it while editing the ER block.

### G. testing page

Holds: `:11`, `:22`, `:107` (`npm test` row says "Run unit tests then smoke tests sequentially"; `package.json:15` `"test": "vitest run"`, `:16` `test:unit`, `:19` `test:smoke`, `:20` `"test:all": "vitest run && vitest run --config vitest.smoke.config.mjs"`), `:114`, `:137`, `:271` (already `v1.64.1`; `check-ci.yml:33` `container: mcr.microsoft.com/playwright:v1.64.1-noble`), `:280`, `:282` (`ci.yml`), `:296`. `vitest.visual.config.mjs:12-14` pins `attachmentsDir: '.vitest-attachments'`.

### H. Other pages (D-07 lease lines)

`notifications/page.mdx:115` "Keeps previous events in memory. ... Resets on server restart (acceptable — misses one transition at most)."; `notificationFlowConfig.mjs:175` "Keeps previous events in memory"; `pushFlowConfig.mjs:36` same; `docs/page.mdx:32` "worker pipeline, two-table strategy, and snapshot throttling"; `overviewConfig.mjs:92` "Internal POST endpoint called by the worker thread". Truth: `checkAndNotify(prevEvents)` receives the baseline from the lease (`route.js:189,196`); the endpoint is `GET` with `export const POST = methodNotAllowed;` (`route.js:212`). **Also stale, not in the inventory:** `data-flow` metadata `:4` repeats the same phrase as `docs/page.mdx:32`; and `notificationFlowConfig.mjs:57,63`, `inAppFlowConfig.mjs:47` say "Validates bearer token, then runs updateStatus() and updateSeason()" (true, but they omit the lease claim and standby early return; treat as optional wording, out of D-07).

### Mermaid: what actually renders (D-23)

`[VERIFIED: grep '<MermaidDiagram' src/app/docs --include=*.mdx]` — five pages instantiate the component. Everything else is a text fence.

| Page | Rendered diagram (needs a browser check if its files change) | Files in DOCS-02 scope that feed it |
|------|------------------------------------------------------------|---|
| `/docs/architecture` | `architecture/page.mdx:19` `id="data-flow"` | `dataFlowDefinition.mjs`, `dataFlowConfig.mjs` (definition, flows, details, legend) |
| `/docs` | `page.mdx:17` `id="docs-overview"` | `overviewConfig.mjs:92` (detail-panel text only; `overviewDefinition.mjs` unchanged) |
| `/docs/notifications` | `page.mdx:39,48,57` ids `notification-flow`, `inapp-flow`, `push-flow` | `notificationFlowConfig.mjs:175`, `pushFlowConfig.mjs:36` (detail-panel text only) |

Fences (text only, parse-check instead): architecture `:46`, data-flow `:19,:100`, infrastructure `:13,:135,:211`, database `:73,:215`, testing `:24`. Baseline `mermaid.parse` result under 12.2.0: all OK except `database/page.mdx` fence at `:73` (`PK-FK`).

**Rendering failure is silent.** `useMermaidRender.mjs:34-36` catches and logs `console.error('[MermaidDiagram] render failed:', err)` and leaves the SVG empty. A browser check must read the console and the DOM, not just look for a crash.

**Browser verification procedure (chrome-devtools MCP, no login needed per the user's browser rule):**
1. The dev server on `:3000` serves the **main checkout's** code (stale `node_modules`), not the lane. Start a lane server on another port. `[ASSUMED]` that this starts with no reachable DB, because `layout.jsx:80` wraps `getCampaign()` in `tryCatch` and `:81` handles `data` null; not run here because `prisma generate` has not run: `WORKER_ENABLED=false POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' UPDATE_KEY=x UPDATE_INTERVAL=20 npx next dev -p 3100` (or `npm run build` then `npx next start -p 3100`). `WORKER_ENABLED=false` keeps `initializeWorker` from spawning a poller (`initializeWorker.mjs`).
2. `navigate_page` to `http://localhost:3100/docs/architecture`, `/docs`, `/docs/notifications`.
3. `list_console_messages` — fail on any `[MermaidDiagram] render failed:`.
4. `evaluate_script`: `document.querySelectorAll('.diagram-canvas svg').length` equals the number of diagrams on the page; each `svg` contains `.cluster` elements for every `subgraph` and `.node` elements for every node ID in the definition (node `id` attributes look like `...flowchart-<nodeId>-<n>`, `MermaidDiagram.jsx:13-20`).
5. Click one changed node: the `DetailPanel` shows the new text. Click each view button (`All Flows`, `Live Polling`, `Snapshot Sync`, ...): non-flow nodes dim.
6. `resize_page` to ≤ 768 px wide and repeat: `MermaidDiagram.jsx:162` switches to `mobileDefinition` (the `TD` layout) via `matchMedia('(max-width: 768px)')`.
7. Production build check for the same pages once (`next start`), because `CLAUDE.md` and Phase 1 record that some rendering behaviour appears only in production builds.

**What `next build` does NOT prove:** (1) any client-side mermaid render (the import is client-only, `useMermaidRender.mjs:27`); (2) that a text fence still parses as Mermaid; (3) that prose matches the code; (4) the `SENTRY_AUTH_TOKEN` branch of `next.config.mjs` (skipped without the token); (5) the symbolication path. `next build` **does** fail on MDX syntax errors (stray `{`, `<`, unclosed tag), and `npm run lint` does **not** cover `.mdx` (`eslint.config.mjs:40` `files: ['**/*.{js,mjs,jsx}']`) — so for MDX the build is the only automatic gate, and the `.mjs` config files are covered by lint (Prettier) and typecheck.

## HOUSE-03: Sourcemap strip (verified against `@sentry/nextjs` 11.8.0 in the lane)

`[VERIFIED]` against files opened this session (paths under `node_modules/@sentry/nextjs/build/cjs/config/`):

| Behaviour | Evidence |
|-----------|----------|
| User-set `productionBrowserSourceMaps` makes the SDK stand down | `withSentryConfig/getFinalConfigObjectBundlerUtils.js:127` `if (incomingUserNextConfigObject.productionBrowserSourceMaps !== void 0) {` followed by `return;` — so today's explicit `true` also skips the delete default |
| With the option **unset**, the SDK enables maps on Turbopack and defaults to delete | `:134` `incomingUserNextConfigObject.productionBrowserSourceMaps = true;`, `:135` `if (userSentryOptions.sourcemaps?.deleteSourcemapsAfterUpload !== void 0) { return; }`, `:143-146` `userSentryOptions.sourcemaps = { ...userSentryOptions.sourcemaps, deleteSourcemapsAfterUpload: true }` — gated at `:124` by `!bundlerInfo.isTurbopackSupported \|\| !bundlerInfo.isTurbopack \|\| userSentryOptions.sourcemaps?.disable` |
| Delete globs (Turbopack) | `getBuildPluginOptions.js:48` `const SOURCEMAP_EXTENSIONS = ["*.js.map", "*.mjs.map", "*.cjs.map", "*.css.map"];` and `:138` `return SOURCEMAP_EXTENSIONS.map((ext) => path.posix.join(normalizedDistPath, "static", "**", ext));` — returns `undefined` for `webpack-nodejs`/`webpack-edge` (`:132`). Only `.next/static/**` is covered, so server maps stay (consistent with D-16) |
| Delete default is `false` unless set | `getBuildPluginOptions.js:184` `const deleteSourcemapsAfterUpload = sentryBuildOptions.sourcemaps?.deleteSourcemapsAfterUpload ?? false;` |
| Order in the post-compile hook | `handleRunAfterProductionCompile.js:43-46` `uploadSourcemaps`, then `:56` `await sentryBuildPluginManager.deleteArtifacts();`, then `:57-59` strips `sourceMappingURL` comments when `deleteSourcemapsAfterUpload && buildTool === "turbopack" && !sriEnabled` |
| Option name unchanged | `build/types/config/types.d.ts:391` `deleteSourcemapsAfterUpload?: boolean;` |
| Project builds with Turbopack | `package.json:9` `"build": "next build && serwist build"` (no `--webpack`); Next 16.4.2 |

Consequence for D-14: after deleting `next.config.mjs:15`, with the wrapper active the SDK itself sets `productionBrowserSourceMaps = true`; the explicit `deleteSourcemapsAfterUpload: true` is redundant but harmless and survives a default change. Without `SENTRY_AUTH_TOKEN` (`next.config.mjs:212` ternary) the wrapper is skipped, `productionBrowserSourceMaps` is undefined, and Next generates **no** browser maps.

**Risk (new):** the delete runs after the upload attempt. If an upload fails, the build can still finish, and the image has neither public maps nor an uploaded bundle (the #496 failure class). Keep `silent` unset (`next.config.mjs:214-217` comment) and make the release gate a log check: the build log must contain `[@sentry/nextjs - After Production Compile] Info: Successfully uploaded source maps to Sentry` once per architecture. Staging run 39574238756 (`Build: Staging`, sha `850011bb`, 2026-10-21) shows that line for `linux/amd64` and `linux/arm64` `[VERIFIED: gh run view --log]`. Whether an upload failure aborts the build was not tested `[ASSUMED]`.

**Edit shape** (`next.config.mjs`; Prettier `experimentalTernaries`, 4 spaces):

```js
// line 15: delete  productionBrowserSourceMaps: true,
export default process.env.SENTRY_AUTH_TOKEN ?
    withSentryConfig(finalConfig, {
        // (keep the existing "No `silent: true`" comment)
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        sentryUrl: process.env.SENTRY_URL,
        // Maps are generated only when this wrapper is active (the SDK turns on
        // productionBrowserSourceMaps itself), uploaded, then removed from .next/static.
        sourcemaps: { deleteSourcemapsAfterUpload: true },
    })
:   finalConfig;
```

**Other effects to check after the strip** (cheap):
- `public/sw.js` (generated by `serwist build` after `next build`) has no `.map` entries: `grep -c '\.map' public/sw.js` after a token build. `serwist.config.js` sets only `swSrc`, `swDest`, `additionalPrecacheEntries`, so precache is derived from the post-strip `.next/static` `[ASSUMED]` that `.map` was never precached.
- `scheduled-pagespeed.yml` Lighthouse `valid-source-maps` audit (deferred note in CONTEXT).
- IN-03 row in `01-REVIEW-DISPOSITION.md` is `open`, note "next.config.mjs details"; its import half is done (`next.config.mjs:1` is `import { withSentryConfig } from '@sentry/nextjs/config';`).

### D-15 check 1 — measurement procedure (distroless, no shell)

Baseline image: **`ghcr.io/elfensky/helldiversbot:v0.95.2`** (GitHub package version id `1384368055`, created `2026-10-14T10:21:40Z`, tags `v0.95.2,latest,production`) `[VERIFIED: gh api /users/elfensky/packages/container/helldiversbot/versions]`. `:latest` and `:production` float to the new release, so always pin `:v0.95.2`. The image is multi-arch (`build-release.yml:64` `platforms: linux/amd64,linux/arm64`); pin `--platform linux/amd64` for both sides so numbers compare.
Comparison image after the change: the staging build of the merge commit, `ghcr.io/elfensky/helldiversbot:sha-<full-commit-sha>` (`build-staging.yml:210`), and later `:v<new>`.
The Docker daemon was **not running** in this session (`docker version` could not reach the socket), so the commands below were not executed; the executor must start Docker first. The numbers "142 maps / ~24.6 MB" in CONTEXT and #502 are from a **v0.90.5 / main-checkout build**, not from the v0.95.2 image — re-measure the baseline.

```bash
# Run in an empty scratch dir; extraction targets are untrusted data, never run anything from them.
IMG=ghcr.io/elfensky/helldiversbot:v0.95.2
docker pull --platform linux/amd64 "$IMG"
CID=$(docker create --platform linux/amd64 "$IMG")        # create does not run the image
mkdir -p ./extract-v0952
docker export "$CID" | tar -x -C ./extract-v0952 app/.next app/public
docker rm "$CID"
# count and size of every .map in the image tree, split by location
find ./extract-v0952/app -name '*.map' | wc -l
find ./extract-v0952/app/.next/static -name '*.map' | wc -l
find ./extract-v0952/app/.next/static -name '*.map' -exec du -ck {} + | tail -1
find ./extract-v0952/app/.next/server -name '*.map' | wc -l      # D-16: expect ~46 files, stays
docker image inspect --format '{{.Size}}' "$IMG"                  # uncompressed image size
```
`docker export "$CID" | tar -t | grep -c '\.map$'` is the list-only variant (D-15 wording) and gives the count without extracting. Expected after the change: `.next/static` count `0`, `.next/server` unchanged, image size lower by roughly the static-map size (CONTEXT: ~24.6 MB). Record all numbers for both images on #502.

### D-15 check 2 — production `.js.map` returns 404

Run after the phase-end release is deployed on the production host (the release workflow has no deploy step; Andrei pulls the image by hand, `01-RELEASE-RECORD.md` § Production deployment). Take a real chunk URL from the live HTML rather than guessing a hash:

```bash
URL=$(curl -s https://helldivers.bot/ | grep -o '/_next/static/[^"]*\.js' | head -1)
curl -s -o /dev/null -w '%{http_code}\n' "https://helldivers.bot${URL}.map"     # after: 404
curl -s "https://helldivers.bot${URL}" | tail -c 200 | grep -c sourceMappingURL  # after: 0 (comment stripped)
```
Run the same two lines against `:v0.95.2`-era production before the release if a "before" value (expected `200`) is wanted for the #502 comment; #502's own text uses the same probe shape.

### D-15 check 3 and D-24 — symbolicated GlitchTip event

The GlitchTip MCP connector is not authenticated here, so this is a human or re-authenticated step. What the executor must verify:
- Filter: `release:<version> environment:production` (method of `01-GLITCHTIP-RECOUNT.md`). Runtime release string is `NEXT_PUBLIC_APP_VERSION` (`sentry.server.config.js:17`, `src/instrumentation-client.js:18`), i.e. the `package.json` version at build.
- Pass condition: at least one event from a **browser** bundle frame (a raw `NNNN.js:L:C` frame) shows the original path, e.g. `src/features/.../X.jsx:<line>`, with `context_line`. Server frames are not minified the same way and do not count.
- Debug-ID matching means the upload's own release name does not need to equal the event release; the 0.95.2 proof worked with "Upload type: artifact bundle" (`01-RELEASE-RECORD.md:370`) `[VERIFIED]`, with the caveat that 0.95.2 used `sentry-cli` and 0.95.7 uses `@sentry/bundler-plugins` (D-24).
- Release build log: grep `Successfully uploaded source maps to Sentry` in the `Build App Image` job of `Build: Release`.

## HOUSE-04: Seed refresh (D-17 facts, verified)

`[VERIFIED]` against `.github/workflows/scheduled-seed-refresh.yml` and `gh`:

| Claim | Evidence |
|-------|----------|
| Cron Mondays | `:5` `- cron: '0 3 * * 1' # Every Monday at 03:00 UTC` |
| PR opened with the default token | `:49` `GH_TOKEN: ${{ github.token }}` (a PR created with `github.token` does not trigger other workflows) |
| Branch rebuilt from develop | `:28` checkout `ref: develop`; `:59` `git checkout -B chore/seed-refresh` |
| Force push | `:62` `git push --force origin chore/seed-refresh` |
| PR body tells the human to push the bump | `:65` `--body 'Automated weekly run of ... Push the version bump + CHANGELOG commit onto this branch, then rebase-merge.'` |
| Fallback when PR exists | `:66` `|| echo 'PR already open — branch updated.'` |
| Readme tells the same | `prisma/seed/readme.md:49-51` "Push the version bump + CHANGELOG entry onto / that branch as usual (from a worktree), then rebase-merge the PR — the / workflow deliberately does not touch either." |
| Run 35578125172 | `schedule`, `success`, created `2026-09-21T08:29:00Z`, head `4647314564ef...` |
| PR #531 | `MERGED`, `mergedAt 2026-09-21T22:10:17Z`, merge commit `66093080a32be20c6adc4c3a3eb8e9239cb7bf9d`, one commit `76865ef3 chore(seed): add newly completed seasons`, one file `prisma/seed/seasons/season-160.json`, `statusCheckRollup` length `0` |
| Merged with no bump | `package.json` is `0.94.0` on both `66093080` and its first parent |
| 4 later runs, no PR | `39222367398` (10-19), `38234178730` (10-12), `37293119742` (10-05), `36402324349` (09-28): all `success`, `schedule`; no PR |
| #501 state | `OPEN`, 0 comments, milestone Engineering Health, labels `infrastructure, chore, testing` |

**What the real run did and did not prove (the closing comment must say this).** #501's own checklist lists three unverified items: (1) `checkout -B` + `push --force`, (2) `gh pr create` under `github.token`, (3) "the `|| echo 'PR already open'` fallback when a second run precedes the merge". Run 35578125172 proves (1) and (2). Item (3) was **not** exercised: PR #531 merged the same day, so the next run found no changes and exited at `:54`. #501's close criterion 3 ("Merging it locally with `--no-ff` + version bump + CHANGELOG works as documented") was met only in part: #531 merged by a merge commit with no bump and no CHANGELOG entry. HOUSE-04's wording allows "a real season transition, or a controlled simulation"; the real transition satisfies it, but the fallback path stays code-reading only. Offer Andrei a choice (Open Question 1) rather than closing silently.

The new "gaps" issue should state: gap 1 (no CI on bot PR; `Check: Version Bump` would match `prisma/**` but never runs), gap 2 (second run force-pushes over the bump commit; the fallback `|| echo` also hides a real `gh pr create` failure), and the #501 body's stale file name `seed-refresh.yml`. Milestone Engineering Health; labels `infrastructure`, `chore`.

## HOUSE-05: `docs/roadmap.md` references (grep of the whole lane, excluding `node_modules`, `.git`, `.next`, `graphify-out`)

| File:line | Classification | Reason |
|-----------|----------------|--------|
| `AGENTS.md:220` | **repoint** | Task Tracking sentence; D-03/D-19 |
| `.planning/PROJECT.md:49` | **repoint** | "§ Track F" → SSE-01 / Phase 17 (the four questions are already listed there) |
| `.planning/PROJECT.md:51` | **rewrite** | "reconciled or retired" checkbox → retired (tick it) |
| `.planning/PROJECT.md:65` | **rewrite** | "Execution order doc: `docs/roadmap.md`..." bullet now points to the pointer file; its "Stale items" list can go |
| `.planning/PROJECT.md:93` | **update** | decision row `— Pending` → resolved once done |
| `.planning/PROJECT.md:43` | **edit for D-18** | mentions #469 under Housekeeping (Track A); add ARCH-11 / Phase 11 |
| `.planning/REQUIREMENTS.md:37` | leave | HOUSE-05 text |
| `.planning/ROADMAP.md:96` | leave | Phase 2 SC 5 text |
| `.planning/research/{ARCHITECTURE:5,86,115,168; PITFALLS:165; FEATURES:9,189,237; SUMMARY:102,146}.md` | leave | dated research; the pointer keeps the file path valid |
| `CHANGELOG.md:566,1643,1651` | leave | history |
| `.planning/phases/02-*/02-CONTEXT.md`, `02-DISCUSSION-LOG.md` | leave | planning record |
| Other roots (`README.md`, `src/`, `.github/`, `docs/superpowers/`) | none | grep for `roadmap` outside `.planning`, `CHANGELOG.md`, `AGENTS.md`, `docs/roadmap.md` returned no file |

`docs/roadmap.md`: 576 lines `[VERIFIED: wc]`; `git log -1 -- docs/roadmap.md` is `bb01517d560cc7ec1d673a280628ce5e86f00dc4`; `git show bb01517d:docs/roadmap.md | wc -l` is 576, and that commit is an ancestor of both `origin/develop` and `origin/main`, so a permalink `https://github.com/elfensky/helldivers.bot/blob/bb01517d560cc7ec1d673a280628ce5e86f00dc4/docs/roadmap.md` is stable and survives rebase-merges (use this commit, not a lane commit, whose SHA a rebase-merge would rewrite). `docs/roadmap.md:168` is `### S2a — Archives map: hide factions until introduced ([#469](...))`; its Prep line says "plan — the risk is in the blast radius, not the logic" (carry that into the ARCH-11 text).

**#469 now has 1 comment** (2026-07-27, "Verified in the browser ... season 160 ... `introduction_order` is `[0, 1, 2]`", Bugs day 1, Illuminate day 2, Cyborgs day 3), not 0 as the discussion log recorded; state `OPEN`, milestone "Archive Analytics & Dashboard" `[VERIFIED: gh issue view 469]`. `#469` appears in neither `REQUIREMENTS.md` nor `ROADMAP.md` today (grep for `469` in `.planning/REQUIREMENTS.md`, `ROADMAP.md` and `STATE.md` returned no line mentioning it).

**ARCH-11 placement** `[VERIFIED: file reads]`:
- `REQUIREMENTS.md:86` is `- [ ] **ARCH-10**: ...` (taken) → ARCH-11 is next free. Add `- [ ] **ARCH-11**: #469 — archives map hides each faction until its introduction point (...)` after `:86`. The #469 comment's data (intro order, `first_seen`) is the acceptance basis.
- Traceability table: `| ARCH-10 | Phase 12 | Pending |` is at `:216`; add `| ARCH-11 | Phase 11 | Pending |` after it (the table is ordered by ID, not by phase).
- Coverage footer `:242-243`: `- v1 requirements: 79 total` and `- Mapped to phases: 79` → `80`/`80`. Optionally refresh the `*Last updated:` line at `:247`.
- `ROADMAP.md`: Phase 11 header block at `:224-236`; `:229` `**Requirements**: ARCH-02, ARCH-03, ARCH-04, ARCH-05` → append `ARCH-11`; add success criterion 5 after `:235` (`4. A player can scrub ...`). The phase-list line `:26` and Phase 11 goal need no change.
- Pointer content for `docs/roadmap.md` (~5 lines): title, one sentence "Execution order lives in `.planning/ROADMAP.md`; what-to-build lives in GitHub issues", link to `.planning/ROADMAP.md`, link to the `bb01517d` permalink. The `docs/roadmap.md` path must keep existing (research files link it).

## Release mechanics (D-21, D-22)

- `check-version.yml:6-10`: `pull_request: branches: [develop, main]`, `paths: ['src/**', 'prisma/**', 'public/**', 'package.json']`; job skipped for `dependabot[bot]` (`:24`); fails when `package.json` version equals the base branch's (`:35-40`). A release PR `develop → main` triggers it and passes (0.95.7 vs `main` 0.95.2). A bump commit always edits `package.json`, so any PR that includes it also runs the check.
- `check-ci.yml` has **no** `paths` filter, so docs-only and `.planning`-only PRs still run `Check: CI` (lint, typecheck, unit tests, build with stub env via `.github/actions/verify`).
- Rule 3 (AGENTS.md § Git Workflow): PR `develop` → `main`, merged `gh pr merge --merge`; **tag `vX.Y.Z` on that merge commit** (latest `CHANGELOG.md` version); push tag; merge-back by PR `gh pr create --base develop --head main --fill && gh pr merge main --merge` (never `--delete-branch`). Tag trigger: `build-release.yml:3-5` `push: tags: - 'v*.*.*'`. `Check: Docker Smoke` runs on PRs to `main` (`check-docker-smoke.yml:23`).
- State now: `package.json` `"version": "0.95.7"`; `CHANGELOG.md:3` `## Unreleased` (empty), `:5` `## 0.95.7`; latest tag `v0.95.2`; `origin/develop` is 42 commits ahead of `origin/main`.
- The GitHub Release body is awk-extracted from the `## <version>` section of `CHANGELOG.md` (`build-release.yml:176-180`); a missing or empty section degrades to "Release <tag>" with a warning, so the bump commit's CHANGELOG move is not optional for release 2.
- The merge-back and release PRs use merge commits; all other PRs use `--rebase` (rule 0). Note for awareness only: `REQUIREMENTS.md` DEPS-03/DEPS-04 (Phase 4) plan to change the allowed merge methods; until then AGENTS.md rule 0 stands.
- Suggested sequence for the planner: (1) release 0.95.7 (`.planning`-only plan PR for this phase does not need to land first); (2) Andrei deploys and reports a 0.95.7 production event; (3) HOUSE-03 symbolication proof recorded; (4) lane PRs; (5) measure staging image; (6) release 2 with its own version; (7) D-15 checks 2 and 3; (8) close #502, comment+close #501, file the three issues (D-17 gaps, WR-07, WR-08), update `01-REVIEW-DISPOSITION.md`.

## Common Pitfalls

### Pitfall 1: Verifying a diagram that is not rendered
**What goes wrong:** executor opens `/docs/data-flow` expecting an SVG and sees code text, or "verifies" a fence by eye.
**Why:** `mdx-components.jsx:26-30` maps `pre` to a plain `<pre>`; no remark/rehype mermaid plugin (`next.config.mjs:205-209`).
**How to avoid:** use the table in § Mermaid; run the parse script for fences; use the browser only for the 5 component pages.
**Warning signs:** `.diagram-canvas svg` count is 0 on a page that has only fences.

### Pitfall 2: Treating the local build as proof of the strip
**What goes wrong:** `npm run build` passes locally, executor reports HOUSE-03 verified.
**Why:** no `SENTRY_AUTH_TOKEN` locally, wrapper skipped (`next.config.mjs:212`).
**How to avoid:** the only valid proof is the image from a token build (`Build: Staging` / `Build: Release`) measured with § D-15 check 1.

### Pitfall 3: Deleting "on-demand" because the inventory says retired
See Summary item 2. Edit sentences, not sections.

### Pitfall 4: Wrong baseline for the size comparison
`:latest`/`:production` move on each release; `142 maps / 24.6 MB` is a v0.90.5 figure. Pin `:v0.95.2` and re-measure.

### Pitfall 5: Detail-panel keys out of sync with the diagram
Adding a lease node to `dataFlowDefinition.mjs` without a `details.<id>` entry and `flows` membership gives a node that opens an empty panel and never highlights. Add all three in one edit.

### Pitfall 6: Version conflicts between parallel docs PRs
Each PR bumps `package.json` and moves `CHANGELOG.md`. Merge in sequence; the second PR re-bumps after rebase.

### Pitfall 7: `.claude/CLAUDE.md` regenerated in the wrong checkout
It lives in the main checkout, is gitignored, and is generated from tracked maps. Regenerating in the lane produces a file no session loads. Do it after the merge and `git pull --ff-only` there.

### Pitfall 8: Public docs leaking private topology
See § Anti-Patterns (host, IP, secret names from `deploy/README.md`).

### Pitfall 9: Claiming #501 is fully verified
See § HOUSE-04. State the unexercised fallback path and the missing bump/CHANGELOG on #531 plainly (AGENTS.md "Report outcomes faithfully").

## Code Examples

### 1. Lease facts for DOCS-01/02 text (all read this session)

```js
// src/update/lease.mjs
export const WORKER_TYPE = 'cron_api_poller';
export const LEASE_TTL_S = 60; // 3 polls at the 20 s staging cadence
// src/app/api/h1/update/route.js
if (!lease)
    return successResponse(200, start, { role: 'standby', holder: HOLDER_ID });
const { prevEvents, lastSeasonObserved } = lease;
// src/shared/utils/initializeWorker.mjs
return !['false', '0', 'no', 'off'].includes(v);
```
`SENTRY_SERVER_NAME` feeds the holder id (`makeHolderId`: `` `${host}:${process.pid}:${randomUUID().slice(0, 8)}` ``). `started_at` resets only when the holder changes (`claimLease` SQL `CASE WHEN worker_heartbeat.holder_id IS DISTINCT FROM EXCLUDED.holder_id`). Timestamps use `now() AT TIME ZONE 'UTC'` because columns are naive `timestamp(3)`.

### 2. Mermaid parse check for text fences and definition files (jsdom needed for DOMPurify)

```js
// Run from outside the repo: node /abs/path/parse.mjs   (reads, never writes, the lane)
import fs from 'node:fs';
const L = '/Users/andrei/Developer/helldivers.bot/.worktrees/docs-phase-02-plan';
const { JSDOM } = await import(L + '/node_modules/jsdom/lib/api.js');
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
const mermaid = (await import(L + '/node_modules/mermaid/dist/mermaid.core.mjs')).default;
for (const p of ['architecture', 'data-flow', 'infrastructure', 'database', 'testing', 'notifications']) {
    const t = fs.readFileSync(`${L}/src/app/docs/${p}/page.mdx`, 'utf8');
    for (const m of t.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
        const line = t.slice(0, m.index).split('\n').length;
        try { await mermaid.parse(m[1]); console.log('OK  ', p, 'fence@' + line); }
        catch (e) { console.log('FAIL', p, 'fence@' + line, String(e.message).split('\n').slice(0, 4).join(' | ')); }
    }
}
// Definition files: read BODY, wrap as "graph LR\n"+BODY and "graph TD\n"+BODY (see _diagram.mjs), then mermaid.parse each.
```
Baseline output today: every line `OK` except `FAIL database fence@73 ... Expecting 'BLOCK_STOP', 'ATTRIBUTE_WORD', ',', 'COMMENT', got '-'` (`PK-FK`).

### 3. Stale-string sweep (a cheap guard for DOCS-02, bash)

```bash
PAGES="src/app/docs/architecture src/app/docs/data-flow src/app/docs/infrastructure src/app/docs/database src/app/docs/testing src/app/docs/notifications src/app/docs/page.mdx src/app/docs/overviewConfig.mjs"
grep -rnE "TIMESTAMPTZ|initializeOpenApiSpec|\?key=|staging\.docker\.yml|release\.docker\.yml|metrics\.yml|[^-a-z]ci\.yml|euraika|aegis|POSTGRES_SSL|SKIP_MIGRATIONS|5-15 seconds|silent: true|snapshot throttling|AI assistants|Never start the dev server from Claude" $PAGES   # baseline today: 42 lines; target 0
grep -rnE "~15 ?s|every ~15|in memory" $PAGES                                                                                         # baseline today: 11 lines; target 0
grep -nE "module-level state|~15 seconds|~15s|docs/roadmap\.md|TimelineSection|ConnectionStatus" AGENTS.md                              # baseline: lines 188,189,191,211,212,220; target none
```
Run under `bash -c`; the interactive shell is zsh and an unmatched glob aborts the command.

### 4. Lane-local dev server for the browser check (assumption, not run)
See § Mermaid step 1.

## State of the Art

| Old | Current | Changed | Impact |
|-----|---------|---------|--------|
| `sentry-cli` upload (0.95.2) | `@sentry/bundler-plugins` 11.8.0 + `sentry` 0.45.0, debug-ID artifact bundles | f58e3052 (0.95.7 line) | D-24 re-proof; log line `[@sentry/nextjs - After Production Compile] Info: Successfully uploaded source maps to Sentry` |
| `withSentryConfig` from `@sentry/nextjs` | from `@sentry/nextjs/config` | f58e3052 (`next.config.mjs:1`) | IN-03 import half done |
| mermaid 11 | 12.2.0 | f58e3052 | `PK-FK` ER attribute no longer parses; `MermaidDiagram.jsx:11` documents v12 ID format |
| vitest 4 | 5.0.5 | f58e3052 | `attachmentsDir` pinned (`vitest.visual.config.mjs:12-14`); `PROJECT.md:72` fix |
| Sentry 10 `sendDefaultPii` | v11 `dataCollection` | f58e3052 | infrastructure page Sentry text (`:302-313,375` already touched by 48c056ee) |
| #516 model (web-only replicas, one worker service) | #517 lease (every replica polls, one holder) | before 0.95.2 | the core DOCS-01/02 subject |

**Deprecated/outdated:** `initializeOpenApiSpec()` / `src/utils/initialize.openapi.mjs` (gone from `src`, grep empty), `?key=` auth, `POSTGRES_SSL`, `SKIP_MIGRATIONS` (unused), `RELEASE.md` as release body source.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A lane dev/prod server starts without a reachable Postgres because `layout.jsx:80-81` tolerates `getCampaign()` failure | Mermaid step 1 | Executor needs a real DB or env file to view docs pages; add an env file or use a prod build |
| A2 | If the Sentry upload fails, the build still completes and the delete still runs | HOUSE-03 risk | If the build aborts instead, the risk is smaller than stated; the log-grep gate remains useful either way |
| A3 | `.map` files were never in the Serwist precache | HOUSE-03 other effects | `public/sw.js` size shrinks or a precache entry 404s after the strip; grep `public/sw.js` after a token build |
| A4 | `generate-claude-md` flags/behaviour for the main checkout regeneration | Anti-Patterns | Wrong command; fall back to the `/gsd-profile-user`-adjacent GSD command in the main checkout |
| A5 | GlitchTip resolves Sentry-11 debug-ID bundles the same way as the `sentry-cli` 0.95.2 bundle | HOUSE-03 / D-24 | Strip blocked until uploader fixed (CONTEXT already plans for this) |
| A6 | A production event on 0.95.7 with a minified browser frame will arrive without help | D-24 | Gate stalls; see Open Question 3 |

## Open Questions

1. **Should #501 close on the real run alone, or also on a controlled simulation of the "second run while PR is open" path?**
   - Known: item (3) of #501's checklist (the `|| echo 'PR already open'` fallback) never ran for real; D-17 says the workflow does not change.
   - Unclear: whether Andrei accepts "unexercised, recorded as a gap" as closure.
   - Recommendation: close #501 with the facts above, state item 3 as "not exercised, see new issue", and put the simulation in the new gaps issue. Ask Andrei at the natural stop.
2. **Where to run the lane server for the browser check?**
   - Known: `:3000` serves the main checkout's stale build.
   - Recommendation: port 3100 from the lane, stub env (A1).
3. **How to get a 0.95.7 browser event on demand?**
   - Known: the 0.95.2 proof was a natural Opera event; staging (`Build: Staging`, same uploader, token present) runs the same Sentry 11 build.
   - Unclear: whether staging reports to the same GlitchTip project (`deploy/README.md:33` says "Auth/Umami/Sentry unset on purpose" on staging, so **probably not**).
   - Recommendation: planner adds a `checkpoint:human-verify` for D-24, with "wait for a natural 0.95.7 production browser error" as the main path and Andrei choosing a probe method otherwise.
4. **Remaining `01-REVIEW-DISPOSITION.md` rows.** 14 of 17 rows (WR-01..06, WR-09..11, IN-01, IN-02, IN-04..06) stay `open`; the file says every row is "triaged in Phase 2 or as a GitHub issue". CONTEXT handles only WR-07, WR-08, IN-03. Recommendation: leave the others open and say so; do not fold them in.
5. **Semver levels.** Patch fits both PRs (Claude's discretion). Release 2 gets the version of whichever PR merges last.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker daemon | D-15 check 1 | no (CLI 29.9.1, socket missing: `dial unix /Users/andrei/.docker/run/docker.sock`) | CLI only | Start Docker Desktop; measure on a machine with Docker |
| `gh` | issues, runs, package versions | yes, logged in as `elfensky` | — | — |
| Node 24 (mise) | verify chain | not active in my shell (`v26.8.1`) | — | `mise` trust/activate in the executor shell |
| `npm ci` / lane `node_modules` | all builds | yes (Sentry 11.8.0, mermaid 12.2.0, Next 16.4.2) | — | — |
| Prisma client in lane | typecheck, unit, build | no | — | `POSTGRES_URL=... npx prisma generate` (prerequisite above) |
| GlitchTip MCP | D-24, D-15 check 3 | no (not authenticated) | — | Re-authenticate, or read in the GlitchTip UI |
| chrome-devtools MCP | D-23 | not probed this session | — | executor probes first call; project rule says chrome-devtools for no-login pages |
| Production host pull | D-15 checks 2 and 3 | human (Andrei) | — | — |

**Missing with no fallback:** none blocking planning. **Blocking at execution:** Docker daemon (check 1), GlitchTip access (D-24 gate), production deploy by Andrei.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 (`package.json:82`) |
| Config file | `vitest.config.mjs` (unit), `vitest.smoke.config.mjs`, `vitest.visual.config.mjs` |
| Quick run | `npx vitest run src/__tests__/unit/_meta` |
| Full suite | `npm run lint && npm run typecheck && npm run test:unit && npm run build` (stub env, § Standard Stack) |

### Phase Requirements → Validation Map
| Req | Behavior | Check type | Command / evidence | Exists |
|-----|----------|-----------|--------------------|--------|
| DOCS-01 | AGENTS.md has lease model, no module-level `lastSeasonObserved` | grep guard + review | § Code Examples 3 third command; read AGENTS.md § Architecture | ✅ (command) |
| DOCS-01 | Edited comments don't break code | unit/lint | `npm run lint && npm run test:unit`; `.example.env` safe: `src/__tests__/unit/_meta/exampleEnv.test.mjs` asserts only `PORT="3000"`, `DEPLOY_ENV=""` and no `POSTGRES_SSL=` | ✅ |
| DOCS-02 | MDX compiles | build | `npm run build` (only automatic MDX gate; ESLint ignores `.mdx`) | ✅ |
| DOCS-02 | `.mjs` configs lint/typecheck | lint + typecheck | `npm run lint`, `npm run typecheck` | ✅ |
| DOCS-02 | Stale strings gone | grep guard | § Code Examples 3 (baselines 42 / 11) | ✅ (command) |
| DOCS-02 | Mermaid fences parse under 12.2.0 | script | § Code Examples 2 | ❌ Wave 0 (script lives outside repo; copy to scratch) |
| DOCS-02 | 5 rendered diagrams render | browser | § Mermaid steps 1-7 | manual / human-verify |
| DOCS-02 | Page-by-page match with live code | human review | record in phase VERIFICATION per D-12 | manual |
| HOUSE-03 | `next.config.mjs` change correct | review + token build | log line `Successfully uploaded source maps to Sentry` | after merge (staging build) |
| HOUSE-03 | `.map` gone from image | measurement | § D-15 check 1 | manual (Docker) |
| HOUSE-03 | prod 404 | probe | § D-15 check 2 | manual (post-deploy) |
| HOUSE-03 | symbolicated event | GlitchTip | § D-15 check 3 / D-24 | manual (human-verify) |
| HOUSE-04 | #501 evidence recorded | `gh` | `gh issue view 501 --json comments,state` after closing | manual |
| HOUSE-05 | pointer exists, links resolve | grep + review | `wc -l docs/roadmap.md` ≈ 5; AGENTS.md:220 no longer links the old content; `.planning/PROJECT.md` lines 49,51,65,93 edited | ✅ (command) |
| ARCH-11 | row counts consistent | grep | `grep -c '^| ARCH-' .planning/REQUIREMENTS.md` = 11 and footer says 80 | ✅ (command) |

### Existing automated checks that matter
- `src/__tests__/unit/_meta/mirrorTree.test.mjs` fails `npm run test:unit` if a new test is not at its mirrored path. This phase adds no tests, so it only matters if the executor adds one.
- `src/__tests__/unit/app/sitemap.test.mjs` touches the docs route list; no page is added or removed here.
- `src/__tests__/unit/app/docs/_diagram.test.mjs` covers `_diagram.mjs` (`createFlowConfig`, `buildMermaidDefinition`) — keep that file's exports unchanged.
- No test reads AGENTS.md, `next.config.mjs` or CHANGELOG (grep of `src/__tests__` for those names returned no match outside docs components).

### Sampling Rate
- **Per task commit:** the relevant grep guard plus `npx vitest run src/__tests__/unit/_meta`.
- **Per wave merge:** lint, typecheck, `test:unit`, `build` (all four, per AGENTS.md Critical Rules).
- **Phase gate:** all four green, grep guards at 0, parse script clean, browser check recorded, D-15 numbers on #502.

### Wave 0 Gaps
- [ ] Copy the parse script (§ Code Examples 2) to the scratchpad and capture the "before" output.
- [ ] `POSTGRES_URL=... npx prisma generate` in the lane.
- [ ] Capture the v0.95.2 baseline (Docker) before the strip lands.

## Security Domain

`security_enforcement: true`, ASVS level 1, block on `high` (`.planning/config.json`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no auth code changes) | — |
| V3 Session Management | no | — |
| V4 Access Control | no (WR-08 is filed, not fixed) | — |
| V5 Input Validation | no new input | — |
| V6 Cryptography | no | — |
| V8 Data Protection | yes (minor) | sourcemaps removed from the image; repo is public so source exposure is "accepted, not a concern" (#502 body) — the change is about image weight |
| V14 Configuration | yes | secrets via BuildKit `--mount=type=secret` (`Dockerfile.app:72-93`), never build args; do not paste tokens or private hosts into issues or public docs |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret or token pasted into an issue comment or `/docs` page | Information disclosure | Names only (`SENTRY_AUTH_TOKEN`), never values; the DSN is public by design, the auth token is not |
| Internal topology in public docs (private IP, DB host, tunnel/secret names from `deploy/README.md`) | Information disclosure | Describe roles and replica counts, omit hosts and secret names |
| Upload failure silently leaves an image with no maps and no GlitchTip bundle | Repudiation / availability of diagnostics | Keep `silent` unset; gate release on the upload log line |
| `GH_TOKEN: github.token` PR path runs no CI (gap 1) | Tampering (unchecked changes merge) | Recorded as a gap; bot PR touches only `prisma/seed/seasons/*.json`; fix is a later phase |

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` is a symlink to `AGENTS.md` (read this session). Directives that bind this phase:
- KISS; no abstractions for hypothetical needs.
- Never commit or push to `main`/`develop`; one locked worktree per session; every change by PR; rebase-merge into `develop`, merge commits only for the release PR and its merge-back.
- Verify chain before the PR: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` — all four green; `npm run lint:fix` before committing, not during development.
- Version bump as the PR's last commit (patch for docs/config); `## Unreleased` → `## X.Y.Z` in `CHANGELOG.md`.
- Report outcomes faithfully; do not claim a check ran that did not.
- Do not hand-edit `.claude/CLAUDE.md`.
- Browser work with no login uses chrome-devtools; verify via DevTools before declaring a frontend change done.
- Next.js here has breaking changes: read `node_modules/next/dist/docs/` before writing Next code (this phase edits only `next.config.mjs` options and MDX).
- Error handling uses `tryCatch`, not try/catch (relevant only if code is touched; this phase edits comments only).
- Task tracking: GitHub issues are the source of truth for what; close finished issues with an implementation comment; new work gets an issue first.

## Sources

### Primary (HIGH confidence) — opened this session
- Lane files: `AGENTS.md`, `next.config.mjs`, `mdx-components.jsx`, `Dockerfile.app`, `docker-compose.yml`, `deploy/staging/compose.yaml`, `deploy/README.md`, `.github/workflows/*.yml` (10), `.github/actions/verify/action.yml`, `prisma/schema.prisma`, `prisma/seed/readme.md`, `src/update/{lease,season,status}.mjs`, `src/app/api/h1/update/route.js`, `src/shared/utils/initializeWorker.mjs`, `public/workers/{cron,cronLogic}.js`, `src/shared/components/MermaidDiagram/*`, all in-scope docs pages and `.mjs` configs, `.planning/{REQUIREMENTS,ROADMAP,STATE,PROJECT}.md`, `.planning/codebase/*.md`, Phase 1 `01-RELEASE-RECORD.md`, `01-REVIEW*.md`
- `node_modules/@sentry/nextjs` 11.8.0: `build/cjs/config/withSentryConfig/getFinalConfigObjectBundlerUtils.js`, `build/cjs/config/getBuildPluginOptions.js`, `build/cjs/config/handleRunAfterProductionCompile.js`, `build/types/config/types.d.ts`
- `gh`: issues #501 #502 #469, PR #531, runs 35578125172 and 39574238756 (log), package versions of `ghcr.io/elfensky/helldiversbot`
- Local run of `mermaid.parse` (12.2.0, jsdom) over every fence and definition in scope

### Secondary / tertiary
- None. No web search was needed; no claim in this document rests on a web source.

## Metadata

**Confidence breakdown:**
- Drift items and line numbers: HIGH — each opened and quoted this session
- Sentry 11.8.0 behaviour: HIGH — read from the installed package
- GlitchTip resolving Sentry 11 bundles: MEDIUM — only the 0.95.2 `sentry-cli` bundle is proven (A5)
- Docker measurement commands: MEDIUM — daemon was down, commands not executed
- Browser verification procedure: MEDIUM — server start with no DB is assumed (A1)

**Research date:** 2026-10-23
**Valid until:** 2026-10-30 for line numbers (develop moves; re-run the stale-string sweep before editing); Sentry facts valid until the next `@sentry/nextjs` bump
