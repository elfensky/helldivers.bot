# AGENTS.md — helldivers.bot

Next.js 16 app that caches the official Helldivers 1 API, stores the full historic war record in
Postgres, and serves a live dashboard, archives, notifications and a public API. Production:
helldivers.bot on the Hetzner swarm; staging: staging.helldivers.bot on the Pi swarm.

Shared standards: the developer handbook, `~/vault/knowledge/developer/developer.md`. This file
holds only what is true of this repo. Personal project: commits as `andrei@lav.ren`, `gh` user
`elfensky` (identity per project: `~/vault/meta/registry.md`).

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router, React 19 (+ React Compiler, experimental) | Plain JavaScript + JSDoc, `jsconfig.json` checkJs strict. Read `node_modules/next/dist/docs/` before writing Next code — this version has breaking changes |
| Data | Postgres + Prisma 7 with `@prisma/adapter-pg` | Run `npx prisma generate` after `npm ci`; the client output is gitignored |
| Styling | Tailwind v4 | Design tokens in the `@theme` block of `src/app/layout.css`; border radius is 0 everywhere |
| Tests | Vitest 5 (unit, smoke), Playwright container for visual baselines | See Commands |
| Runtime | Node 26 via `mise.toml` | |
| Deploy | Docker images on GHCR | Staging builds automatically from `develop` (`build-staging.yml`); production builds on a `v*.*.*` tag on `main` (`build-release.yml`); stacks in `deploy/` applied by Arcane Git Sync |

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on :3000. Applies pending Prisma migrations (and the seed when its inputs changed) before it serves — start it before human verification |
| `npm run lint` / `npm run lint:fix` | ESLint 10 (flat config) with Prettier wired in; run `lint:fix` before committing, not during development |
| `npm run typecheck` | `tsc --noEmit` over `jsconfig.json`; tests are out of scope here |
| `npm run test:unit` | Vitest single run |
| `npm run build` | `next build && serwist build` |
| `npm run test:smoke` | fetch-based smoke tests against a running server (:3000 or `TEST_SERVER_URL`); fails if none is reachable |
| `npm run test:visual` | Visual regression inside the Playwright Docker image (`scripts/visual-tests.sh`); baselines are committed |

**Verification gate** — run these four in CI's order before calling work done: `npm run lint`,
`npm run typecheck`, `npm run test:unit`, `npm run build`. That is the same sequence as the `verify`
composite action in `.github/actions/verify/`. Env vars are documented in `.example.env`; only
`POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL` are required.

## Branches

`develop` integrates, `main` releases on a `v*.*.*` tag push (the tag triggers the production build).
The `develop` ruleset requires a PR with checks `Test & Build`, `Visual Regression`,
`Review Dependencies` and allows only the `rebase` merge method. Merge work PRs with
`gh pr merge --rebase --delete-branch`. A release PR `develop` → `main` uses a merge commit and gets
tagged `vX.Y.Z`. There is no merge-back (#621): `main` does not require an up-to-date branch, so the
next release PR merges without `main`'s merge commit on `develop`. A fix made directly on `main`
reaches `develop` through its own PR.

## This repo's own rules

- **The version cut** (#618): work PRs into `develop` raise no version; their notes go under
  `## Unreleased`. The release PR's head is `develop`, so the cut lands first as its own PR into
  `develop` (the `"version"` bump plus the move of the notes into `## X.Y.Z`), then the release PR
  follows. `Check: Version Bump` runs only on PRs into `main`. Staging images carry
  `<version>-dev.<sha7>` (`APP_VERSION` build arg, `build-staging.yml`), so the stale-tab reload,
  `deploymentId` and the GlitchTip release still change on every staging build.
- **`metrics` is a CI-owned standalone branch** — never merge it to or from `develop`/`main`, never
  delete it as stale.
- Use the `tryCatch` wrapper (`src/shared/utils/tryCatch.mjs`); no bare try/catch blocks.
- API routes answer via `errorResponse`/`successResponse` (`src/shared/utils/api/responses.mjs`) and
  measure execution time with `roundedPerformanceTime` (`src/shared/utils/time.mjs`).
- All external/upstream data is validated with Zod schemas (`src/validators/`) before any database write.
- Every interactive element carries Umami tracking (`data-umami-event="category-action"`, or `useTrack()`
  for dynamic events); new external API routes also get a server-side `sendUmamiEvent()` inside `after()`.
- Unit tests mirror the source tree under `src/__tests__/unit/`, enforced by
  `src/__tests__/unit/_meta/mirrorTree.test.mjs`.
- `@/*` maps to `./src/*` (`jsconfig.json`).
- **Feature-folder layout** (exception to the handbook's Next.js layout, decided 2026-11-09, #635): a
  feature keeps its view and logic files together in `src/features/<feature>/`; modules that more than
  one feature uses live in `src/shared/`. Do not move them to `src/components/` or `src/lib/`.
- **One type declaration file** (exception to "no `.ts` files", decided 2026-11-09, #636):
  `src/types/global.d.ts` declares `window.umami` for the type checker, because JSDoc cannot extend the
  global `Window` type. It holds types only; add no runtime code and no other `.ts` file.
- Migrations apply on app start under a Postgres advisory lock; after merging a branch that adds a
  migration, restart the dev server and check the `[migrate]` log lines.

## Architecture invariants

- **Exactly one poller across replicas.** Every replica runs the worker (`public/workers/cron.js`, a
  `setTimeout` self-scheduling loop — never `setInterval`), but only the holder of the `worker_heartbeat`
  lease (`src/update/lease.mjs`) polls the HD1 API; handover state (`prevEvents`,
  `lastSeasonObserved`) lives in the lease row, not in module memory. Do not add in-process cron or
  module-level poller caches.
- **Normalized schema + bucket-upsert.** The h1 data lives in `h1_season`, `h1_status`, `h1_statistic`,
  `h1_event`, `h1_event_progress` (`prisma/schema.prisma`) — no raw-cache tables. Polls are grouped into
  `BUCKET_SIZE` time buckets and upserted by `season + enemy + bucket` (`src/shared/utils/bucketing.mjs`).
  The rebroadcast API reconstructs the wire format from these tables.
- **Live views only see active events.** `computeLiveMap` (`src/shared/utils/game/computeMapState.mjs`) is
  the single active-events filter, used by both `/api/h1/live` and `/api/v1/h1/map`; SSR/OG callers use
  `computeLiveMapState`. Lagged cross-season event slots must not leak into the current season
  (`queryUpsertEvent` skips `event.season !== season`).
- **All dates render in UTC** (`timeZone: 'UTC'` at every render-time consumer) — locale divergence on
  the client caused the #418/#496 hydration class.
- **Stale-version reload** has exactly three layers, all sharing `guardedReload()`
  (`src/shared/utils/reloadGuard.mjs`: localStorage circuit breaker, 30 s TTL, max 3 attempts). Never add
  an unguarded `location.reload()`.

## Docs

| Code path | Doc path | What drifts |
|---|---|---|
| `src/app/docs/` (public MDX site) | `.planning/codebase/` | Public docs must describe the lease/multi-replica model as it actually works |
| `src/update/`, `src/db/`, `prisma/schema.prisma` | `src/app/docs/architecture`, `src/app/docs/data-flow`, `src/app/docs/database` | Schema or pipeline changes must be reflected in the public docs |
| prediction/analysis work | `docs/superpowers/predictions-handoff.md` | Living handoff — read it first before any prediction work |
| `.planning/` | projects.static.lav.ren/helldivers-bot/ | The plan here is the source; the hosted page is a display copy |

## Life cockpit

Tracked in the life-cockpit vault under `#personal` (tracker: `elfensky/helldivers.bot`). The cockpit is the
control plane (what to work on); this repo is where the work happens. Report progress by
opening/closing issues and PRs as usual — the cockpit pulls from the tracker on its next
`/sync`. Nothing to update in the vault; don't mirror cockpit state (milestones, due dates) here.
GSD projects: after `/gsd-new-project`, run `/cockpit-gsd-profile` once in this repo before planning the first slice.
Roadmap: this repo owns its roadmap. `.planning/ROADMAP.md` (GSD) is the one roadmap file here; no second
roadmap file lives in this repo. Display: [projects.static.lav.ren/helldivers-bot/roadmap/](https://projects.static.lav.ren/helldivers-bot/roadmap/)
and `/helldivers-bot/architecture/` (one page per `.planning/architecture/` component), plain HTML in the vault's page-kit
look with its breadcrumb header. Republish only on request, through the `publish-page` skill and
`~/vault/knowledge/developer/stack/page-kit.md`, from the ordinary checkout at the live `develop` head. The renderer is local
to the Mac that published it (`.local/roadmap-page-kit/render-project-pages.mjs`, git-excluded). Every upload replaces the
whole folder: keep `roadmap/files/logo.webp` (from `public/images/logo.webp`; the projects list shows it too), the
`/helldivers-bot/` forward page and the four `phase-*` forwards from the retired vault milestone pages.
Milestones: GSD milestones are labelled M1, M2, … (`.planning/ROADMAP.md` § Milestones, decided 2026-11-09). GSD exempts
archived phases only in `milestones/v*-phases/`, so at a milestone close the `<details>` block lists its phases without
checkboxes, and the closed milestone's phase references move from STATE.md into its archive.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
