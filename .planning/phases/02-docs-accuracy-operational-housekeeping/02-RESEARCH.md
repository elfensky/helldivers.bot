# Phase 2: Docs Accuracy & Operational Housekeeping - Research

**Researched:** 2026-11-14 (develop 0.98.0, commit `70ccc071`; this file replaces the 2026-10-23 research written against 0.95.7)
**Domain:** MDX docs pages and AGENTS.md accuracy, Sentry 11 sourcemap strip (Next.js 16 / Turbopack / Docker), GitHub Actions seed-refresh PR path, two production releases
**Confidence:** HIGH for in-repo facts and the Sentry 11.10.0 code path (opened this session). MEDIUM for GlitchTip symbolication of Sentry 11 bundles (server code read, no live event read). MEDIUM for "approval satisfies the ruleset" (docs plus API state, not yet executed).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ground truth and DOCS-01**
- **D-01:** The code decides what is true. Source order for every docs check: (1) the code; (2) `deploy/staging/compose.yaml`, `deploy/production/compose.yaml`, `.github/workflows/build-*.yml`; (3) `.planning/architecture/*.md` (evidence 2026-11-09, rev 8f831f68); (4) `deploy/README.md` (partly stale, D-28); (5) the `.planning/codebase/*.md` maps (2026-08-28, contain errors).
- **D-02:** Fix the wrong map lines in the same pass: `.planning/codebase/STACK.md:85` (dedicated worker service — does not exist), `ARCHITECTURE.md:125` (#516 "stale state" 403 reason), `ARCHITECTURE.md:127` (`updateStatus` also writes `h1_event_progress`), `ARCHITECTURE.md:130` (`updateSeason` does not write `h1_statistic`/`h1_event_progress`), `INTEGRATIONS.md:79-80` (both stacks run 2 app replicas). With these fixed, criterion 2 ("against `.planning/codebase/`") and D-01 agree. Then regenerate the main checkout's `.claude/CLAUDE.md` from the maps (GSD `source:` markers at lines 1, 23, 93, 169; it still lists the removed `eslint-plugin-react-compiler`). Never hand-edit `.claude/CLAUDE.md`: it is generated and gitignored (`.gitignore:58`).
- **D-03:** DOCS-01 is a small edit. `AGENTS.md:77-83` (§ Architecture invariants) already states the lease and the lease-row state. Add about 2 lines to the bullet at `:79-83`: every replica spawns the cron thread and only the lease holder polls; `WORKER_ENABLED=false` is an optional opt-out, not a multi-replica requirement (0 hits in AGENTS.md today); the lease lasts 60 s (`LEASE_TTL_S`, `src/update/lease.mjs:20`) and a standby replica answers `200 {role:'standby'}`; both stacks run 2 app replicas. AGENTS.md holds repo facts only (`AGENTS.md:7-9`): do not restore the old Stack, Frontend Layout or Task Tracking sections. The same PR fixes the 4 comments that still describe the #516 model: `src/app/api/h1/update/route.js:35` ("~15s" — the cadence is `UPDATE_INTERVAL`, 20 s), `route.js:76-78` (state lives in the lease row, not in the process), `src/shared/utils/initializeWorker.mjs:2-6` (no "N web replicas plus one worker replica"), `public/workers/cron.js:13` (spawned from `src/instrumentation.node.js`). `.example.env:17-19` is already correct.
- **D-27:** The same PR changes the merge line at `AGENTS.md:44` to `gh pr merge <n> --rebase`, then `git push origin --delete <branch>`. The handbook forbids `--delete-branch` from a worktree that has the PR branch checked out (`~/vault/knowledge/developer/stack/git-and-prs.md` § Merging): it removed the lane worktree twice on 2026-11-07. Every plan uses this form for work and record PRs. A release PR (head `develop`) never deletes its head branch. Delete a branch only after `gh pr view <n> --json state` reports `MERGED`.

**Topology**
- **D-04:** Production is the Hetzner Docker Swarm, stack `helldiversbot`: app ×2 (`deploy/production/compose.yaml:118`), cloudflared ×2 (`:151`), one shared Postgres, lease-coordinated. A `vX.Y.Z` tag runs `build-release.yml`; its `pin-production` job (`:278`) pins `deploy/production`, and Arcane Git Sync applies the stack. `origin/deploy/production` (e09484b9) pins v0.97.2 today. `docker-compose.yml` is a single-host compose, not the production deployment.
- **D-05:** Staging is the 3-Pi Docker Swarm: app ×2 (`deploy/staging/compose.yaml:112`), cloudflared ×2 (`:146`), one shared Postgres, lease-coordinated (`deploy/README.md:15-29`). It builds from every push to `develop` and pins each green build.
- **D-06:** The docs state that the lease makes any replica count safe and that both stacks run 2 app replicas. `UPDATE_INTERVAL` is 20 on both stacks (`deploy/production/compose.yaml:79`). The public pages leave out IP addresses, host names, node labels and secret names (`deploy/README.md:30` holds such LAN details).
- **D-28:** The stale lines in `deploy/README.md` (`:11` "What's live (2026-08-25)", `:124` "ready, not deployed yet", `:167`) are fixed under #624, not in this phase. The executor does not copy facts from that file without checking them against D-01 sources (1)–(3).

**DOCS-02 scope**
- **D-07:** Scope = the 5 listed pages (`src/app/docs/{architecture,data-flow,infrastructure,database,testing}/`, page plus diagram config `.mjs` files) plus the lease lines on 2 other pages: `notifications/page.mdx:115`, `notifications/notificationFlowConfig.mjs:175`, `notifications/pushFlowConfig.mjs:36` (push dedup "in memory" → lease row), and `src/app/docs/page.mdx:32`, `src/app/docs/overviewConfig.mjs:92`. All other pages wait for DOCS-03.
- **D-08:** data-flow gets a short poller-lease subsection (~15 lines) and a note that `migrateOrWait` (migrations and seed under an advisory lock) runs before the worker starts (`src/instrumentation.node.js:18,22`). It loses the retired pieces: `?key=` auth, `initializeOpenApiSpec()`, module-level poller state. The on-demand season pipeline is NOT retired: `updateSeason` is still called by `getCampaignOrSeed`, `/api/h1/rebroadcast`, `backfillAndRetry` and `reseedSeason` — keep those sections. Stale lines today: `data-flow/page.mdx:4,55,90,102-103,117,153,190,200,441,460-462`.
- **D-09:** database: drop `Review` and `App` (migration `20260416091157_drop_unused_tables`; `database/page.mdx:130,174,188,523,578`), add the lease columns to `worker_heartbeat` (`:194-201`), add `api_rate_limit`, state `TIMESTAMP(3)` (naive UTC), not `TIMESTAMPTZ` (19 cells), and fix the `dotenv/config` lines (`:41,51`) against `prisma.config.mjs:1-3`. `app_instance` and `seed_state` are already documented (`:203,212,613-638`): no work.
- **D-10:** infrastructure (largest page). Already correct: migrate-on-start (`:114-122`), Node 26 (`:82-86`), the 900 s start period (`:98`), `MIGRATE_ROOT` (`:428`). To do: a deployment-topology section per D-04..D-06; the release path (tag → per-arch build legs + `merge-app` → `pin-production` → Arcane Git Sync); staging images carry `<version>-dev.<sha7>` (`APP_VERSION` build arg); all 11 workflow files with current names (old names at `:149,171,177,195`; softprops/RELEASE.md at `:193`; "direct merges" at `:153`); the runner image is `node:26-slim`, uid 65532, no tini (`Dockerfile.app:131-138`) — remove the distroless, uid 1001 and tini text (`:90-95`); remove `initializeOpenApiSpec` (`:211,244`); fix `:304`, `:373`, `:427`. Env table: re-check every row against `.example.env` (rewritten 2026-11-09, commits 1d475f75, 2a86e6c8); the 2026-10-23 list (add `WORKER_ENABLED`, `BUCKET_SIZE`, `SENTRY_SERVER_NAME`, `FORCE_SEED`, the `*_FILE` convention; remove `POSTGRES_SSL`, `SKIP_MIGRATIONS`) is the starting point. The Sentry block describes the post-HOUSE-03 state: no `productionBrowserSourceMaps`, the wrapper only when `SENTRY_AUTH_TOKEN` is set, maps deleted after upload. `.planning/codebase/CONCERNS.md:50-53` (#502) is updated in the same pass.
- **D-11:** testing: replace the enumerated directory tree, the mermaid directory list and the naming table with one rule stated on the page: unit tests mirror the source tree under `src/__tests__/unit/`, enforced by `src/__tests__/unit/_meta/mirrorTree.test.mjs` (`AGENTS.md:65-66`). Phase 3 then changes one paragraph. Remove the "euraika/aegis" reference (`testing/page.mdx:22`), the "Audience: … AI assistants" line (`:11`) and the instruction aimed at AI assistants (`:107`). Other stale lines: `:27-32,73-88,137,282`. `:271` is correct.
- **D-12:** § Drift Inventory in `02-DISCUSSION-LOG.md` is the executor's starting checklist. A 2026-11-14 sample found about 50 of about 58 items still stale; about 6 were fixed by #596, #599 and Node 26; line numbers have moved. Re-verify each item against the code before editing. Criterion 2 closes on a final page-by-page check against the live code, recorded in the phase verification.
- **D-23:** Only `<MermaidDiagram>` renders (5 diagrams: architecture, docs overview, notifications ×3). Each edited one is rendered in a real browser (DevTools) before the PR. The ```` ```mermaid ```` fences on architecture, data-flow, infrastructure, database and testing render as raw `<pre>` text (`mdx-components.jsx:26-30`); check them with a `mermaid.parse` script (it does not exist yet — the plan adds it). mermaid is ^12.3.0. `next build` does not run client-side mermaid, so the build proves nothing about rendering.

**HOUSE-03 sourcemap strip**
- **D-13:** The #502 gate is met. Evidence: GlitchTip HELLDIVERSBOT-6C, event `69dc63bfe21b4745a561db74d2f99c35`, release `0.95.2`, environment `production`; raw frame `29db8qr-sdvxo.js:2:2648` resolves to `src/features/notifications/NotificationToggle.jsx:118` with source context. Record this on #502 (0 comments today).
- **D-14:** The change has 2 parts: delete `productionBrowserSourceMaps: true` (`next.config.mjs:17`) and add `sourcemaps: { deleteSourcemapsAfterUpload: true }` to the `withSentryConfig` options (ternary at `next.config.mjs:214-225`). Verified against `@sentry/nextjs` 11.10.0 (`package-lock.json:4800-4801`): a user-set `productionBrowserSourceMaps` still cancels the SDK's own map switch and delete default (`getFinalConfigObjectBundlerUtils.js:127-129`, default delete at `:135-146`); the option is at `types.d.ts:406` and covers the Turbopack build. Keep the explicit option even though it matches the default: it fixes the intent in place. Without `SENTRY_AUTH_TOKEN` the wrapper is skipped, so token-less builds (docker-smoke, self-hosters) ship no browser maps. Mark review finding IN-03 resolved in `.planning/milestones/M7-phases/01-stability-fixes-release/01-REVIEW-DISPOSITION.md:31`.
- **D-15:** Verification, in this order, each recorded on #502 before it closes: (1) staging first — the stripped build reaches staging (release `<version>-dev.<sha7>`, `build-staging.yml:210-224`), and one GlitchTip event from it resolves to source paths; staging then serves no public maps, so this proves the uploaded maps alone; (2) `.map` count and size in the image vs the v0.97.2 image (same base, has `/app/migrate`; the runtime has a shell now); (3) after the phase-end release, a production `.js.map` URL returns 404; (4) one symbolicated production GlitchTip event from the phase-end release. If (1) fails, the strip does not enter the release: fix the uploader first. Measure in a lane worktree after `npm ci`.
- **D-16:** Server maps in `.next/standalone` stay. They are not served over HTTP (`Dockerfile.app:167-169`).
- **D-24:** Sentry 11 uploads succeed: both legs of v0.97.2 (run 41832856848) and v0.96.4 (`.planning/milestones/M7-phases/01.1-production-on-the-hetzner-swarm/01.1-RELEASE-RECORD.md:38-43`). No symbolicated Sentry 11 event is recorded yet. D-15 step (1) is the proof. A v0.97.2 production event is not a clean proof: production still serves public maps there. The GlitchTip connector needs re-authorization before any GlitchTip check.

**HOUSE-04 and the issues (Andrei, 2026-11-14)**
- **D-17:** #501 closes on PR #642 (run 42603725952, 2026-11-09, only `prisma/seed/seasons/season-161.json`), landed the current way: approve its runs (4 in `action_required` at a22b7efc) or push an `## Unreleased` note commit, wait for the required checks (`Test & Build`, `Visual Regression`, `Review Dependencies`), rebase-merge per D-27, then confirm that staging seeds season 161 on start. Do all of it in one sitting that does not cross Monday 03:00 UTC (`scheduled-seed-refresh.yml:5`): that run rebuilds the branch from `develop` (`:59`) and force-pushes (`:62`), which deletes any human commit. The closing comment on #501 cites #531 (run 35578125172 → merge `66093080`, 2026-09-21) as the first real run and #642 as the second. One new issue (milestone Engineering Health) records 2 gaps: (1) a PR opened with `GH_TOKEN: ${{ github.token }}` (`:49`) gets runs that wait in `action_required` (on #531 they ended as 0-job failures); (2) the force-push deletes the note commit that the PR body (`:65`) and `prisma/seed/readme.md:49-51` tell the human to push. The workflow file does not change in this phase.
- **D-18:** Done: #469 is ARCH-11 in Phase 11 (`REQUIREMENTS.md:87,218`).
- **D-19:** Done (superseded 2026-11-02): `docs/roadmap.md` is deleted, not a pointer. See `02-03-SUMMARY.md`.
- **D-20:** Done (superseded 2026-11-02): its live items are in `ROADMAP.md` § Carried over.

**Release (Andrei, 2026-11-14)**
- **D-21:** Two production releases. (1) At the start of Phase 2: release `develop` as it stands (0.97.3, 0.97.4, 0.98.0 and `## Unreleased`), so migrate-on-start (#599, `src/update/migrateOnStart.mjs`, not in v0.97.2) reaches production alone, with its own rollback point. (2) At phase end: the HOUSE-03 strip and the docs, carrying D-15 steps (3) and (4). Each release: the version cut as its own PR into `develop` (the `"version"` bump plus the move of `## Unreleased` into `## X.Y.Z`), then the release PR `develop` → `main` (merge commit; no `--delete-branch`), then the `vX.Y.Z` tag. `pin-production` deploys it; there is no manual pull and no merge-back (#621). A release is live once `deploy/production` pins the new tag and production reports the new version.
- **D-22:** Work PRs into `develop` raise no version and add their notes under `## Unreleased` (`AGENTS.md:50-56`). `Check: Version Bump` runs only on PRs into `main` (`.github/workflows/check-version.yml:3-10`). `.planning/`-only PRs carry no note.

**Review findings outside the requirements (Andrei, 2026-10-23)**
- **D-25:** WR-07 (the rewrites at `next.config.mjs:69-76` proxy `/api/record` and `/api/websites/:id/recorder` to the fixed Umami host on every deployment) is filed as a GitHub issue and deferred; not filed yet. Link #631 (it touches the same lines, for cookies). The suggested build-time env gate would strip the rewrites from production images, since `UMAMI_*` exist only at runtime; the safe fix is a route handler like `/stats.js`. Natural home: Phase 5 (SEO-09).
- **D-26:** WR-08 (the catch-all `public, s-maxage=30` rule at `next.config.mjs:195-199` caches HTML whose root layout renders `MinistryTriggerWidget` from the session, `src/app/layout.jsx:97,247`) is filed as a GitHub issue (milestone Engineering Health) and deferred; not filed yet. Link #629 (its HTML `no-cache` change would close it). Impact is an easter-egg trigger with no privileged action.

**Plans**
- **D-29:** Plan disposition against this refresh: drop 02-01 (release 0.95.7 — v0.95.8, v0.96.4 and v0.97.2 already shipped Sentry 11; D-21 (1) replaces it); 02-03 is done; keep 02-05, 02-06 and 02-10 with edits (D-22 notes instead of bumps; refreshed line refs; 02-06 adds `migrateOrWait`; 02-10 uses Sentry 11.10.0 and the v0.97.2 baseline); re-plan 02-02, 02-04, 02-07, 02-08, 02-09, 02-11 and 02-12. No plan contains a manual production pull, a merge-back or `--delete-branch` from a lane. `02-PATTERNS.md` is deleted so that plan-phase makes it again.

### Claude's Discretion
- Exact wording and structure of each rewritten docs section, within D-03..D-11.
- How the work is split into plans and PRs, and the version number each cut takes.
- Wording of the new issues (D-17 seed-refresh gaps, D-25 WR-07, D-26 WR-08).

### Deferred Ideas (OUT OF SCOPE)
- **Seed-refresh workflow gaps** (`action_required` runs on the bot PR; force-push deletes a human commit) — new issue per D-17, later phase.
- **`deploy/README.md` stale lines** — #624 (D-28).
- **WR-07 Umami rewrite open proxy** — issue per D-25; route-handler fix in Phase 5; see #631.
- **WR-08 session-dependent HTML in shared cache** — issue per D-26; see #629.
- **Docs drift outside the DOCS-02 list** (api, utilities, frontend-layout, …) — DOCS-03, Phase 18.
- **Lighthouse `valid-source-maps` audit** in `scheduled-pagespeed.yml` may change after D-14 — minor; check on the next PageSpeed run.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | AGENTS.md § Architecture invariants describes the lease/`worker_heartbeat` model, `WORKER_ENABLED`, multi-replica web tier; poller state in the lease row | § DOCS-01 facts (every stale line re-read at 0.98.0; lease constants quoted) |
| DOCS-02 | 5 public `/docs` pages match the code, page-by-page | § DOCS-02 facts (per-page line refs, sweep baselines, mermaid parse baseline) |
| HOUSE-03 | Sourcemaps uploaded at build time, stripped from the image once symbolication is proven | § Research topic 2, § HOUSE-03 facts (v0.97.2 baseline measured, Sentry 11.10.0 code path, staging event-source gap) |
| HOUSE-04 | Seed-refresh PR path verified end-to-end, run recorded on #501 | § Research topic 1, § HOUSE-04 facts (ruleset, PR #642 state, ordering vs release 1) |
| HOUSE-05 | `docs/roadmap.md` deleted, live items in `.planning/` | Done 2026-11-02 (`02-03-SUMMARY.md`). `docs/roadmap.md` is absent: `ls docs/roadmap.md` → "No such file or directory" [VERIFIED: Bash this session]. Record as done. Not researched further. |
</phase_requirements>

## Summary

Most of CONTEXT.md holds at develop 0.98.0. I re-read the line refs of D-02, D-03, D-09, D-11, D-14 and D-17, and most of those in D-08 and D-10, against the worktree. They are exact, except where noted in § DOCS-02 facts (a few infrastructure and fence line numbers drifted; the `schema.prisma` lines are new). The executor still re-verifies each item (D-12). The two open research topics have answers, and the research found five facts that change the plan.

**Five facts that change the plan**
1. **D-15 step (1) has no event source today.** Staging sets no `SENTRY_DSN`. The browser SDK sends through the tunnel `/api/glitchtip`, and that route answers 503 when `SENTRY_DSN` is unset. A browser error on staging therefore never reaches GlitchTip. The plan needs a decision (§ Research topic 2, "Event source for D-15 (1)").
2. **A failed sourcemap upload does not fail the build, and the maps are still deleted.** Sentry 11.10.0 logs the upload error and continues; `deleteArtifacts()` runs next. The log line `Successfully uploaded source maps to Sentry` is the only per-leg gate. GlitchTip also answers the assemble call before it assembles, so even that line does not prove the bundle was stored.
3. **PR #642 cannot merge as it stands.** The `develop` ruleset (created 2026-09-25, after #531) requires `Test & Build`, `Visual Regression` and `Review Dependencies`; none ran. `mergeStateStatus` is `BLOCKED`, and `current_user_can_bypass` is `never`. The approval gate is documented GitHub behaviour for PRs that a `GITHUB_TOKEN` workflow creates or updates.
4. **Sequence #642 after release 1.** The seed hash covers `prisma/seed/seasons/*`, so merging #642 before the release-1 cut puts season 161 into release 1 and also risks a `CHANGELOG.md` conflict with the cut. Merge #642 after release 1 is tagged.
5. **Measured v0.97.2 baseline (amd64):** 142 `.map` files and 31,057,870 bytes in `.next/static`; 135 `.js` files and 7,264,852 bytes; 48 server `.map` files of 6,672 bytes in total. `docker image inspect .Size` returns 0 under this daemon's containerd store, so measure by export.

**Primary recommendation:** Run in this order: release 1 (D-21 (1)) → DOCS-01/02 PRs and the HOUSE-03 PR into `develop` → #642 landed and #501 closed → staging proof of the strip (with an agreed event source) → release 2 → production checks (3) and (4) → close #502.

## Architectural Responsibility Map

This phase changes documents, one build option and CI/ops evidence. The map names where each truth lives.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lease / poller description (DOCS-01, DOCS-02) | Source code (`src/update/lease.mjs`, `route.js`, `initializeWorker.mjs`) | `deploy/*/compose.yaml` | D-01: code and compose files are ground truth; docs and maps follow |
| Rendered diagrams | Browser (client-only mermaid import) | Next server (MDX compile) | `next build` compiles MDX only; mermaid runs in the browser |
| Sourcemap generate, upload, delete | Build (`next build` + Sentry `runAfterProductionCompile` hook) | Docker builder stage | All three happen inside `RUN npm run build` (`Dockerfile.app:93-101`) |
| Symbolication | GlitchTip server (6.2.6) | Browser SDK (sends `debug_meta`) | GlitchTip resolves frames by debug ID from uploaded bundles |
| Seed-refresh PR | GitHub Actions (`scheduled-seed-refresh.yml`) | `develop` ruleset | The ruleset decides whether the bot PR can merge |
| Release / deploy | GitHub Actions (`build-release.yml` → `pin-production`) | Arcane Git Sync | Tag triggers build; pin commit triggers deploy; no manual pull |

## Standard Stack

No package is added in this phase. Installed versions (read from `package-lock.json` and `package.json` this session):

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@sentry/nextjs` | 11.10.0 | `withSentryConfig`, post-compile upload and delete | [VERIFIED: package-lock.json:4800-4801] `"node_modules/@sentry/nextjs": {` / `"version": "11.10.0",` |
| `@sentry/bundler-plugins` | 11.10.0 (dependency of `@sentry/nextjs`) | Upload, release, delete logic | [VERIFIED: /tmp/sentry-src/package/package.json:88] `"@sentry/bundler-plugins": "11.10.0",` |
| `sentry` (CLI) | ^0.45.0 (dependency of `@sentry/bundler-plugins`) | Performs the upload | [VERIFIED: bundler-plugins package.json:123] `"sentry": "^0.45.0",` |
| `mermaid` | 12.3.0 | Client-side diagram render; parse check | [VERIFIED: package-lock.json] `"version": "12.3.0",` |
| `jsdom` | 30.1.3 (devDependency) | DOM for the offline `mermaid.parse` script | [VERIFIED: package.json:75] `"jsdom": "^30.1.3",` |
| `vitest` | 5.1.0 | `npm run test:unit` | [VERIFIED: package-lock.json] `"version": "5.1.0",` |
| `next` / `@next/mdx` | 16.4.5 | Build, MDX pages | [VERIFIED: package-lock.json] `"version": "16.4.5",` |

**Installation:** none. **Executor prerequisite** in a lane: `npm ci`, then `POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' npx prisma generate` (the client output is gitignored; `AGENTS.md` Stack row). This worktree has no `node_modules` (0 entries), so the Sentry sources below were read from `npm pack @sentry/nextjs@11.10.0` and `npm pack @sentry/bundler-plugins@11.10.0` in a scratch folder; the version equals the lockfile version.

## Package Legitimacy Audit

No package is installed or added. The new `mermaid.parse` script uses only `mermaid` and `jsdom`, which are already in `package.json`. The legitimacy gate does not apply.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Phase flow

```
develop 0.98.0
  │  release 1: cut PR (version + CHANGELOG) → release PR develop→main (merge commit) → tag vX.Y.Z
  ▼
Build: Release ─ verify ─ build-app (amd64 | arm64) ─ merge-app ─ pin-production ─▶ deploy/production ─ Arcane ─▶ production (migrate-on-start #599 live)
  │
  ▼  work PRs into develop (rebase-merge, notes under ## Unreleased, no version)
  ├─ DOCS-01  AGENTS.md + 4 comments + maps          ├─ DOCS-02  5 pages + 2 lease-line pages
  ├─ HOUSE-03 next.config.mjs + infra Sentry block   └─ #642 seed PR (after release 1 tag) ─▶ staging seeds season 161
  ▼
Check: CI ─▶ Build: Staging (token build, 2 legs) ─▶ staging image sha-<commit>
  ▼  D-15 (1): event from staging build resolves   D-15 (2): .map count/size vs v0.97.2
release 2 ─▶ production ─▶ D-15 (3): .js.map → 404   D-15 (4): symbolicated production event ─▶ close #502
```

### Recommended PR slicing (Claude's discretion, research recommendation)

| PR | Contents | Notes |
|----|----------|-------|
| R1-cut, R1-release | Version cut, release PR, tag (D-21 (1)) | First. Isolates #599. |
| A (DOCS-01) | `AGENTS.md:44` and `:79-83`, 4 comments, 5 map lines, CONCERNS.md `:35-39` and `:50-53` | Comment-only code edits; keep the 403 at `route.js:79-80` |
| B (rendered pages) | architecture, `docs/page.mdx`, `overviewConfig.mjs`, notifications lease lines | Browser render check (D-23) |
| C (text pages) | data-flow, database, testing, infrastructure, `scripts/check-mermaid-fences.mjs` | Parse script is the Wave 0 item |
| D (HOUSE-03) | `next.config.mjs`, infrastructure Sentry block, IN-03 row | Must reach staging before release 2 |
| E (#642) | Existing bot PR | After release 1 tag; one sitting |

### Anti-Patterns to Avoid
- **Hand-editing `.claude/CLAUDE.md`.** Generated and gitignored (`.gitignore:58` is `.claude`). Regenerate in the main checkout after the maps merge: `gsd_run query generate-claude-md --output <file>` [CITED: ~/.claude/gsd-core/workflows/new-project.md:1107]. How it treats an existing file is [ASSUMED] (A7).
- **Deleting the 403 in `route.js` while fixing its comment.** Only the comment at `route.js:76-78` is stale; the guard at `:79-80` stays.
- **Copying private topology into public pages.** `deploy/README.md:30` names LAN details; `deploy/staging/compose.yaml:83-84` names a host and port. Describe roles and replica counts only (D-06).
- **Renaming a Mermaid node ID without updating `flows` and `details`** in the matching config `.mjs`. A renamed node silently loses its panel and highlight.
- **Copying facts from `deploy/README.md`** without checking sources (1)-(3) (D-28).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delete maps after upload | A `postbuild` script or a Dockerfile `find -delete` | `sourcemaps.deleteSourcemapsAfterUpload: true` | The SDK also strips `//# sourceMappingURL=` comments afterwards (`handleRunAfterProductionCompile.js:57`). A Dockerfile delete would run even when the build had no upload. |
| Mermaid syntax check | Eyeballing fences | `mermaid.parse` under jsdom (script below, tested on 12.3.0) | Same engine as the browser |
| Image size and `.map` count | `docker run … find` or `docker image inspect .Size` | `docker create` + `docker export` + `tar` | `.Size` is 0 here; export is exact |
| Seed-refresh CI on the bot PR | Editing the workflow in this phase | A new issue (D-17) | The workflow file does not change in this phase |
| Approval of the bot PR runs | A custom workflow or token swap | UI "Approve workflows to run" or a human push | A token swap is the later fix and belongs in the new issue |

## Research topic 1: `action_required` on a `github.token` PR, and the ruleset (D-17)

### Why the runs wait

| Claim | Evidence | Tag |
|-------|----------|-----|
| GitHub holds `pull_request` runs for approval when a workflow using `GITHUB_TOKEN` creates or updates the PR | Docs: "when a workflow using `GITHUB_TOKEN` creates or updates a pull request" leads to approval-required runs; affected types are `opened`, `synchronize`, `reopened`; "a user with write access to the repository can start the runs by selecting **Approve workflows to run**"; the recommended fix is "a GitHub App installation access token or a personal access token instead of `GITHUB_TOKEN`" | [CITED: docs.github.com/en/actions/concepts/security/github_token · archived 2026-11-14 https://linkding.lav.ren/bookmarks?details=2239] |
| It is a recent rollout | A community thread reports it started about 2026-06-17 for same-repo bot PRs; no GitHub staff reply in the thread | [CITED: github.com/orgs/community/discussions/199292 · archived 2026-11-14 https://linkding.lav.ren/bookmarks?details=6370] (user report, not official) |
| This repo shows it | Four runs of PR #642 at head `a22b7efc` have `event: pull_request`, `status: completed`, `conclusion: action_required`, `actor: github-actions[bot]`, 0 jobs | [VERIFIED: gh api repos/elfensky/helldivers.bot/actions/runs?head_sha=a22b7efc…] ids 42603804822 (`Check: CI`), 42603804939 (`Check: Dependencies`), 42603804837 (`Check: Migrate Image (arm64)`), 42603804918 (`Check: Version Bump`) |
| The workflow uses the default token | `scheduled-seed-refresh.yml:49` `GH_TOKEN: ${{ github.token }}` | [VERIFIED: file read this session] |
| The repo approval setting is not the cause | `GET …/actions/permissions/fork-pr-contributor-approval` → `{"approval_policy":"first_time_contributors"}`. That setting covers fork PRs. I found no documented setting that turns the `GITHUB_TOKEN` gate off. This is an absence. | [ASSUMED] (A10) |
| Unapproved runs turn into `failure` when the PR merges | #531 runs ended `failure` with 0 jobs; run 35578183114 has `updated_at` `2026-09-21T22:10:18Z`, one second after #531 `mergedAt` `2026-09-21T22:10:17Z`. That they were `action_required` before is inferred. | [ASSUMED] (A11) |

CodeQL default setup is not affected: PR #642 has three CodeQL check runs with `event: dynamic` (run 42603799030, `PR #642`) that finished `SUCCESS`. They are not required checks.

### Does approval satisfy the `develop` ruleset?

Ruleset state, read this session [VERIFIED: gh api repos/elfensky/helldivers.bot/rulesets/24004681]:
- `"enforcement":"active"`, `"bypass_actors":[]`, `"created_at":"2026-09-25T17:03:19.679+02:00"`, `"current_user_can_bypass":"never"`.
- `"required_status_checks"` with `"context":"Test & Build"`, `"context":"Visual Regression"`, `"context":"Review Dependencies"`, each `"integration_id":15368`; `"strict_required_status_checks_policy":false`.
- `"pull_request"` rule: `"allowed_merge_methods":["rebase"]`, `"required_approving_review_count":0`.
- Legacy branch protection on `develop` is empty (`required_signatures` false, no status checks).

Job names map to the contexts [VERIFIED: file reads]: `check-ci.yml` job `name: Visual Regression` and `name: Test & Build`; `check-dependencies.yml` job `name: Review Dependencies`. Triggers: `check-ci.yml` `pull_request: branches: [main, develop]`; `check-dependencies.yml` `pull_request: branches: [main, develop]`.

PR #642 today: `mergeStateStatus` `BLOCKED`, `statusCheckRollup` holds only the 3 CodeQL runs. #531 merged with no checks because the ruleset did not exist yet (created 2026-09-25).

**Answer.** Approval is the documented way to start the held runs. Once they run, they attach as `pull_request` check runs from GitHub Actions to head `a22b7efc`, with the same job names the ruleset requires. That should satisfy the three contexts. This is an inference from docs plus ruleset state; nobody has run it on this repo. Tag [ASSUMED] (A2). It needs a live check: after approval, `gh pr view 642 --json mergeStateStatus,statusCheckRollup` must show the three contexts `SUCCESS` and `mergeStateStatus` `CLEAN` (or `BEHIND` is fine; `strict` is false).

### Two ways to unblock (D-17 names both)

| Path | How | Evidence | Risk |
|------|-----|----------|------|
| Approve | PR page → "Approve workflows to run". The REST endpoint `POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve` is documented for "a pull request from a public fork of a first time contributor" only | [CITED: docs.github.com/en/rest/actions/workflow-runs · archived https://linkding.lav.ren/bookmarks?details=6371]. Whether it accepts a same-repo bot PR is untested [ASSUMED] (A3) | The UI click is a human step (`checkpoint:human-action`). Try the API once; fall back to the UI. |
| Human push of the `## Unreleased` note commit | Worktree on `chore/seed-refresh`, add a `CHANGELOG.md` line, push as Andrei | The `synchronize` event is then caused by Andrei's push, not by a `GITHUB_TOKEN` workflow. The docs name only `GITHUB_TOKEN`-created or -updated PRs. Tag [ASSUMED] (A1). | Rebase-merge can conflict on `CHANGELOG.md` if another PR (or the release-1 cut) edits `## Unreleased` meanwhile. This is a second reason to merge #642 after release 1. |

### Timing and ordering facts (all [VERIFIED] unless tagged)
- Today is Saturday 2026-11-14. The next scheduled run is Monday 2026-11-16 `0 3 * * 1` (`scheduled-seed-refresh.yml:5`). Real start times drift late: the last six scheduled runs started at 08:23-10:47 UTC (run 42603725952 at `2026-11-09T10:47:14Z`). "Before 03:00 UTC" is a safe, conservative cut.
- A second run does `git checkout -B chore/seed-refresh` (`:59`) and `git push --force origin chore/seed-refresh` (`:62`). The work tree is `develop`, which lacks `season-161.json` until #642 merges, so the run recreates the file, force-pushes a new SHA, and starts a new round of `action_required` runs. Any human commit on the branch is lost.
- `gh pr create … || echo 'PR already open — branch updated.'` (`:63-66`) hides a real `gh pr create` failure as well as the "already open" case.
- The seed hash covers the seed script and every file under `prisma/seed/seasons/` (`src/update/migrateOnStart.mjs:82-91`: `hash.update(await readFile(path.join(seedDir, 'seed.mjs')))` and `hash.update(await readFile(path.join(seedDir, 'seasons', name)))`). Adding `season-161.json` changes the hash, so the next app start logs `[migrate] seed data changed, seeding` (`migrateOnStart.mjs:111`; the unchanged case logs `[migrate] seed unchanged, skipped`, `:108`). That log line is the D-17 "staging seeds season 161" check.
- `prisma/seed/seasons/` holds 160 files today; #642 adds `season-161.json` (1164 lines, `changeType ADDED`).
- Repo merge settings allow rebase, merge commit and squash; the ruleset allows only `rebase` on `develop`. Merge #642 with `gh pr merge 642 --rebase` (D-27), then delete the branch only after `gh pr view 642 --json state` is `MERGED`.

**What the new issue should state (D-17):** gap 1: GitHub holds `pull_request` runs for PRs that a `GITHUB_TOKEN` workflow creates or updates, and since 2026-09-25 the ruleset blocks the merge until a human approves; the documented fix is a GitHub App installation token or PAT [CITED]. Gap 2: `-B` + `--force` deletes the human note commit that the PR body (`:65`) and `prisma/seed/readme.md:49-51` ask for. Gap 3 (minor): `|| echo` hides a failed `gh pr create`. #501's own title says "when season 160 ends"; #501 has 0 comments, state OPEN.

## Research topic 2: GlitchTip and debug-ID bundles from two per-arch legs (D-15 (1))

### Verdict
Structurally safe. Nothing in the GlitchTip code, the Sentry upload path or the build output ties symbolication to the release name or to one leg. The remaining risks are operational and need a live read; they are listed under "Needs live check at execution".

### What was read
- **Deployed GlitchTip version:** `GET https://glitchtip.lav.ren/api/settings/` returns `"version": "6.2.6"` [VERIFIED: curl this session; public settings endpoint]. Tag `v6.2.6` is dated 2026-08-07; `v7.0.0` is dated 2026-11-09 (GitLab tags API). An upgrade can happen at any time.
- **GlitchTip source at tag `v6.2.6`** (GitLab `glitchtip/glitchtip-backend`, files read via the repository files API at `ref=v6.2.6`):
  - Event lookup: `apps/event_ingest/process_event.py:826` `| Q(debug_id__in={image.debug_id for image in sourcemap_images})` inside a `DebugSymbolBundle` query filtered by `organization__in`. The query matches bundles by debug ID across the whole organization. The release is only an alternative `Q(release__version__in=…, file__name__in=…)` branch. [VERIFIED]
  - Frame matching: `javascript_event_processor.py` `find_source_files` takes `debug_id_map.get(minified_filename)` and compares `str(debug_id) == str(debug_bundle.debug_id)`. `build_debug_id_map` reads `debug_meta.images` of `type == "sourcemap"` and uses the basename of `code_file`. [VERIFIED at tag v6.2.6: `build_debug_id_map` at line 191 and `find_source_files` at line 200 of the same file]
  - Storage: `apps/sourcecode/models.py` `UniqueConstraint(fields=["organization", "debug_id"], name="unique_org_debug_id")`. `apps/files/assemble.py` upserts complete bundles with `update_conflicts=True, unique_fields=["organization", "debug_id"], update_fields=["file", "sourcemap_file", "release"]`. [VERIFIED v6.2.6 line 64 of models.py; assemble upsert read on master and constraint present at v6.2.6]
  - Accepted upload type: `apps/files/api.py` `CHUNK_UPLOAD_ACCEPT` contains `"artifact_bundles",  # Artifact bundles contain debug ids to link source to sourcemaps`. [VERIFIED master]
  - Docs: "GlitchTip 4.2 includes support for sentry SDK \"artifact bundles\"" and "Previously with GlitchTip, a release had to be set to enable source map look ups. That restriction is removed". [CITED: glitchtip.com/blog/2024-11-01-glitchtip-4-2-release · archived https://linkding.lav.ren/bookmarks?details=6374]
- **Sentry 11.10.0 upload path** (opened from `npm pack`, version = lockfile):
  - Release name: `getFinalConfigObjectUtils.js:20` `userSentryOptions.release?.name ?? node.getSentryRelease() ?? buildTime.getGitRevision()`. The Docker build has no `.git` (`.dockerignore` lists `.git`) and no release env var, so the name is probably unset [ASSUMED] (A4).
  - `build-plugin-manager.js:387` `options.release.name ?? "undefined",` and `:463` the same: with no release the CLI is called with the literal string `"undefined"`. How GlitchTip stores that is unknown; a GlitchTip release named `undefined` may exist (live check).
  - `build-plugin-manager.js:476` `handleRecoverableError(e, false);` and `:118` `if (throwByDefault) {`: an upload error is logged with `logger.error("An error occurred. Couldn't finish all operations:", …)` and the build continues. [VERIFIED]
  - `handleRunAfterProductionCompile.js:43` `uploadSourcemaps`, `:55` `deleteArtifacts()`, `:57` `stripSourceMappingURLComments`: delete follows upload without checking its result. [VERIFIED]
  - Success line: `build-plugin-manager.js:395` `logger$1.info("Successfully uploaded source maps to Sentry");`. Both legs of run 41832856848 print it with the prefix `[@sentry/nextjs - After Production Compile]` [VERIFIED: gh run view --log].
- **GlitchTip answers the assemble call before it assembles:** `apps/sourcecode/api.py` ends `return {"state": "created", "missingChunks": []}` after `assemble_artifacts_task.aenqueue(…)`. Assemble failures (bad manifest, "Release does not match uploaded bundle", "Organization does not match uploaded bundle") set a status and log a warning on the server; the client does not read it back. So "Successfully uploaded" proves chunk upload and request acceptance, not storage. [VERIFIED v6.2.6 api.py:96 and assemble.py:191]
- **Shipped output, both arches** (v0.97.2 images pulled and exported this session):
  - amd64: 135 `.js` files, 131 carry a `//# debugId=` line; a chunk starts with `;!function(){try { var e="undefined"!=typeof globalThis?globalThis:…;n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="ba636990-7610-55db-659c-70887f8a9c88")}catch(e){}}();` and ends `//# debugId=ba636990-7610-55db-659c-70887f8a9c88` then `//# sourceMappingURL=39cf4phf896re.js.map`. The SDK chunk reads both globals: `let e=l._sentryDebugIds,n=l._debugIds;`. [VERIFIED: chunks/0wt056db0unhv.js and chunks/04o2_8fpjurm0.js in the v0.97.2 amd64 image]
  - arm64: also 131 debug IDs. **129 of 131 IDs are identical** to amd64; two chunks differ by name and by ID (`1p_aiedyup9ax.js`, `3c2eqryhu_e-o.js` on amd64; `2h9lpwusorfkj.js`, `3bl0qa_gi5jgr.js` on arm64). [VERIFIED: sorted `debugId=` sets, `comm -12`]
  - Consequence: each leg uploads its own IDs. 129 are the same IDs, so the second assemble upserts the first (same unique key; GlitchTip replaces file and sourcemap). The two arch-specific chunks keep separate IDs. Lookup is by ID, so whichever replica serves the page, its chunk's ID is in GlitchTip, provided both uploads assembled.

### Event source for D-15 (1): the gap
- `deploy/staging/compose.yaml` has no `SENTRY_DSN`: `grep -n SENTRY_DSN deploy/staging/compose.yaml` returns 0 lines; the only Sentry key is `SENTRY_SERVER_NAME` at `:79`. `deploy/README.md:36` says "Auth/Umami/Sentry unset on purpose".
- `src/instrumentation-client.js:25` `tunnel: '/api/glitchtip',` and `src/app/api/glitchtip/route.js:12,14` `const dsn = process.env.SENTRY_DSN;` … `return new Response('Tunnel not configured', { status: 503 });`. So staging browsers have a build-time DSN (`NEXT_PUBLIC_SENTRY_DSN` is passed by `build-staging.yml`) but the tunnel refuses to forward.
- `sentry.server.config.js:8` `dsn: process.env.SENTRY_DSN,` → the server SDK is off on staging too.

Options for the plan (Andrei decides; offer these at the planning stop):

| Option | What | Trade-off |
|--------|------|-----------|
| (a) Recommended | Controlled synthetic envelope to GlitchTip ingest (the DSN is public, `deploy/README.md:139`): event with `debug_meta.images=[{type:'sourcemap', code_file:'<chunk url>', debug_id:'<id from the staging image chunk>'}]` and a frame whose `abs_path` basename equals the chunk file name, at a mapped line and column; tag `environment: staging-probe`. | No staging config change. Proves server-side resolution of the uploaded maps. It is not an SDK-generated event, so it does not prove the SDK sends `debug_meta`; step (4) does. Writes one test event into the production GlitchTip project; ask first. |
| (b) | Add `SENTRY_DSN` to `deploy/staging/compose.yaml` and trigger a real client error on staging | Real SDK path. Changes staging semantics ("unset on purpose"); every staging error then lands in the production project. |
| (c) | Run the staging image locally with `SENTRY_DSN` and a Postgres | Real SDK path without touching staging; needs a database and several steps |

Step (4) needs a natural production event. `REQUIREMENTS.md` STAB-01 says residual React #418 mismatches stay tracked, so browser events with minified frames exist; whether one arrives within the window is [ASSUMED] (A6). Put a human checkpoint with a fallback (Andrei picks a probe) in the plan.

### Needs live check at execution (no GlitchTip read was possible; the connector is not authorized in this session)
1. GlitchTip version is still 6.2.6 (`curl -s https://glitchtip.lav.ren/api/settings/ | jq .version`; a `v7.0.0` upgrade would need a re-read of `assemble.py` and `process_event.py`).
2. After the staging build: GlitchTip holds bundles for the uploaded debug IDs. UI: project settings, Source Maps / artifact bundles. Compare 3 IDs from `grep -rhoE 'debugId=[0-9a-f-]{36}'` over the staging image's `.next/static`.
3. GlitchTip server logs show no `assemble_artifacts:` warning for the upload times of both legs (bad manifest, org or release mismatch, extraction limits).
4. A release named `undefined` exists or not (A4). Harmless for debug-ID lookup; report it.
5. A real browser event from a stripped build carries `debug_meta.images` and resolves with `context_line`. The 0.95.2 proof (D-13) used the old `sentry-cli` stack; Sentry 11.10.0 with `sentry` 0.45.0 has none yet (D-24).
6. A third-party report (jv3n/trade #568) saw artifact-bundle uploads accepted but events still minified on some GlitchTip versions; its author calls the cause an inference, and it involved Angular, not Next.js [CITED: github.com/jv3n/trade/issues/568 · archived https://linkding.lav.ren/bookmarks?details=6377]. Treat it as the reason to prove step (1) before the strip ships, as D-15 already says.

## HOUSE-03 facts

**Sentry 11.10.0 code path** [VERIFIED: files from `npm pack @sentry/nextjs@11.10.0`, `build/cjs/config/…`]:
- `withSentryConfig/getFinalConfigObjectBundlerUtils.js:127` `if (incomingUserNextConfigObject.productionBrowserSourceMaps !== void 0) {` followed by `return;`; `:134` `incomingUserNextConfigObject.productionBrowserSourceMaps = true;`; `:143-145` `userSentryOptions.sourcemaps = { …, deleteSourcemapsAfterUpload: true }`. With the option unset, the SDK enables maps and the delete default. With today's explicit `true`, it stands down.
- `types.d.ts:406` `deleteSourcemapsAfterUpload?: boolean;`. `getBuildPluginOptions.js:184` `const deleteSourcemapsAfterUpload = sentryBuildOptions.sourcemaps?.deleteSourcemapsAfterUpload ?? false;`.
- `next.config.mjs` has no `turbopack` key (grep), so Sentry injects the debug IDs itself (`handleRunAfterProductionCompile.js:41` `injectDebugIds`).

**Edit shape** (`next.config.mjs`; current text at `:17` and `:214-225`):

```js
// delete line 17:  productionBrowserSourceMaps: true,
export default process.env.SENTRY_AUTH_TOKEN ?
    withSentryConfig(finalConfig, {
        // (keep the existing "No `silent: true`" comment)
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        sentryUrl: process.env.SENTRY_URL,
        sourcemaps: { deleteSourcemapsAfterUpload: true },
    })
:   finalConfig;
```

**A local build proves nothing about the strip.** Without `SENTRY_AUTH_TOKEN` the wrapper is skipped (`next.config.mjs:214`). Only `Build: Staging` and `Build: Release` build with the token (`Dockerfile.app:94-97` secret mounts).

**Release gate (replaces "the build passed").** For each leg of the staging build and of release 2, the job log must contain `[@sentry/nextjs - After Production Compile] Info: Successfully uploaded source maps to Sentry` (v0.97.2: amd64 job 126585351874, arm64 job 126585351914). Keep `silent` unset (`next.config.mjs:22-25` comment). A missing line on either leg blocks the release, because the maps are deleted anyway.

**Baseline for D-15 (2): `ghcr.io/elfensky/helldiversbot:v0.97.2`** [VERIFIED: `docker pull`, `docker create`, `docker export | tar` this session; digest `sha256:c5534747f4d2e80815d74c2c0308ab487497f4c02e316477f3093270adf8ed20`]:

| Item | amd64 value |
|------|-------------|
| `.map` files in image (all) | 190 |
| `.map` in `app/.next/static` | 142 files, 31,057,870 bytes (`stat -f%z` sum) |
| `.map` in `app/.next/server` | 48 files, 6,672 bytes |
| `.js` in `app/.next/static` | 135 files, 7,264,852 bytes |
| `docker images` | disk usage 505 MB, content size 119 MB |

The #502 body figure (24.6 MB, 142 files) is from v0.90.5; the file count is unchanged, the size is now 31.06 MB. Expected after the strip: `static` `.map` count 0, `server` count 48 (unchanged), and no `sourceMappingURL` lines in `static` JS (`grep -rhoE 'sourceMappingURL=[^ ]*'`); the `//# debugId=` lines stay. `docker image inspect --format '{{.Size}}'` printed `0` on this daemon (containerd image store); use the export method.

```bash
# empty scratch folder; extracted data is untrusted: only read it
IMG=ghcr.io/elfensky/helldiversbot:v0.97.2
docker pull --platform linux/amd64 "$IMG"
docker create --name hdb-measure --platform linux/amd64 "$IMG" >/dev/null
docker export hdb-measure | tar -x -C ./ex app/.next/static app/.next/server
docker rm hdb-measure
find ./ex/app/.next/static -name '*.map' | wc -l
find ./ex/app/.next/static -name '*.map' -exec stat -f%z {} + | awk '{s+=$1} END {print s}'   # macOS; GNU: stat -c%s
```

**D-15 (3) probe** (production, after release 2): take a real chunk URL from the live HTML, then request it with `.map` appended; expect 404. Use `/usr/bin/curl` by full path: the `rtk` hook replays cached bodies for identical `curl` strings (global memory).

```bash
URL=$(/usr/bin/curl -s https://helldivers.bot/ | /usr/bin/grep -o '/_next/static/[^"]*\.js' | head -1)
/usr/bin/curl -s -o /dev/null -w '%{http_code}\n' "https://helldivers.bot${URL}.map"    # expect 404
```

**Other effects to check after the strip** (cheap): `grep -c '\.map' public/sw.js` after a token build (Serwist precache; A8); the Lighthouse `valid-source-maps` audit in `scheduled-pagespeed.yml` (deferred note); IN-03 row in `01-REVIEW-DISPOSITION.md:31` is `| IN-03 | info | next.config.mjs:1,15 | open | next.config.mjs details |` and becomes resolved.

**Record on #502** (0 comments today; state OPEN): the D-13 evidence, then D-15 steps (1)-(4). Do not write tokens, DSNs with keys or private hosts into the comment; the DSN host `glitchtip.lav.ren` is already public in workflow logs.

## HOUSE-04 facts

| Fact | Value | Tag |
|------|-------|-----|
| PR #642 | OPEN, base `develop`, head `chore/seed-refresh` @ `a22b7efc0ee26b65ed13baf55c10a0b9a9b3211a`, one commit `chore(seed): add newly completed seasons`, one file `prisma/seed/seasons/season-161.json` (+1164), `mergeStateStatus` BLOCKED, 0 comments, 0 reviews | [VERIFIED: gh pr view 642] |
| Base of #642 | `2a86e6c8…`; `origin/develop` is `70ccc071` (the PR needs no rebase: `strict_required_status_checks_policy` is false) | [VERIFIED] |
| Run that opened it | 42603725952, `schedule`, `success`, created `2026-11-09T10:47:14Z`, one job `Fetch New Seasons` | [VERIFIED: gh run view] |
| First real run | 35578125172 (2026-09-21) → PR #531 → merge `66093080`; #531 `statusCheckRollup` empty | [VERIFIED: gh pr view 531] |
| #501 | OPEN, 0 comments, title "Verify seed-refresh workflow PR path end-to-end when season 160 ends", milestone Engineering Health | [VERIFIED] |
| Open related issues | #624 (deploy guide), #629 (cache headers), #631 (analytics plumbing), all milestone Engineering Health; milestone number 17, state open | [VERIFIED: gh issue list, gh api milestones] |
| Workflow lines | `:5` cron, `:49` `GH_TOKEN: ${{ github.token }}`, `:59` `git checkout -B chore/seed-refresh`, `:62` `git push --force origin chore/seed-refresh`, `:65` `--body 'Automated weekly run of \`prisma/seed/fetch-seasons.mjs\`. Push a CHANGELOG commit (under \`## Unreleased\`) onto this branch, then rebase-merge.' \` | [VERIFIED: file read] |
| Readme text | `prisma/seed/readme.md:49-51` "Push a CHANGELOG entry under `## Unreleased` onto that branch as usual (from a worktree), then rebase-merge the PR" | [VERIFIED] |

What the two real runs prove for #501's checklist: PR creation under `github.token` (both), and, new with #642, that the PR cannot merge without a human action. The "PR already open" fallback (`:66`) has not run for real; say so in the closing comment instead of claiming full coverage. HOUSE-04's wording ("a real season transition, or a controlled simulation") is met by a real run landed through the ruleset.

Ordering: land #642 after release 1 is tagged and before the next Monday 03:00 UTC (2026-11-16), in one sitting (see Research topic 1). If that window is missed, the Monday run recreates the branch and the approval or push step repeats; nothing is lost but time.

## DOCS-01 facts (every ref re-read at 0.98.0)

| Item | Current text / value | Tag |
|------|---------------------|-----|
| `AGENTS.md:44` | `` `gh pr merge --rebase --delete-branch`. A release PR `develop` → `main` uses a merge commit and gets `` (the command is on line 44) | [VERIFIED: grep -n delete-branch → 44] |
| `AGENTS.md:77` / `:79-83` | `## Architecture invariants` / bullet `- **Exactly one poller across replicas.** Every replica runs the worker (…), but only the holder of the `worker_heartbeat` lease (`src/update/lease.mjs`) polls the HD1 API; handover state (`prevEvents`, `lastSeasonObserved`) lives in the lease row, not in module memory.` | [VERIFIED] |
| `WORKER_ENABLED` in AGENTS.md | 0 hits (`grep -n WORKER_ENABLED AGENTS.md` empty) | [VERIFIED] |
| Lease constants | `src/update/lease.mjs:19` `export const WORKER_TYPE = 'cron_api_poller';` and `:20` `export const LEASE_TTL_S = 60; // 3 polls at the 20 s staging cadence` | [VERIFIED] |
| Standby answer | `route.js:91` `return successResponse(200, start, { role: 'standby', holder: HOLDER_ID });` | [VERIFIED] |
| Replica counts | `deploy/staging/compose.yaml:112` and `:146` `replicas: 2`; `deploy/production/compose.yaml:118` and `:151` `replicas: 2`; `:79` `UPDATE_INTERVAL: '20'` | [VERIFIED] |
| Comment 1 | `route.js:35` "The worker polls every ~15s, so" (inside the `lastRateLimitCleanup` throttle comment at `:34-38`) | [VERIFIED: sed 25-40 → line 11 of excerpt] |
| Comment 2 | `route.js:76-78` "A web-only replica must never run the update: prevEvents and / lastSeasonObserved live in this process, so a poll landing here would / diff against stale state and re-send push notifications (#516)." Guard stays at `:79-80`: `if (!isWorkerEnabled()) return errorResponse(403, start, 'worker disabled on this instance');` | [VERIFIED] |
| Comment 3 | `initializeWorker.mjs:2-6` "True unless WORKER_ENABLED is explicitly "false". Lets a horizontally scaled web tier run with the poller switched off: the update path keeps state in memory (prevEvents, lastSeasonObserved), so exactly one instance may poll — see #516. Deployments run N web replicas with WORKER_ENABLED=false and one worker replica with it on (deploy/staging/compose.yaml)." | [VERIFIED] |
| Comment 4 | `public/workers/cron.js:13` " * 1. Spawned by src/instrumentation.js during application startup"; real chain `src/instrumentation.node.js:18` `await migrateOrWait();` and `:22` `const worker = await initializeWorker();` | [VERIFIED] |
| Already correct | `.example.env:17-19` "# WORKER_ENABLED="false" — serve web only, no poller. Not needed to scale: every / # replica runs the worker, and the worker_heartbeat lease lets only one of them / # poll (src/update/lease.mjs)." | [VERIFIED] |
| `initializeWorker` crash handling | `initializeWorker.mjs:68` `if (!shuttingDown) process.exit(1);` | [VERIFIED] |
| Map lines | `STACK.md:85`, `ARCHITECTURE.md:125`, `:127`, `:130`, `INTEGRATIONS.md:79` ("docker-compose.yml for staging pull-based compose") and `:80` ("Production runs 3 app replicas behind a service VIP…") all still hold. | [VERIFIED] |
| Extra stale map text | `CONCERNS.md:35-39` (entire concern "Worker poller state: CLAUDE.md describes module-level state that code no longer has"), `:44-48` (#501 "unverified", changes when #501 closes), `:50-53` (#502, D-10). `PROJECT.md:78` already says Vitest 5 (the old "Vitest 4" fix is done). | [VERIFIED] |
| Writes per path | `season.mjs:10-12` imports `upsertSeason`, `upsertEvent`, `upsertStatus` only; `status.mjs:8-12` imports those plus `upsertStatistic` and `upsertEventProgress` (calls at `:88`, `:101`, `:118`) | [VERIFIED] |
| `.claude/CLAUDE.md` | Exists in the main checkout `/Users/andrei/Developer/helldivers.bot/.claude/CLAUDE.md`; GSD markers at `:1` (`source:PROJECT.md`), `:23` (`source:codebase/STACK.md`), `:93` (`source:CONVENTIONS.md`), `:169` (`source:ARCHITECTURE.md`). Regenerate only after the maps merge and a `git pull --ff-only` there. | [VERIFIED: grep -n source:] |

## DOCS-02 facts

**Sweep baselines** (run at 0.98.0 with `bash`, patterns in § Code Examples 3): sweep 1 (retired strings) = 46 lines (architecture 3, data-flow 4, infrastructure 15, database 19, testing 4, notifications 0); sweep 2 (`~15s`, `every ~15`, `in memory`) = 11 lines (architecture 8, notifications 3). Target for both: 0, minus any legitimate use (review each remaining hit by hand).

**CONTEXT line refs: exact vs moved.**
- Exact: `database/page.mdx` `:41` (`import 'dotenv/config';`), `:51`, `:130`, `:174`, `:188`, `:194`, `:203`, `:212`, `:523` (`### Review`), `:578` (`## 7. App Configuration Model`), `:613`, `:638`; `testing/page.mdx` `:11`, `:22`, `:107`, `:137`, `:271`, `:282`; `infrastructure/page.mdx` `:82`, `:86`, `:98`, `:114`, `:122`, `:193`, `:211`, `:244`, `:304`, `:373`, `:428`, and old workflow names at `:149`, `:171`, `:195`; `data-flow/page.mdx` `:4`, `:90`, `:103`, `:153`, `:200`, `:441`.
- Moved or different: the `POSTGRES_SSL` row is at `infrastructure/page.mdx:427` (not `:433`); `SKIP_MIGRATIONS` is already gone from the page; the word "distroless" no longer appears on the infrastructure page (the `:90-95` text to remove is `NODE_ENV=staging` at `:90`, `uid 1001` at `:91`, `/sbin/tini --` at `:95`, and migrate-image tini at `:44` and `:50`); the database ER fences are at `:73` and `:231` (not `:215`); `.mdx` fences: architecture `:46`, data-flow `:19,:100`, infrastructure `:13,:129,:205`, database `:73,:231`, testing `:24`.
- New facts for database: `prisma/schema.prisma:238-251` `model worker_heartbeat` with `holder_id String?`, `lease_until DateTime?`, `prev_events Json?`, `last_season_observed Int?` (lines 247-250); `:284-292` `model api_rate_limit { key String / route_group String / window_start Int / count Int @default(0) / @@id([key, route_group, window_start]) / @@index([window_start]) }`. `window_start` is `Int`, not a timestamp. `grep -n Timestamptz prisma/schema.prisma` finds nothing. The page has 19 `TIMESTAMPTZ` cells. Schema models: Account, Session, Verification, User, Settings, ApiKey, h1_season, h1_event, h1_status, h1_statistic, h1_event_progress, push_subscription, worker_heartbeat, app_instance, seed_state, api_rate_limit. `prisma.config.mjs:1-3`: `import dotenv from 'dotenv';` / `dotenv.config({ path: '.env.development' });` / `dotenv.config(); // fallback to .env (production/Docker)`.

**Architecture diagram files** (rendered, D-23): `architecture/dataFlowConfig.mjs` `:6` `Live Polling (~15s)`, `:65` `Polled every ~15 seconds.`, `:69` `~15s poll`, `:90` `~15s poll + on demand`, `:121` file list (ends before `season-160`; 160 seed files exist), `:136` `~15s loop`, `:153` `subtitle: 'prisma db seed'`; `dataFlowDefinition.mjs:12` seed node label `prisma db seed / startup`, `:30-31` `~15s`, `~15s + on demand`. The `snapshot` flow at `dataFlowConfig.mjs:24-31` lists `h1_statistic` and `h1_event_progress`, which `updateSeason` does not write. Seed command now: `Dockerfile.migrate:143` "`node --experimental-strip-types prisma/seed/seed.mjs`"; at app start the seed runs through `migrateOrWait` when the seed hash changed (`migrateOnStart.mjs:105-111`). Exports for scripted parsing: `DEFINITION_LR`, `DEFINITION_TD` (`dataFlowDefinition.mjs:75`), built by `buildMermaidDefinition(body)` (`_diagram.mjs:12`).

**data-flow "on-demand" is not retired** (D-08). Callers of `updateSeason(` outside tests [VERIFIED: grep]: `route.js:139` (closing pass) and `:160` (every poll, with `{ protectedBucket }`), `src/app/api/h1/rebroadcast/route.js:126`, `src/features/archives/reseedSeason.mjs:55`, `src/shared/utils/api/backfillSeason.mjs:15`, `src/db/queries/getCampaignOrSeed.mjs:27`. Edit the false sentences (`:90` "runs on-demand", `:441` "not called on a schedule"); keep the sections. The `?key=` replacement is the header: `public/workers/cronLogic.js:32` `Authorization: \`Bearer ${key}\`,` and `:14` `const WORKER_STARTUP_HEADER = 'X-Worker-Startup';`, optional `GLITCHTIP_HEARTBEAT_URL` POST (`:41-42`). Route side: `route.js:26` `export const WORKER_STARTUP_HEADER = 'x-worker-startup';`; `GET` at `:62`; `POST` is `methodNotAllowed` (`:221`), which fixes `overviewConfig.mjs:92` "Internal POST endpoint".

**infrastructure facts for the new sections** [VERIFIED: file reads]:
- 11 workflow files and their `name:` values: `build-release.yml` "Build: Release" (tag `v*.*.*`; `workflow_dispatch` input `tag` re-pins only), `build-staging.yml` "Build: Staging" (`workflow_run` of "Check: CI"), `check-ci.yml` "Check: CI" (PR/push `main`, `develop`), `check-codeql.yml` "Check: CodeQL" (+ cron `0 6 * * 1`), `check-dependencies.yml` "Check: Dependencies", `check-docker-smoke.yml` "Check: Docker Smoke" (PR to `main`), `check-migrate-arm64.yml` "Check: Migrate Image (arm64)" (path filter), `check-version.yml` "Check: Version Bump" (PR to `main` only, paths `src/**`, `prisma/**`, `public/**`, `package.json`), `cleanup-ghcr.yml` "Cleanup: GHCR" (cron `17 4 * * 1`), `scheduled-pagespeed.yml` "Scheduled: Pagespeed" (Mon 00:00 and Fri 06:00 UTC), `scheduled-seed-refresh.yml` "Scheduled: Seed Refresh". Composite actions: `.github/actions/verify`, `.github/actions/docker-publish`.
- Release path: `build-release.yml` jobs `verify` (`Test & Build`), `build-app` (matrix `amd64` on `ubuntu-latest`, `arm64` on `ubuntu-24.04-arm`), `merge-app` (`docker buildx imagetools create -t "$IMAGE:$TAG" -t "$IMAGE:production" -t "$IMAGE:latest" …`), migrate legs, `pin-production` (`:278-279`). Staging: `build-staging.yml` stamp step `echo "version=$(jq -r .version package.json)-dev.${TESTED_SHA::7}"`, `bump-staging-tag` (`:267`).
- Runner image: `Dockerfile.app:138` `FROM node:26-slim AS runner`; user 65532 (`--chown=65532:65532`, `:167-169`); the comment above says it replaced distroless on 2026-10-23.
- Env keys in `.example.env` (36): AUTH_DISCORD_ID, AUTH_DISCORD_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BUCKET_SIZE, DEPLOY_ENV, FORCE_SEED, GLITCHTIP_HEARTBEAT_URL, LEGACY_POSTGRES_URL, MIGRATE_ROOT, NEXT_PUBLIC_DEPLOY_ENV, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, PORT, POSTGRES_URL, SEED_TEST_API_KEY, SEED_TEST_API_KEY_HASH, SENTRY_AUTH_TOKEN, SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_SERVER_NAME, SENTRY_URL, SMOKE_ALLOW_SKIP, TEST_SERVER_URL, UMAMI_SITE_ID, UMAMI_SITE_URL, UPDATE_INTERVAL, UPDATE_KEY, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT, WORKER_ENABLED (names only; extracted with a regexp, so re-read the file for commented-out keys).
- The page's env table is `infrastructure/page.mdx:399-430`. It lacks `BUCKET_SIZE`, `FORCE_SEED`, `WORKER_ENABLED`, `SENTRY_SERVER_NAME`, `LEGACY_POSTGRES_URL`, `SEED_TEST_API_KEY(_HASH)`, `SMOKE_ALLOW_SKIP`, `TEST_SERVER_URL`; it has `POSTGRES_SSL` (`:427`), which no code reads (`grep` over `src` finds only the test `exampleEnv.test.mjs:22` `expect(exampleEnv).not.toContain('POSTGRES_SSL=')`). `docker-compose.ci.yml:70` still sets `POSTGRES_SSL: 'false'` (not in scope; mention in the PR).

**testing facts:** `src/__tests__` holds `smoke`, `unit`, `utils`, `visual`; `src/__tests__/unit` holds `_meta`, `app`, `auth.test.mjs`, `config`, `db`, `features`, `shared`, `update`, `validators`, `workers` (199 test files under `unit`). `_meta` holds `browserslist`, `exampleEnv`, `jsconfig`, `mirrorTree`, `packageScripts`, `seedSkip`. `package.json:15-20`: `"test": "vitest run"`, `"test:unit": "vitest run"`, `"test:smoke": "vitest run --config vitest.smoke.config.mjs"`, `"test:all": "vitest run && vitest run --config vitest.smoke.config.mjs"`. `smoke.test.mjs:1` `const BASE_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';` and `:11` `const allowSkip = /^(1|true)$/i.test(process.env.SMOKE_ALLOW_SKIP ?? '');`. `vitest.config.mjs` coverage `exclude` has 3 globs (`src/generated/**`, `src/**/*.{test,spec}.{js,jsx,mjs}`, `src/__tests__/**`).

**Mermaid baseline under 12.3.0** (script below, run on this worktree): all fences `OK` except `FAIL database fence@73 Parse error on line 97: … String userId PK-FK`. Fix: `PK, FK` (`database/page.mdx:170`). Fences render only as `<pre>` (`mdx-components.jsx:26` `pre: ({ children }) => (`). Only five `<MermaidDiagram>` uses exist: `architecture/page.mdx`, `page.mdx`, `notifications/page.mdx` (3 diagrams). Render failure is silent in the page: `useMermaidRender.mjs` logs `[MermaidDiagram] render failed:` to the console and leaves the SVG empty, so the browser check reads the console and the DOM.

**Lease lines on other pages (D-07):** `notifications/page.mdx:115`, `notificationFlowConfig.mjs:175`, `pushFlowConfig.mjs:36` ("in memory"); `docs/page.mdx:32` (also `data-flow/page.mdx:4`, same phrase); `overviewConfig.mjs:92`. Optional extra wording (out of D-07): `notificationFlowConfig.mjs:57,63`, `inAppFlowConfig.mjs:47` omit the lease claim.

## Common Pitfalls

### Pitfall 1: Staging cannot produce the D-15 (1) event
**What goes wrong:** the plan says "open staging, throw an error, read GlitchTip"; the tunnel answers 503 and nothing arrives.
**Why:** staging has no runtime `SENTRY_DSN` (§ Research topic 2).
**How to avoid:** decide the event source (a/b/c) at planning; make it a `checkpoint:decision`.
**Warning signs:** `POST /api/glitchtip` returns 503 on staging.

### Pitfall 2: "Successfully uploaded" read as "symbolication works"
**What goes wrong:** the maps are deleted, and GlitchTip never assembled the bundle.
**Why:** upload errors do not fail the build; GlitchTip assembles after it answers `created`.
**How to avoid:** gate on the log line per leg, then prove with an event (D-15 (1)). Never skip step (1).

### Pitfall 3: Treating a local `npm run build` as proof of the strip
**Why:** no token locally, the wrapper is skipped. Use the staging image.

### Pitfall 4: Merging #642 before release 1, or across Monday 03:00 UTC
**Why:** release 1 would carry season 161 (seed hash), the note commit can collide with the cut, and the Monday run force-pushes over human commits. See § HOUSE-04 facts.

### Pitfall 5: Verifying a diagram that is not rendered
Fences are text. Use the parse script for fences and the browser only for the five component diagrams.

### Pitfall 6: Detail-panel keys out of sync
Adding a lease node to `dataFlowDefinition.mjs` needs matching `flows` and `details` entries in `dataFlowConfig.mjs`, in the same edit. `src/__tests__/unit/app/docs/_diagram.test.mjs` covers `_diagram.mjs`; keep its exports unchanged.

### Pitfall 7: `docker image inspect .Size` and `grep` under `rtk`
`.Size` is 0 under the containerd store. Use the export method. The Bash hook rewrites `grep` and `curl`; call `/usr/bin/grep` and `/usr/bin/curl` for measurements and probes (global memory).

### Pitfall 8: `--delete-branch` from a lane
Use `gh pr merge <n> --rebase`, check `gh pr view <n> --json state` is `MERGED`, then `git push origin --delete <branch>` (D-27). A release PR never deletes `develop`.

### Pitfall 9: Claiming #501 fully verified
The "PR already open" path did not run. Say so.

### Pitfall 10: Regenerating `.claude/CLAUDE.md` in the lane
It lives in the main checkout, is gitignored, and loads only there. Regenerate after the maps merge.

## Code Examples

### 1. Mermaid fence parse script (tested here on mermaid 12.3.0 + jsdom 30.1.3; place as `scripts/check-mermaid-fences.mjs`)

```js
// usage: node scripts/check-mermaid-fences.mjs   (reads src/app/docs/*/page.mdx, never writes)
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const mermaid = (await import('mermaid')).default;

let fail = 0;
for (const p of ['architecture', 'data-flow', 'infrastructure', 'database', 'testing', 'notifications']) {
    const t = fs.readFileSync(`src/app/docs/${p}/page.mdx`, 'utf8');
    for (const m of t.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
        const line = t.slice(0, m.index).split('\n').length;
        try {
            await mermaid.parse(m[1]);
            console.log('OK  ', p, `fence@${line}`);
        } catch (e) {
            fail++;
            console.log('FAIL', p, `fence@${line}`, String(e.message).split('\n').slice(0, 3).join(' | '));
        }
    }
}
process.exit(fail ? 1 : 0);
```

Baseline output today: 8 lines `OK`, `FAIL database fence@73 Parse error on line 97: | ...    String userId PK-FK        Json   s`, exit code 1. Run it fail-first, fix `PK-FK` → `PK, FK`, run again. The five rendered definitions (`DEFINITION_LR`, `DEFINITION_TD` exports) can be parsed the same way by importing the `*Definition.mjs` files. Repo lint ignores `scripts/**` in one list (`eslint.config.mjs:89`); check that `npm run lint` and `npm run typecheck` (`jsconfig.json` includes only `src/**`) stay green with the new file.

### 2. Browser check for the five rendered diagrams (D-23)

Start a lane server on its own port (the dev server on :3000 may serve another checkout): `WORKER_ENABLED=false POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' UPDATE_KEY=x UPDATE_INTERVAL=20 npx next dev -p 3100` (or `npm run build` then `npx next start -p 3100`). Whether the server starts with no reachable database is [ASSUMED] (A9). Pages: `/docs/architecture`, `/docs`, `/docs/notifications`. With chrome-devtools: `list_console_messages` must hold no `[MermaidDiagram] render failed:`; `document.querySelectorAll('.diagram-canvas svg').length` must equal the diagrams on the page (1, 1, 3); click one changed node and read the `DetailPanel`; repeat at width ≤ 768 px (the mobile `TD` definition).

### 3. Stale-string sweep (run under `bash`; zsh aborts on unmatched globs)

```bash
PAGES="src/app/docs/architecture src/app/docs/data-flow src/app/docs/infrastructure src/app/docs/database src/app/docs/testing src/app/docs/notifications src/app/docs/page.mdx src/app/docs/overviewConfig.mjs"
/usr/bin/grep -rnE 'TIMESTAMPTZ|initializeOpenApiSpec|\?key=|staging\.docker\.yml|release\.docker\.yml|metrics\.yml|[^-a-z]ci\.yml|euraika|aegis|POSTGRES_SSL|SKIP_MIGRATIONS|5-15 seconds|silent: true|snapshot throttling|AI assistants|distroless|tini|uid 1001|RELEASE\.md|softprops|prisma db seed' $PAGES   # baseline 46
/usr/bin/grep -rnE '~15 ?s|every ~15|in memory' $PAGES                                                                                                                                           # baseline 11
/usr/bin/grep -nE 'module-level state|~15 seconds|~15s|--delete-branch' AGENTS.md                                                                                                                  # baseline: line 44 only
```

### 4. Quick facts for the DOCS-01 text (verbatim sources)

```js
// src/update/lease.mjs:19-20
export const WORKER_TYPE = 'cron_api_poller';
export const LEASE_TTL_S = 60; // 3 polls at the 20 s staging cadence
// src/app/api/h1/update/route.js:91
return successResponse(200, start, { role: 'standby', holder: HOLDER_ID });
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `sentry-cli` artifact bundle (0.95.2) | `@sentry/bundler-plugins` 11.10.0 + `sentry` CLI ^0.45.0, debug-ID bundles, `_debugIds` global | Sentry 11 (v0.95.8 → v0.97.2) | D-24: no symbolicated Sentry 11 event recorded yet |
| Distroless runner | `node:26-slim`, uid 65532, shell present | 2026-10-23 (`Dockerfile.app` comment) | Docs text to fix; `docker run … find` works now |
| Manual production pull | `pin-production` + Arcane Git Sync | v0.96.4 | Plans contain no manual pull (D-29) |
| Version bump per PR | Accumulate, then cut (#618) | 2026-11 | Work PRs add notes only (D-22) |
| `GITHUB_TOKEN` PR runs no workflows | PR runs wait for approval | GitHub rollout, reported from 2026-06 | #642 blocked by the ruleset |
| Merge-back after release | None (#621) | 2026-11 | Release = cut PR + release PR + tag |

**Deprecated/outdated:** `initializeOpenApiSpec()` (gone from `src`), `?key=` auth, `POSTGRES_SSL`, `SKIP_MIGRATIONS`, `RELEASE.md` as release body source (now awk from `CHANGELOG.md`, `build-release.yml`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A human push to `chore/seed-refresh` starts the PR runs without approval | Research topic 1 | The push path also waits; fall back to the UI approval |
| A2 | After approval, the 3 jobs attach to head `a22b7efc` and satisfy the ruleset contexts | Research topic 1 | Merge stays BLOCKED; read `statusCheckRollup`, then ask Andrei |
| A3 | The `/actions/runs/{id}/approve` REST endpoint rejects same-repo bot PRs | Research topic 1 | None; the UI path works either way |
| A4 | In the Docker build the Sentry release name is unset (CLI gets `"undefined"`) | Research topic 2 | A GlitchTip release named `undefined` appears; harmless for debug-ID lookup |
| A5 | Production runs amd64 images, staging (Pi) runs arm64 | Research topic 2 | Only changes which leg's IDs the browsers see; both legs upload |
| A6 | A natural production browser event with a minified frame arrives after release 2 | Research topic 2 | D-15 (4) stalls; Andrei picks a probe |
| A7 | `generate-claude-md --output` regenerates an existing `.claude/CLAUDE.md` in place | DOCS-01 | Wrong command; find the GSD regeneration command in the main checkout |
| A8 | `.map` files were never in the Serwist precache | HOUSE-03 | `sw.js` references a missing file; `grep '\.map' public/sw.js` after a token build |
| A9 | The lane server starts without a reachable Postgres | Code Examples 2 | Executor needs a database or a production build |
| A10 | No documented setting disables the `GITHUB_TOKEN` approval gate | Research topic 1 | A setting exists and the new issue's fix is simpler |
| A11 | #531's unapproved runs were `action_required` until the merge turned them into `failure` | Research topic 1 | Wording only in the issue |

## Open Questions

1. **Event source for D-15 (1).**
   - Known: staging has no `SENTRY_DSN`; the tunnel returns 503.
   - Unclear: whether Andrei accepts a synthetic probe event in the production GlitchTip project (option a), or wants a staging DSN (option b).
   - Recommendation: option (a), with the event tagged `staging-probe`. Ask at the planning stop. If there is no answer, the plan falls back to option (c) and a human checkpoint.
2. **Order of release 1 and #642.**
   - Known: #642 merged first would put season 161 in release 1 and may collide with the cut.
   - Recommendation: release 1 first. If Andrei wants season 161 live at once, accept both in release 1 and drop the "isolates #599" claim.
3. **Where does 02-04 sit in the waves?** Today it is wave 4 after the old 0.95.7 release. With D-21 (1) first, it follows the release-1 tag.
4. **Remaining `01-REVIEW-DISPOSITION.md` rows.** Only IN-03, WR-07 and WR-08 are in scope; the other rows stay `open` (rows IN-01, IN-02, IN-04, IN-05 seen as `open`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker daemon | D-15 (2) measurement | yes | client and server 29.9.3 (containerd store) | — |
| `gh` | issues, runs, PRs, rulesets | yes (logged in as `elfensky`) | — | — |
| Node (mise) | verify chain | yes | v26.12.1; `mise.toml` `node = "26"`; mise 2026.11.7 | — |
| `node_modules` / Prisma client in this worktree | typecheck, tests, build | no (0 entries) | — | `npm ci` then `prisma generate` in the lane |
| GlitchTip MCP connector | D-15 (1), (4), D-13 record | no (not authorized in this session) | — | Re-authorize in claude.ai connector settings; or read the GlitchTip UI; the public `GET /api/settings/` works unauthenticated |
| chrome-devtools MCP | D-23 render check | not probed | — | Executor probes on first call |
| Human steps | UI approval of runs, `pin-production` watch, GlitchTip reads | Andrei | — | `checkpoint:human-action` / `human-verify` |

**Blocking at execution:** a GlitchTip read path (connector or UI) for D-15 (1) and (4).

## Validation Architecture

`workflow.nyquist_validation` is `true` (`.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.1.0 (unit, smoke, visual configs); Playwright container for visual baselines |
| Config file | `vitest.config.mjs`, `vitest.smoke.config.mjs`, `vitest.visual.config.mjs` |
| Quick run command | `npx vitest run src/__tests__/unit/_meta` |
| Full suite command | `npm run lint && npm run typecheck && npm run test:unit && npm run build` (CI order; stub env `POSTGRES_URL=… UPDATE_KEY=… UPDATE_INTERVAL=20` for build) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-01 | AGENTS.md names `WORKER_ENABLED`, the 60 s lease, standby answer, 2 replicas; merge line has no `--delete-branch` | grep guard | `grep -c WORKER_ENABLED AGENTS.md` ≥ 1; `grep -c -- '--delete-branch' AGENTS.md` = 0 | ✅ |
| DOCS-01 | 4 comments fixed, 403 guard kept | grep + unit | `grep -n '~15s' src/app/api/h1/update/route.js` empty; `grep -n "errorResponse(403" src/app/api/h1/update/route.js` 1 hit; `npm run lint && npm run test:unit` | ✅ |
| DOCS-01 | Map lines fixed | grep | `grep -n 'dedicated 1-replica worker\|runs 3 app replicas\|must 403 rather' .planning/codebase/*.md` empty | ✅ |
| DOCS-02 | MDX compiles | build | `npm run build` (ESLint does not cover `.mdx`: `eslint.config.mjs` files glob is `**/*.{js,mjs,jsx}`) | ✅ |
| DOCS-02 | Stale strings gone | grep sweep | § Code Examples 3 (baselines 46 and 11) | ✅ command |
| DOCS-02 | Mermaid fences parse | script | `node scripts/check-mermaid-fences.mjs` exit 0 | ❌ Wave 0 |
| DOCS-02 | 5 rendered diagrams render | browser | § Code Examples 2, recorded in the PR | manual |
| DOCS-02 | Page-by-page match with code | review | Final check recorded in the phase verification (D-12) | manual |
| HOUSE-03 | Config change correct | grep | `grep -n productionBrowserSourceMaps next.config.mjs` empty; `grep -n deleteSourcemapsAfterUpload next.config.mjs` 1 hit | ✅ |
| HOUSE-03 | Upload ran on both legs | CI log | `gh run view <id> --log \| grep -c 'Successfully uploaded source maps to Sentry'` = 2 | after merge |
| HOUSE-03 | Maps gone from image | measurement | § HOUSE-03 export commands: `static` `.map` = 0, `server` = 48 | manual (Docker) |
| HOUSE-03 | Production `.map` 404 | probe | § HOUSE-03 D-15 (3) | after release 2 |
| HOUSE-03 | Symbolicated events | GlitchTip | D-15 (1) and (4) | manual |
| HOUSE-04 | #642 landed, #501 closed with the run recorded | `gh` | `gh pr view 642 --json state` = `MERGED`; `gh issue view 501 --json state,comments` | manual |
| HOUSE-04 | Staging seeds 161 | log | `[migrate] seed data changed, seeding` in the staging app log after the pin moves | manual |
| HOUSE-05 | Done | file | `test ! -e docs/roadmap.md` | ✅ |

### Sampling Rate
- **Per task commit:** the task's grep guard plus `npx vitest run src/__tests__/unit/_meta`
- **Per wave merge:** `npm run lint && npm run typecheck && npm run test:unit && npm run build`
- **Phase gate:** all four green, sweeps at 0, parse script exit 0, browser check recorded, D-15 numbers on #502

### Wave 0 Gaps
- [ ] `scripts/check-mermaid-fences.mjs` — covers DOCS-02 fence parse (D-23)
- [ ] Lane `npm ci` + `npx prisma generate` — typecheck, unit tests and build need the client
- [ ] Decision on the D-15 (1) event source (Open Question 1)

Existing checks to keep green: `src/__tests__/unit/_meta/mirrorTree.test.mjs` (fails if a new test is not at its mirrored path; this phase adds no test), `src/__tests__/unit/_meta/exampleEnv.test.mjs` (asserts no `POSTGRES_SSL=`; `.example.env` needs no edit), `src/__tests__/unit/app/docs/_diagram.test.mjs`. No test reads `AGENTS.md`, `next.config.mjs` or `CHANGELOG.md` (grep of `src/__tests__` found no match).

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"` (`.planning/config.json:47-49`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth code changes |
| V3 Session Management | no | WR-08 is filed, not fixed |
| V4 Access Control | no | — |
| V5 Input Validation | no | no new input; the synthetic probe event (option a) is a one-off |
| V6 Cryptography | no | — |
| V8 Data Protection | yes (minor) | Sourcemaps leave the image; the repo is public, so exposure is "accepted, not a concern" (#502 body). The change is about image weight. |
| V14 Configuration | yes | Sentry credentials stay BuildKit secrets (`Dockerfile.app:94-97` `--mount=type=secret`), never build args; no token, no DSN key and no private host in issues or public docs |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret or private topology pasted into an issue or `/docs` page | Information disclosure | Names only (`SENTRY_AUTH_TOKEN`); describe roles and replica counts (D-06) |
| Upload failure leaves an image with no maps and no stored bundle | Repudiation (loss of diagnostics) | Gate on the per-leg log line, then prove with an event |
| Bot PR merges with no CI | Tampering | The ruleset now blocks it (3 required checks); the fix for approval friction is a later phase |
| Synthetic event pollutes the production error project | Tampering (data quality) | Tag `environment: staging-probe`, ask Andrei first, resolve the issue afterwards |
| Third-party scripts in probes | — | Run probes with `/usr/bin/curl` and local files only; extracted image data is untrusted, read it, never execute it |

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` is AGENTS.md. Directives that bind this phase:
- Shared standards are in the developer handbook; AGENTS.md holds repo facts only. Do not restore removed sections (`AGENTS.md:7-9`).
- Verification gate, in CI order: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`. Run `lint:fix` before committing, not during development. Env vars: only `POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL` are required.
- Branches: `develop` ruleset requires a PR with `Test & Build`, `Visual Regression`, `Review Dependencies`; only `rebase` merges. A release PR `develop` → `main` uses a merge commit and a `vX.Y.Z` tag. No merge-back (#621).
- Version cut (#618): work PRs raise no version; notes go under `## Unreleased`. `Check: Version Bump` runs only on PRs into `main`.
- `metrics` is a CI-owned branch: never merge or delete it.
- Use `tryCatch` (no bare try/catch), `errorResponse`/`successResponse`, Zod before DB writes, Umami attributes on interactive elements. This phase edits comments and MDX only.
- Unit tests mirror the source tree (`mirrorTree.test.mjs`); `@/*` maps to `./src/*`.
- Read `node_modules/next/dist/docs/` before writing Next code (this phase touches only `next.config.mjs` options and MDX).
- Migrations apply on start under an advisory lock; after merging a branch that adds a migration, restart the dev server.
- Never hand-edit `.claude/CLAUDE.md` (generated, gitignored).
- Project skills in `.agents/skills/` (accessibility, next-best-practices, prisma-*, vitest, zod, and others) do not change this phase's approach.

## Sources

### Primary (HIGH confidence) — opened or run this session
- Worktree files: `AGENTS.md`, `next.config.mjs`, `Dockerfile.app`, `mdx-components.jsx`, `.example.env`, `prisma/schema.prisma`, `prisma.config.mjs`, `src/update/{lease,season,status,migrateOnStart}.mjs`, `src/app/api/h1/update/route.js`, `src/app/api/glitchtip/route.js`, `src/instrumentation*.js`, `src/shared/utils/initializeWorker.mjs`, `public/workers/{cron,cronLogic}.js`, `deploy/{staging,production}/compose.yaml`, `deploy/README.md`, all 11 `.github/workflows/*.yml`, in-scope docs pages and `.mjs` configs, `.planning/{codebase,architecture,...}`
- `gh`: rulesets/24004681, rules/branches/develop, PR #642 and #531, issues #501 #502 #624 #629 #631 #621, actions runs 42603804822 (and the 3 siblings), 35578183114, 41832856848 (log), 42603725952, workflow run list, repo merge settings, variable and secret names
- GHCR: `ghcr.io/elfensky/helldiversbot:v0.97.2`, amd64 and arm64, pulled, exported and measured (images removed afterwards)
- `npm pack @sentry/nextjs@11.10.0` and `@sentry/bundler-plugins@11.10.0` (scratch folder `/tmp/sentry-src`)
- GlitchTip backend source, GitLab `glitchtip/glitchtip-backend`, tag `v6.2.6` and `master`: `apps/event_ingest/{process_event,javascript_event_processor}.py`, `apps/files/{assemble,api}.py`, `apps/sourcecode/{models,api}.py`
- `GET https://glitchtip.lav.ren/api/settings/` (public) → version 6.2.6
- Local `mermaid.parse` run, mermaid 12.3.0 + jsdom 30.1.3 (scratch folder `/tmp/mm`)

### Secondary (MEDIUM confidence)
- [GITHUB_TOKEN concepts, GitHub Docs](https://docs.github.com/en/actions/concepts/security/github_token) · [archived 2026-11-14](https://linkding.lav.ren/bookmarks?details=2239)
- [Approve a workflow run for a fork pull request, REST docs](https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#approve-a-workflow-run-for-a-fork-pull-request) · [archived 2026-11-14](https://linkding.lav.ren/bookmarks?details=6371)
- [Approving workflow runs from forks, GitHub Docs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks) · [archived 2026-11-14](https://linkding.lav.ren/bookmarks?details=6372)
- [GlitchTip 4.2 release notes](https://glitchtip.com/blog/2024-11-01-glitchtip-4-2-release/) · [archived 2026-11-14](https://linkding.lav.ren/bookmarks?details=6374)
- [GlitchTip CLI docs](https://glitchtip.com/documentation/cli/) · [archived 2026-11-14](https://linkding.lav.ren/bookmarks?details=6375)

### Tertiary (LOW confidence, user reports)
- [GitHub community discussion 199292](https://github.com/orgs/community/discussions/199292) · [archived 2026-11-14](https://linkding.lav.ren/bookmarks?details=6370)
- [jv3n/trade issue 568](https://github.com/jv3n/trade/issues/568) · [archived 2026-11-14](https://linkding.lav.ren/bookmarks?details=6377)

## Metadata

**Confidence breakdown:**
- In-repo line refs and values: HIGH. Each was opened and quoted this session.
- Sentry 11.10.0 upload and delete path: HIGH. Read from the packed sources; matches the lockfile.
- GlitchTip resolution of two-leg debug-ID bundles: MEDIUM. The server code at the deployed tag was read and the shipped IDs were compared; no live event or bundle list was read.
- Approval satisfies the ruleset: MEDIUM. Docs plus ruleset state; not executed.
- D-15 (4) event timing: LOW. Depends on natural traffic.

**Research date:** 2026-11-14
**Valid until:** 2026-11-21 for line numbers (develop moves; re-run the sweeps before editing). GlitchTip facts hold until its version changes (re-read `/api/settings/`). The #642 facts hold until the Monday 2026-11-16 run.
