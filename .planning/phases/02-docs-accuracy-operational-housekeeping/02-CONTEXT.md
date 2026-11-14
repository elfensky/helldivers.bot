# Phase 2: Docs Accuracy & Operational Housekeeping - Context

**Gathered:** 2026-10-14 (assumptions mode); refreshed 2026-11-14 against develop 0.98.0
**Status:** Ready for planning

<domain>
## Phase Boundary

Documentation matches deployed reality, and the small open operational verification chores close.
Requirements: DOCS-01, DOCS-02, HOUSE-03, HOUSE-04 (see `.planning/ROADMAP.md` § Phase 2). HOUSE-05
is done (2026-11-02, `02-03-SUMMARY.md`). The phase makes two production releases (D-21).

Not in this phase: docs pages outside the DOCS-02 list (DOCS-03, Phase 18), the test-layout move
(HOUSE-01, Phase 3), any change to the seed-refresh workflow, the `deploy/README.md` fixes (#624,
D-28), and the code-review findings WR-07 and WR-08 (D-25, D-26).

Decision IDs are stable across refreshes: plans cite them. A retired ID keeps its number and names
its replacement.
</domain>

<decisions>
## Implementation Decisions

### Ground truth and DOCS-01
- **D-01:** The code decides what is true. Source order for every docs check: (1) the code;
  (2) `deploy/staging/compose.yaml`, `deploy/production/compose.yaml`, `.github/workflows/build-*.yml`;
  (3) `.planning/architecture/*.md` (evidence 2026-11-09, rev 8f831f68); (4) `deploy/README.md`
  (partly stale, D-28); (5) the `.planning/codebase/*.md` maps (2026-08-28, contain errors).
- **D-02:** Fix the wrong map lines in the same pass: `.planning/codebase/STACK.md:85` (dedicated
  worker service — does not exist), `ARCHITECTURE.md:125` (#516 "stale state" 403 reason),
  `ARCHITECTURE.md:127` (`updateStatus` also writes `h1_event_progress`), `ARCHITECTURE.md:130`
  (`updateSeason` does not write `h1_statistic`/`h1_event_progress`), `INTEGRATIONS.md:79-80` (both
  stacks run 2 app replicas). With these fixed, criterion 2 ("against `.planning/codebase/`") and
  D-01 agree. Then regenerate the main checkout's `.claude/CLAUDE.md` from the maps (GSD `source:`
  markers at lines 1, 23, 93, 169; it still lists the removed `eslint-plugin-react-compiler`). Never
  hand-edit `.claude/CLAUDE.md`: it is generated and gitignored (`.gitignore:58`).
- **D-03:** DOCS-01 is a small edit. `AGENTS.md:77-83` (§ Architecture invariants) already states
  the lease and the lease-row state. Add about 2 lines to the bullet at `:79-83`: every replica
  spawns the cron thread and only the lease holder polls; `WORKER_ENABLED=false` is an optional
  opt-out, not a multi-replica requirement (0 hits in AGENTS.md today); the lease lasts 60 s
  (`LEASE_TTL_S`, `src/update/lease.mjs:20`) and a standby replica answers `200 {role:'standby'}`;
  both stacks run 2 app replicas. AGENTS.md holds repo facts only (`AGENTS.md:7-9`): do not restore
  the old Stack, Frontend Layout or Task Tracking sections. The same PR fixes the 4 comments that
  still describe the #516 model: `src/app/api/h1/update/route.js:35` ("~15s" — the cadence is
  `UPDATE_INTERVAL`, 20 s), `route.js:76-78` (state lives in the lease row, not in the process),
  `src/shared/utils/initializeWorker.mjs:2-6` (no "N web replicas plus one worker replica"),
  `public/workers/cron.js:13` (spawned from `src/instrumentation.node.js`). `.example.env:17-19` is
  already correct.
- **D-27:** The same PR changes the merge line at `AGENTS.md:44` to `gh pr merge <n> --rebase`, then
  `git push origin --delete <branch>`. The handbook forbids `--delete-branch` from a worktree that has
  the PR branch checked out (`~/vault/knowledge/developer/stack/git-and-prs.md` § Merging): it removed
  the lane worktree twice on 2026-11-07. Every plan uses this form for work and record PRs. A release
  PR (head `develop`) never deletes its head branch. Delete a branch only after
  `gh pr view <n> --json state` reports `MERGED`.

### Topology
- **D-04:** Production is the Hetzner Docker Swarm, stack `helldiversbot`: app ×2
  (`deploy/production/compose.yaml:118`), cloudflared ×2 (`:151`), one shared Postgres,
  lease-coordinated. A `vX.Y.Z` tag runs `build-release.yml`; its `pin-production` job (`:278`) pins
  `deploy/production`, and Arcane Git Sync applies the stack. `origin/deploy/production` (e09484b9)
  pins v0.97.2 today. `docker-compose.yml` is a single-host compose, not the production deployment.
- **D-05:** Staging is the 3-Pi Docker Swarm: app ×2 (`deploy/staging/compose.yaml:112`),
  cloudflared ×2 (`:146`), one shared Postgres, lease-coordinated (`deploy/README.md:15-29`). It builds
  from every push to `develop` and pins each green build.
- **D-06:** The docs state that the lease makes any replica count safe and that both stacks run 2
  app replicas. `UPDATE_INTERVAL` is 20 on both stacks (`deploy/production/compose.yaml:79`). The
  public pages leave out IP addresses, host names, node labels and secret names
  (`deploy/README.md:30` holds such LAN details).
- **D-28:** The stale lines in `deploy/README.md` (`:11` "What's live (2026-08-25)", `:124` "ready,
  not deployed yet", `:167`) are fixed under #624, not in this phase. The executor does not copy
  facts from that file without checking them against D-01 sources (1)–(3).

### DOCS-02 scope
- **D-07:** Scope = the 5 listed pages (`src/app/docs/{architecture,data-flow,infrastructure,
  database,testing}/`, page plus diagram config `.mjs` files) plus the lease lines on 2 other pages:
  `notifications/page.mdx:115`, `notifications/notificationFlowConfig.mjs:175`,
  `notifications/pushFlowConfig.mjs:36` (push dedup "in memory" → lease row), and
  `src/app/docs/page.mdx:32`, `src/app/docs/overviewConfig.mjs:92`. All other pages wait for
  DOCS-03.
- **D-08:** data-flow gets a short poller-lease subsection (~15 lines) and a note that
  `migrateOrWait` (migrations and seed under an advisory lock) runs before the worker starts
  (`src/instrumentation.node.js:18,22`). It loses the retired pieces: `?key=` auth,
  `initializeOpenApiSpec()`, module-level poller state. The on-demand season pipeline is NOT retired:
  `updateSeason` is still called by `getCampaignOrSeed`, `/api/h1/rebroadcast`, `backfillAndRetry`
  and `reseedSeason` — keep those sections. Stale lines today: `data-flow/page.mdx:4,55,90,102-103,
  117,153,190,200,441,460-462`.
- **D-09:** database: drop `Review` and `App` (migration `20260416091157_drop_unused_tables`;
  `database/page.mdx:130,174,188,523,578`), add the lease columns to `worker_heartbeat` (`:194-201`),
  add `api_rate_limit`, state `TIMESTAMP(3)` (naive UTC), not `TIMESTAMPTZ` (19 cells), and fix the
  `dotenv/config` lines (`:41,51`) against `prisma.config.mjs:1-3`. `app_instance` and `seed_state`
  are already documented (`:203,212,613-638`): no work.
- **D-10:** infrastructure (largest page). Already correct: migrate-on-start (`:114-122`), Node 26
  (`:82-86`), the 900 s start period (`:98`), `MIGRATE_ROOT` (`:428`). To do: a deployment-topology
  section per D-04..D-06; the release path (tag → per-arch build legs + `merge-app` →
  `pin-production` → Arcane Git Sync); staging images carry `<version>-dev.<sha7>` (`APP_VERSION`
  build arg); all 11 workflow files with current names (old names at `:149,171,177,195`;
  softprops/RELEASE.md at `:193`; "direct merges" at `:153`); the runner image is `node:26-slim`,
  uid 65532, no tini (`Dockerfile.app:131-138`) — remove the distroless, uid 1001 and tini text
  (`:90-95`); remove `initializeOpenApiSpec` (`:211,244`); fix `:304`, `:373`, `:427`. Env table:
  re-check every row against `.example.env` (rewritten 2026-11-09, commits 1d475f75, 2a86e6c8); the
  2026-10-23 list (add `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`, `FORCE_SEED`, the
  `*_FILE` convention; remove `POSTGRES_SSL`, `SKIP_MIGRATIONS`) is the starting point. The Sentry
  block describes the post-HOUSE-03 state: no `productionBrowserSourceMaps`, the wrapper only when
  `SENTRY_AUTH_TOKEN` is set, maps deleted after upload. `.planning/codebase/CONCERNS.md:50-53`
  (#502) is updated in the same pass.
- **D-11:** testing: replace the enumerated directory tree, the mermaid directory list and the
  naming table with one rule stated on the page: unit tests mirror the source tree under
  `src/__tests__/unit/`, enforced by `src/__tests__/unit/_meta/mirrorTree.test.mjs`
  (`AGENTS.md:65-66`). Phase 3 then changes one paragraph. Remove the "euraika/aegis" reference
  (`testing/page.mdx:22`), the "Audience: … AI assistants" line (`:11`) and the instruction aimed at
  AI assistants (`:107`). Other stale lines: `:27-32,73-88,137,282`. `:271` is correct.
- **D-12:** § Drift Inventory in `02-DISCUSSION-LOG.md` is the executor's starting checklist. A
  2026-11-14 sample found about 50 of about 58 items still stale; about 6 were fixed by #596, #599
  and Node 26; line numbers have moved. Re-verify each item against the code before editing.
  Criterion 2 closes on a final page-by-page check against the live code, recorded in the phase
  verification.
- **D-23:** Only `<MermaidDiagram>` renders (5 diagrams: architecture, docs overview,
  notifications ×3). Each edited one is rendered in a real browser (DevTools) before the PR. The
  ```` ```mermaid ```` fences on architecture, data-flow, infrastructure, database and testing render as
  raw `<pre>` text (`mdx-components.jsx:26-30`); check them with a `mermaid.parse` script (it does
  not exist yet — the plan adds it). mermaid is ^12.3.0. `next build` does not run client-side
  mermaid, so the build proves nothing about rendering.

### HOUSE-03 sourcemap strip
- **D-13:** The #502 gate is met. Evidence: GlitchTip HELLDIVERSBOT-6C, event
  `69dc63bfe21b4745a561db74d2f99c35`, release `0.95.2`, environment `production`; raw frame
  `29db8qr-sdvxo.js:2:2648` resolves to `src/features/notifications/NotificationToggle.jsx:118` with
  source context. Record this on #502 (0 comments today).
- **D-14:** The change has 2 parts: delete `productionBrowserSourceMaps: true` (`next.config.mjs:17`)
  and add `sourcemaps: { deleteSourcemapsAfterUpload: true }` to the `withSentryConfig` options
  (ternary at `next.config.mjs:214-225`). Verified against `@sentry/nextjs` 11.10.0
  (`package-lock.json:4800-4801`): a user-set `productionBrowserSourceMaps` still cancels the SDK's
  own map switch and delete default (`getFinalConfigObjectBundlerUtils.js:127-129`, default delete at
  `:135-146`); the option is at `types.d.ts:406` and covers the Turbopack build. Keep the explicit
  option even though it matches the default: it fixes the intent in place. Without
  `SENTRY_AUTH_TOKEN` the wrapper is skipped, so token-less builds (docker-smoke, self-hosters) ship
  no browser maps. Mark review finding IN-03 resolved in
  `.planning/milestones/M7-phases/01-stability-fixes-release/01-REVIEW-DISPOSITION.md:31`.
- **D-15:** Verification, in this order, each recorded on #502 before it closes:
  (1) staging first — the stripped build reaches staging (release `<version>-dev.<sha7>`,
  `build-staging.yml:210-224`), and one GlitchTip event from it resolves to source paths; staging
  then serves no public maps, so this proves the uploaded maps alone; (2) `.map` count and size in the
  image vs the v0.97.2 image (same base, has `/app/migrate`; the runtime has a shell now); (3) after
  the phase-end release, a production `.js.map` URL returns 404; (4) one symbolicated production
  GlitchTip event from the phase-end release. If (1) fails, the strip does not enter the release: fix
  the uploader first. Measure in a lane worktree after `npm ci`.
- **D-16:** Server maps in `.next/standalone` stay. They are not served over HTTP
  (`Dockerfile.app:167-169`).
- **D-24:** Sentry 11 uploads succeed: both legs of v0.97.2 (run 41832856848) and v0.96.4
  (`.planning/milestones/M7-phases/01.1-production-on-the-hetzner-swarm/01.1-RELEASE-RECORD.md:38-43`).
  No symbolicated Sentry 11 event is recorded yet. D-15 step (1) is the proof. A v0.97.2 production
  event is not a clean proof: production still serves public maps there. The GlitchTip connector
  needs re-authorization before any GlitchTip check.

### HOUSE-04 and the issues (Andrei, 2026-11-14)
- **D-17:** #501 closes on PR #642 (run 42603725952, 2026-11-09, only
  `prisma/seed/seasons/season-161.json`), landed the current way: approve its runs (4 in
  `action_required` at a22b7efc) or push an `## Unreleased` note commit, wait for the required checks
  (`Test & Build`, `Visual Regression`, `Review Dependencies`), rebase-merge per D-27, then confirm
  that staging seeds season 161 on start. Do all of it in one sitting that does not cross Monday
  03:00 UTC (`scheduled-seed-refresh.yml:5`): that run rebuilds the branch from `develop` (`:59`) and
  force-pushes (`:62`), which deletes any human commit. The closing comment on #501 cites #531 (run
  35578125172 → merge `66093080`, 2026-09-21) as the first real run and #642 as the second. One new
  issue (milestone Engineering Health) records 2 gaps: (1) a PR opened with `GH_TOKEN:
  ${{ github.token }}` (`:49`) gets runs that wait in `action_required` (on #531 they ended as 0-job
  failures); (2) the force-push deletes the note commit that the PR body (`:65`) and
  `prisma/seed/readme.md:49-51` tell the human to push. The workflow file does not change in this
  phase.
- **D-18:** Done: #469 is ARCH-11 in Phase 11 (`REQUIREMENTS.md:87,218`).
- **D-19:** Done (superseded 2026-11-02): `docs/roadmap.md` is deleted, not a pointer. See
  `02-03-SUMMARY.md`.
- **D-20:** Done (superseded 2026-11-02): its live items are in `ROADMAP.md` § Carried over.

### Release (Andrei, 2026-11-14)
- **D-21:** Two production releases. (1) At the start of Phase 2: release `develop` as it stands
  (0.97.3, 0.97.4, 0.98.0 and `## Unreleased`), so migrate-on-start (#599, `src/update/migrateOnStart.mjs`,
  not in v0.97.2) reaches production alone, with its own rollback point. (2) At phase end: the
  HOUSE-03 strip and the docs, carrying D-15 steps (3) and (4). Each release: the version cut as its
  own PR into `develop` (the `"version"` bump plus the move of `## Unreleased` into `## X.Y.Z`), then
  the release PR `develop` → `main` (merge commit; no `--delete-branch`), then the `vX.Y.Z` tag.
  `pin-production` deploys it; there is no manual pull and no merge-back (#621). A release is live
  once `deploy/production` pins the new tag and production reports the new version.
- **D-22:** Work PRs into `develop` raise no version and add their notes under `## Unreleased`
  (`AGENTS.md:50-56`). `Check: Version Bump` runs only on PRs into `main`
  (`.github/workflows/check-version.yml:3-10`). `.planning/`-only PRs carry no note.

### Review findings outside the requirements (Andrei, 2026-10-23)
- **D-25:** WR-07 (the rewrites at `next.config.mjs:69-76` proxy `/api/record` and
  `/api/websites/:id/recorder` to the fixed Umami host on every deployment) is filed as a GitHub issue
  and deferred; not filed yet. Link #631 (it touches the same lines, for cookies). The suggested
  build-time env gate would strip the rewrites from production images, since `UMAMI_*` exist only at
  runtime; the safe fix is a route handler like `/stats.js`. Natural home: Phase 5 (SEO-09).
- **D-26:** WR-08 (the catch-all `public, s-maxage=30` rule at `next.config.mjs:195-199` caches HTML
  whose root layout renders `MinistryTriggerWidget` from the session, `src/app/layout.jsx:97,247`) is
  filed as a GitHub issue (milestone Engineering Health) and deferred; not filed yet. Link #629 (its
  HTML `no-cache` change would close it). Impact is an easter-egg trigger with no privileged action.

### Plans
- **D-29:** Plan disposition against this refresh: drop 02-01 (release 0.95.7 — v0.95.8, v0.96.4 and
  v0.97.2 already shipped Sentry 11; D-21 (1) replaces it); 02-03 is done; keep 02-05, 02-06 and
  02-10 with edits (D-22 notes instead of bumps; refreshed line refs; 02-06 adds `migrateOrWait`;
  02-10 uses Sentry 11.10.0 and the v0.97.2 baseline); re-plan 02-02, 02-04, 02-07, 02-08, 02-09,
  02-11 and 02-12. No plan contains a manual production pull, a merge-back or `--delete-branch` from
  a lane. `02-PATTERNS.md` is deleted so that plan-phase makes it again.

### Claude's Discretion
- Exact wording and structure of each rewritten docs section, within D-03..D-11.
- How the work is split into plans and PRs, and the version number each cut takes.
- Wording of the new issues (D-17 seed-refresh gaps, D-25 WR-07, D-26 WR-08).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` § Phase 2 — goal and success criteria
- `.planning/REQUIREMENTS.md` — DOCS-01, DOCS-02, HOUSE-03, HOUSE-04 (lines 35-42)
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-DISCUSSION-LOG.md` § Drift Inventory — starting checklist; line numbers have moved (D-12)
- `.planning/milestones/M7-phases/01-stability-fixes-release/01-CONTEXT.md` — D-03 (symbolication)
- `.planning/milestones/M7-phases/01-stability-fixes-release/01-GLITCHTIP-RECOUNT.md` — re-count method (`release:<version>` filter)
- `.planning/milestones/M7-phases/01-stability-fixes-release/01-REVIEW.md`, `01-REVIEW-DISPOSITION.md` — WR-07, WR-08, IN-03
- `.planning/milestones/M7-phases/01.1-production-on-the-hetzner-swarm/01.1-RELEASE-RECORD.md` — the production move, v0.96.4 via `pin-production`, upload evidence

### Release and merge process
- `AGENTS.md` § Branches (`:39-47`), § This repo's own rules — the version cut (`:50-56`)
- `CONTRIBUTING.md` § Release Process (`:45-54`)
- `~/vault/knowledge/developer/stack/git-and-prs.md` § Merging — no `--delete-branch` from a lane (D-27)
- `.github/workflows/build-release.yml` (`pin-production` at `:278`), `build-staging.yml`, `check-version.yml`

### Lease and topology (DOCS-01, DOCS-02)
- `src/update/lease.mjs` — `claimLease`, `persistPollerState`, `LEASE_TTL_S`
- `src/app/api/h1/update/route.js` — lease claim, standby, closing pass, `prevEvents`
- `src/shared/utils/initializeWorker.mjs` — `WORKER_ENABLED`, thread spawn
- `src/instrumentation.js`, `src/instrumentation.node.js` — `migrateOrWait` then `initializeWorker()`
- `src/update/migrateOnStart.mjs` — migrate-on-start (#599)
- `public/workers/cron.js`, `public/workers/cronLogic.js` — poll loop, Bearer auth, startup header
- `src/update/status.mjs`, `src/update/season.mjs` — which tables each path writes
- `deploy/production/compose.yaml`, `deploy/staging/compose.yaml`, `deploy/README.md` (partly stale, D-28), `docker-compose.yml`
- `.planning/architecture/helldivers-bot-update-pipeline.md` and the other `helldivers-bot-*.md` notes (2026-11-09)
- `prisma/schema.prisma` — `worker_heartbeat`, `api_rate_limit`, `app_instance`, timestamp types
- `.example.env` — env var reference

### Docs pages (DOCS-02)
- `src/app/docs/architecture/`, `src/app/docs/data-flow/`, `src/app/docs/infrastructure/`, `src/app/docs/database/`, `src/app/docs/testing/`
- `src/app/docs/notifications/page.mdx`, `notificationFlowConfig.mjs`, `pushFlowConfig.mjs`
- `src/app/docs/page.mdx`, `src/app/docs/overviewConfig.mjs`
- `mdx-components.jsx` — fences render as `<pre>` (D-23)
- `.github/workflows/*.yml` — 11 files
- `Dockerfile.app`

### Sourcemaps (HOUSE-03)
- GitHub issue #502 — gate and prescribed change
- `next.config.mjs` — line 17 and the `withSentryConfig` ternary (`:214-225`)
- `@sentry/nextjs` 11.10.0 sources (after `npm ci` in the lane): `build/cjs/config/withSentryConfig/getFinalConfigObjectBundlerUtils.js` (127-146), `build/cjs/config/getBuildPluginOptions.js`, `build/cjs/config/handleRunAfterProductionCompile.js`, `build/types/config/types.d.ts` (406)

### Seed refresh (HOUSE-04)
- GitHub issue #501; PR #531; PR #642; runs 35578125172 and 42603725952
- `.github/workflows/scheduled-seed-refresh.yml`, `prisma/seed/readme.md`
- Related open issues: #624 (deploy guide), #629 (cache headers), #631 (analytics plumbing)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deploy/README.md:15-29`, `deploy/staging/compose.yaml` and `src/update/lease.mjs:5-20` describe the
  lease and handover accurately — reuse their wording for the docs topology sections.
- `.planning/architecture/*.md` (council-reviewed 2026-11-09) hold current lease, auth and
  rate-limit facts.
- `vitest.visual.config.mjs` pins `.vitest-attachments/` under Vitest 5, so the testing page's
  attachment lines stay true.

### Established Patterns
- Docs pages are MDX app routes under `src/app/docs/**`; diagrams are Mermaid definition plus config
  `.mjs` files rendered by `MermaidDiagram` (node IDs use underscores).
- Docs reach production only with a `vX.Y.Z` tag, through `pin-production`; staging shows them after
  the next green `develop` build.
- `next.config.mjs` header rules show their real effect only in a production build (Phase 1 lesson,
  `/opengraph-image`).

### Integration Points
- AGENTS.md is the file behind the `CLAUDE.md` symlink — every session loads it.
- `.planning/codebase/*.md` feed the generated `.claude/CLAUDE.md` in the main checkout.
- #502, #501 and the new issues (D-17, D-25, D-26) are closed or opened by the executor with written
  evidence.
- Every build or measurement runs in a lane worktree after `npm ci`.
</code_context>

<specifics>
## Specific Ideas

- 2026-11-14 refresh (Andrei): two releases, the first one isolating #599 (D-21); #501 closes on
  #642 landed under today's rules (D-17); every other assumption confirmed as written.
- 2026-10-23 refresh (Andrei): WR-07 and WR-08 are filed and deferred, not ride-alongs (D-25, D-26).
- The HOUSE-03 gate evidence (D-13) was read from the GlitchTip MCP on 2026-10-14.

### Research topics for plan-phase
- Why runs on a PR opened with `github.token` wait in `action_required`, and whether approving them
  satisfies the required checks of the `develop` ruleset (D-17).
- Whether the deployed GlitchTip resolves debug-ID bundles uploaded from 2 per-arch build legs under
  one release (D-15 step 1).
</specifics>

<deferred>
## Deferred Ideas

- **Seed-refresh workflow gaps** (`action_required` runs on the bot PR; force-push deletes a human
  commit) — new issue per D-17, later phase.
- **`deploy/README.md` stale lines** — #624 (D-28).
- **WR-07 Umami rewrite open proxy** — issue per D-25; route-handler fix in Phase 5; see #631.
- **WR-08 session-dependent HTML in shared cache** — issue per D-26; see #629.
- **Docs drift outside the DOCS-02 list** (api, utilities, frontend-layout, …) — DOCS-03, Phase 18.
- **Lighthouse `valid-source-maps` audit** in `scheduled-pagespeed.yml` may change after D-14 — minor;
  check on the next PageSpeed run.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 2.
</deferred>
