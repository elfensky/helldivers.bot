# helldivers.bot

## What This Is

A Next.js 16 app that caches the official Helldivers 1 API, stores the full historic war record (160 seasons) in a normalized Postgres schema, and gives HD1 players a live dashboard, archives, notifications, and a public API to augment their game. It doubles as a portfolio piece demonstrating DB design, hosting, Docker Swarm/multi-replica deployment, CI/CD, and networking — so the public `/docs` pages and the repo must describe the system as it actually is.

## Core Value

The live dashboard and API are **stable and correct** — the poller never loses data across season transitions or replica handovers, and production error volume stays at zero known classes.

## Requirements

### Validated

<!-- Inferred from the codebase map (.planning/codebase/) — shipped and relied on. -->

- ✓ Poll the official HD1 API (`get_campaign_status` + `get_snapshots`) every ~15s, Zod-validate, bucket-upsert into `h1_season`/`h1_status`/`h1_statistic`/`h1_event`/`h1_event_progress` — existing
- ✓ Postgres-backed poller lease (`worker_heartbeat`) so N app replicas coordinate exactly-one poller with state handover (`prevEvents`, `lastSeasonObserved`) — v0.93.0
- ✓ Season-transition closing pass captures the outgoing season's delayed final snapshot — existing
- ✓ Live dashboard (`useLiveData` 10s polling, galaxy map via `computeLiveMap`, stat grid, event cards, timeline) — existing
- ✓ Archives with on-demand season backfill (`updateSeason`) and war narrative — existing
- ✓ Public versioned API `/api/v1/h1/{map,season,stats,status}` with API keys + rate limiting + OpenAPI — v0.59.0
- ✓ Legacy wire-format rebroadcast API reconstructed from normalized tables — existing
- ✓ Web push + toast notifications on event transitions, BroadcastChannel leader election, PWA (Serwist) — existing
- ✓ Optional BetterAuth (Discord/GitHub), Umami analytics, Sentry→GlitchTip error tracking — existing
- ✓ Docker images (`Dockerfile.app`, `Dockerfile.migrate`) on GHCR; staging compose in `deploy/staging/` with scaled web tier + dedicated worker; CI gates (lint/typecheck/unit/build/docker-smoke/CodeQL), release build verifies the tagged commit — v0.90.14–v0.93.1
- ✓ Test suite: ~190 Vitest unit tests in a mirrored tree, smoke tests, visual regression baselines — existing
- ✓ Public `/docs` site (architecture, database, data-flow, infrastructure, api, testing, notifications, authentication, hd1-api, predict, brandkit…) — existing

### Active

<!-- Everything open on GitHub gets explored, tested, and either implemented+released or closed with a written reason. -->

- [ ] **Stability first:** drain Engineering Health bugs — #496 hydration mismatch (largest prod error class), #503 OG image 500s, #485 notification toggle stuck loading, #476 Space Mono, #459 null-slot crash — verified against GlitchTip after release, not just locally
- [ ] Release cadence honored: `develop` (0.93.1) is already >5 versions ahead of `main` (v0.90.14) — release early in the plan and keep the gap ≤5 versions thereafter
- [ ] Dependency posture: 7 open Dependabot alerts (1 high `nanoid`, `mermaid` ×5, `dompurify`) cleared; 5 open Dependabot PRs resolved (two currently failing CI: #515 minor/patch group, #511 TypeScript 6→7)
- [ ] **Steady state = Dependabot auto-merge:** minor/patch groups auto-merge when CI is green; majors stay manual. Requires repo `allow_auto_merge`, a branch ruleset on `develop` requiring the CI checks, and a workflow that enables auto-merge on Dependabot PRs — must respect the `--no-ff` + version-bump/CHANGELOG-on-merge rule (or explicitly exempt deps PRs and record why)
- [ ] **SEO — rank highly for Helldivers 1 queries:** llms.txt, registry-driven sitemap/robots via the Metadata API, `createPageMetadata` helper, typed JSON-LD (WebSite/WebApplication/VideoGame/BreadcrumbList/FAQPage/Dataset/Event) validated in Rich Results, keyword-to-page map with server-rendered copy, indexable per-season archive URLs, Google Search Console wired in (verification, sitemap, API/MCP access, recurring review → issues), Lighthouse SEO ≥ 95 — patterns copied from `../euraikaweb`
- [ ] **Umami fully wired** (umami.drunik.be): runtime env present in prod + staging, tracker via `/stats.js` proxy verified end-to-end, `identify()` on login, server-side `umamiTrackEvent` on every public API route (currently none), `data-umami-event` coverage enforced by lint/test
- [ ] Docs kept accurate: CLAUDE.md § Architecture and the public `/docs` pages (`src/app/docs/**`, esp. `architecture`, `data-flow`, `infrastructure`, `database`) rewritten to describe the lease/`worker_heartbeat` model, multi-replica web tier, and current CI/CD — the codebase map found concrete drift
- [ ] Housekeeping (Track A): #466 co-locate unit tests (do before feature work adds more test files), #469 archives map hides un-introduced factions, #389 post-deploy SEO verification, #502 stop shipping sourcemaps once symbolication is proven, #501 verify seed-refresh workflow at season 160's end
- [ ] Accessibility & Design Polish (milestone #10): #42 WCAG design tokens → #148 ARIA patterns (FactionTabs, BottomNav, Alerts, Map) → #124 design polish (scope first)
- [ ] Loadout Builder (milestone #19, 13 issues, umbrella #162): static catalogs #339/#340 → hash codec #341 (must hold 4 loadouts from day one) → page #342 → stats #343, guides #344, favorites #345/#346, nav+OG #347/#348 → a11y pass #349 → squad mode #350 (committed)
- [ ] Archive Analytics (milestone #16): spec refresh of #179/#180/#270 against the real schema first; then Core Analytics #179 → Storytelling #180 → War Playback #270; independents #453, #462, #269, #247. Build all, hide when empty (telemetry covers 4/160 seasons)
- [ ] Site Features & Easter Eggs (milestone #18): #238 admin custom notifications, #392 Ministry of Truth, #471 faction vernacular (shares vocabulary with #453), #27 user dashboard improvements (scope first)
- [ ] Staging on the Pi swarm (#474): hardware is up and reachable — finish the deploy job, stack file, Kuma banner, secrets, Cloudflare Tunnel; validate end-to-end from a `develop` push
- [ ] SSE rewrite (#298): throwaway spike answering the four questions in `docs/roadmap.md` § Track F; implement only if the spike says yes, otherwise close with the findings — last of all tracks
- [ ] Icebox (milestone #12, 11 shelved issues incl. #444): each one explored and decided — implemented if it earns its place, otherwise closed with a written reason on the issue. No issue is left in limbo
- [ ] `docs/roadmap.md` reconciled or retired in favour of `.planning/` so there is one source of truth for execution order

### Out of Scope

- Forcing a verdict on data-gated prediction issues #481/#484/#487/#477 — blocked on the game reaching ~S165–S172+; they stay **open and parked** in Engineering Health by decision, and "done" tolerates exactly these four
- `npm audit fix --force` for the `deepmerge-ts` chain — it would downgrade Prisma 7 → 6.12; wait for an upstream non-breaking fix via Dependabot
- Closing milestone #17 Engineering Health — it is a permanent catch-all by decision, never closed at 0 open issues
- New player-facing features not already tracked as GitHub issues — the backlog is the scope; new ideas get an issue first
- Squash/rebase/fast-forward merges anywhere — CLAUDE.md § Git Workflow is a hard rule, and auto-merge must be designed around it, not through it

## Context

- **Brownfield, mature.** ~0.93.1 on `develop`, v0.90.14 on `main`, 160 seasons of data, production at helldivers.bot behind a reverse proxy + CrowdSec, monitored by GlitchTip (MCP available in-session) and Umami.
- **Codebase map:** `.planning/codebase/` (7 docs, 2026-08-28). Key findings: no file over 500 LOC by a wide margin, no function over 100 lines; documented architecture drifted after #517 (lease model); `NotificationToggle` has an unguarded `'loading'` terminal state (#485); `opengraph-image.jsx` has no automated render coverage for edge-case map states (#503).
- **Execution order doc:** `docs/roadmap.md` (last reconciled 2026-08-07) — its session slicing and prep ladder (none / plan / brainstorm / spec-refresh) are worth carrying into GSD phases. Stale items: "Dependabot is clear" (now 7 alerts), #495/#497 closed, #506/#516/#517 landed unplanned.
- **Prediction work** has a living handoff at `docs/superpowers/predictions-handoff.md` — read before touching anything prediction-related.
- **Project rules that constrain every phase:** CLAUDE.md — KISS, never commit to `main`/`develop` directly, worktrees for features, `--no-ff` merges with version bump + CHANGELOG move in the merge commit, all four checks (`lint`, `typecheck`, `test:unit`, `build`) green before merge, mirrored test tree enforced by `_meta/mirrorTree.test.mjs`, Umami tracking on every interactive element, DevTools verification for CSS changes.
- **Parallel sessions share the main checkout** — branches move underneath; prefer worktrees and check the branch before committing.

## Constraints

- **Tech stack**: Next.js 16 App Router, React 19 + Compiler, Prisma 7 + `@prisma/adapter-pg`, Tailwind v4 tokens, Vitest 4, Node 24 (mise) — locked; read `node_modules/next/dist/docs/` before writing Next code, the version has breaking changes
- **Process**: GitHub Issues are the source of truth for *what*; every finished issue is closed with an implementation comment; every merge to `develop` bumps version + moves CHANGELOG
- **Release**: production deploys only on `vX.Y.Z` tags on `main`; forgetting the tag means no deploy; merge `main` back into `develop` after each release
- **Data**: telemetry (`h1_statistic`) exists for seasons 157+ only — telemetry-backed UI hides when empty rather than rendering zeros; two-season comparisons drop rows with mixed coverage
- **Browser floor**: `browserslist` in `package.json` (Firefox ≥115, Chrome ≥109, Safari ≥15.6) — enforced by `eslint-plugin-compat`; `Map.groupBy`/`Object.groupBy` are lint errors
- **Security**: never `npm audit fix --force`; sourcemaps leave the image only once GlitchTip symbolication is proven (#502)
- **Infra**: staging = Raspberry Pi Docker Swarm (arm64, multi-arch images already built) with a self-hosted runner; production topology has a reverse proxy + CrowdSec + idle timeouts that any SSE design must survive

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stability before features or portfolio polish | Largest prod error class (#496) and a 500ing OG route undermine both goals; fixing them first also unblocks trustworthy verification of everything after | — Pending |
| Every open issue reaches a terminal state (shipped or closed-with-reason), Icebox included | "Done" means an empty limbo, not an empty backlog — parked issues need a written gate, shelved ones a written verdict | — Pending |
| Data-gated predictions (#481/#484/#487/#477) stay open and parked | The gate is season count, not effort; closing would hide real future work | — Pending |
| Dependabot auto-merge for minor/patch, manual for majors | Matches the desired "just update deps every so often" steady state; majors (e.g. TypeScript 7) need a human | — Pending |
| Release `develop` early — gap is already >5 versions | Roadmap's own cadence rule; smaller releases make GlitchTip re-counts attributable | — Pending |
| Keep `/docs` + CLAUDE.md as the portfolio showcase (no new "how it's built" page) | Accurate docs already exist and are public; drift is the problem, not absence | — Pending |
| Hash codec (#341) designed for squad mode from day one | Shared URLs cannot be migrated; a second format later would break every link in the wild | — Pending |
| SSE (#298) is spike-gated and last | Highest blast radius on the board against polling that works; "don't do it" is a valid spike outcome | — Pending |
| SEO is a first-class track, sequenced right after stability + housekeeping | Ranking compounds with time; every later feature page inherits the registry-driven sitemap/metadata/llms.txt so SEO can't drift again | — Pending |
| Roadmap execution order lives in `.planning/` from now on | Two "when" documents drift (docs/roadmap.md already has); one wins | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-29 after adding the SEO & Analytics track*
