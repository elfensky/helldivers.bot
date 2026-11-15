---
gsd_state_version: "1.0"
milestone: M8
milestone_name: The site is documented, tested and findable
current_phase: 02
current_phase_name: Docs Accuracy & Operational Housekeeping
status: executing
stopped_at: Completed 02-25-PLAN.md
last_updated: "2026-11-15T20:23:34.726Z"
last_activity: 2026-11-15
last_activity_desc: "Plan 02-25 executed: /docs/infrastructure overview fence routes the worker through the update route, page re-checked and corrected (lane docs/02-gap-closure at cb68f18f)"
state_head: 5e36557f80a88335520dde014f185dddd9ed0110
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 24
  completed_plans: 20
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-09)

**Core value:** The live dashboard and API are stable and correct — the poller never loses data across season transitions or replica handovers, and production error volume stays at zero known classes.
**Current focus:** Phase 02 — Docs Accuracy & Operational Housekeeping

## Current Position

Phase: 02 (Docs Accuracy & Operational Housekeeping) — EXECUTING
Plan: 20 of 24 summarized (02-01 superseded); gap-closure edit plans 02-16, 02-17, 02-23, 02-24, 02-18 and 02-25 done on lane `docs/02-gap-closure` (head cb68f18f); 02-19 follows
Status: Executing gap closure — `02-VERIFICATION.md` found gaps (4/5, DOCS-02 partial); the docs fixes ship in patch release 0.99.1 (D-33)
Last activity: 2026-11-15 — plan 02-25 executed (overview fence fixed, /docs/infrastructure re-checked, CHECKED re-issued)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Plans completed in M8: 1 (02-03, done outside execute-phase, no timing)
- M7's metrics moved to `milestones/M7-ROADMAP.md` at its close

**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P13 | 20 min | 2 tasks | 4 files |
| Phase 02 P04 | 58 min | 3 tasks | 1 files |
| Phase 02 P14 | 21 min | 2 tasks | 3 files |
| Phase 02 P10 | 14 min | 3 tasks | 6 files |
| Phase 02 P02 | 9 min | 3 tasks | 11 files |
| Phase 02 P05 | 15 min | 3 tasks | 12 files |
| Phase 02 P06 | 9 min | 3 tasks | 4 files |
| Phase 02 P15 | 5 min | 3 tasks | 1 files |
| Phase 02 P07 | 10 min | 3 tasks | 4 files |
| Phase 02 P08 | 45 min | 3 tasks | 2 files |
| Phase 02 P09 | n/a (paused at checkpoint) | 3 tasks | 1 files |
| Phase 02 P11 | 50 min | 3 tasks | 3 files |
| Phase 02 P12 | 5 min | 3 tasks | 2 files |
| Phase 02 P16 | 8 min | 3 tasks | 7 files |
| Phase 02 P17 | 6 min | 2 tasks | 6 files |
| Phase 02 P23 | 7 min | 2 tasks | 7 files |
| Phase 02 P24 | 7 min | 2 tasks | 2 files |
| Phase 02 P18 | 12 min | 2 tasks | 4 files |
| Phase 02 P25 | 17 min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: HOUSE-01 (test co-location) is a standalone Phase 3 that must land before any phase adding tests (5, 7, 8, 9, 10, 11, 12, 13, 15, 17)
- Roadmap: SEO & Analytics Foundation (Phase 5) is inserted right after Test Co-location and Dependency Cleanup, before every feature track — ranking compounds with time. It absorbs HOUSE-02's Rich Results/Schema.org/Search Console checks into SEO-05, and depends on STAB-02's OG fallback (M7) and Phase 3 (tests)
- Roadmap: LOAD-01/02/03 (catalogs + hash codec) is a standalone Phase 7 — the milestone's one-way door — before any Loadout UI
- Roadmap: New public pages shipped by Loadout Builder Core (Phase 8) and Archive Analytics (Phases 11, 12) register in the sitemap/llms.txt/metadata registry per the SEO-02/04 convention established in Phase 5
- Roadmap: SSE (Phase 17) is spike-gated and scheduled after staging (Phase 16) so it can test against real multi-replica topology; "don't implement" is a valid outcome
- Roadmap: Final Documentation Pass (Phase 18) also runs SEO-07's recurring Search Console review; findings become GitHub issues rather than inline fixes
- [Phase 02]: docs/roadmap.md deleted, not a pointer (supersedes D-19/D-20): .planning/ROADMAP.md is the one roadmap file; live items carried into ROADMAP.md § Carried over; plan 02-03 done outside execute-phase (2026-11-02)
- [Phase 02]: Release 1 is v0.98.1 (patch cut): live in production 2026-11-15; the D-15 (3) map probe takes the URL from the chunk's sourceMappingURL comment, not <chunk>.js.map
- [Phase 02]: 02-04: #642 runs were started by a push from a user account; no approval needed. Staging seed evidence read through Arcane in Andrei's session. Gaps issue is #658.
- [Phase 02]: 02-10: sourcemap strip merged (PR #660, S=ca7e661c); staging build uploaded in both legs; image Verdict STRIPPED; D-32 issue #661
- [Phase 02]: 02-02: both page-check sections cite the map lane commit, because the check diffs all covered files from the cited commit
- [Phase 02]: 02-05: PR #665 merged; five diagrams rendered in Chrome 157 under mermaid 12.3.0 (Verdict RENDERED); DOCS-03 drift on notifications diagrams (POST label) left unchanged by D-07
- [Phase 02]: 02-06: the page documents X-Worker-Startup as sent but not acted on by the update route (nothing in src/ reads it); the fence check uses only installed jsdom and mermaid
- [Phase 02]: 02-07: api_rate_limit gets its own section 8 on /docs/database; the testing page keeps no mermaid fence (layout stated as one rule)
- [Phase 02]: 02-08: the infrastructure page cites no CI compose file name (the retired-name gate regex matches it); observed timings (release ~10 min, staging roll 5-6 min) are stated as observed
- [Phase 02]: 02-09: one deliberate real staging browser error was allowed as a one-time exception to D-30 (Andrei, 2026-11-15); HELLDIVERSBOT-7D symbolicated, Verdict: SYMBOLICATED, strip may enter release 2
- [Phase 02]: Release 2 route strip (Andrei, 2026-11-15); release 0.99.0 also carries #671 and #677 by Andrei's decision
- [Phase 02]: 02-12: #502 closed on four passing D-15 steps (staging symbolication, image strip, production map 404, production event resolved to src/)
- [Phase 02]: 02-16: the architecture PWA caching clause names exactly the Serwist 9.5.13 strategy classes with one sentence each; the Notifications link carries no fragment
- [Phase 02]: 02-16: h1_event_progress is written by the poller and read only by scripts/analysis; the architecture diagram no longer draws it into the archives
- [Phase 02]: 02-17: the notifications page makes no claim about service-worker registration (no register option or registration call in the repo); open question for plan 02-19's browser check
- [Phase 02]: 02-23: the fence check discovers every docs page.mdx (14 fences in 16 files); IN-04 found no bad flows entry, and three declared nodes have no details panel (intro_order, points_max, computeMapState); jsconfig.json maps @test-utils to a missing file (reported, left)
- [Phase 02]: 02-24: /docs/data-flow re-check found no D-08 drift; ten wording and excerpt fixes landed in one lane commit (1894d747), CHECKED re-issued at that commit
- [Phase 02]: 02-18: a skipped Sentry upload (empty project, empty org or zero maps) passes the build and ships without uploaded maps; /docs/infrastructure says so and issue #686 tracks the CI guard; /docs/database re-check fixed nine statements in lane commit 4ac3350c
- [Phase 02]: 02-25: CI secret ids and the Umami host are described by role on /docs/infrastructure (D-06); the plan 02-08 row that said none were present was wrong

### Pending Todos

None yet.

### Blockers/Concerns

- HOUSE-03 (sourcemap stripping): v0.95.2 uploaded sourcemaps and GlitchTip symbolicates 0.95.2 events (turbopack frames resolve to source paths in the recount), so #502 can proceed in Phase 2
- [M7] Production `/opengraph-image` serves the static fallback on every request (sharp rejection on x64 production, not reproduced on arm64) — #503
- [M7] Hydration #418 still fires on `/` for real browsers on 0.95.2 — #496, #526
- [M7] Code review WR-01..11 recorded open in `milestones/M7-phases/01-stability-fixes-release/01-REVIEW-DISPOSITION.md`; WR-08 (shared-cache HTML with session-dependent admin widget) and WR-07 (unconditional Umami proxy rewrite) deserve Phase 2 triage first
- SITE-03 and ARCH-08 touch the same narrative/vernacular copy — Phase 14 depends on Phase 12 so the second track consumes the first's vocabulary source instead of forking it
- ICE-06/ICE-07 and STAGE-01..04 are gated on external factors (official API behavior, TLS pinning, homelab hardware) — not schedulable by effort alone

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260829-219 | Wire SENTRY_DSN into the staging Swarm stack so staging reports to GlitchTip (its commits 22030b72 and d8323eef never reached `develop`; plan 02-14 does it, D-30) | 2026-08-29 | d8323eef | [260829-219-wire-sentry-dsn-into-the-staging-swarm-s](./quick/260829-219-wire-sentry-dsn-into-the-staging-swarm-s/) |
| 261013-hu0 | Finish PR 532 (Umami replay) and prepare the repo for GSD | 2026-10-13 | 6a41c266 | [261013-hu0-finish-pr-532-umami-replay-and-prepare-t](./quick/261013-hu0-finish-pr-532-umami-replay-and-prepare-t/) |
| 261013-luq | Fix review findings WR-01..06 from 261013-hu0-REVIEW.md | 2026-10-13 | 91f9d470 | [261013-luq-fix-review-findings-wr-01-06-from-261013](./quick/261013-luq-fix-review-findings-wr-01-06-from-261013/) |
| 261020-tlt | Resolve all open Dependabot security alerts with a targeted dependency bump | 2026-10-20 | 4ad6fb84 | [261020-tlt-resolve-all-open-dependabot-security-ale](./quick/261020-tlt-resolve-all-open-dependabot-security-ale/) |
| 5 | Bump follow-redirects to 1.16.1 to close Dependabot alerts 212 and 213 | 2026-10-20 | 57a55b44 | — |
| 261020-wsk | Land Dependabot PR #554: cap prisma effect override at 3.x, Playwright image 1.64.1, better-auth 1.7 unlink fix, Dependabot ignores for @types/node and typescript majors | 2026-10-20 | c0bb75ba | [261020-wsk-land-dependabot-pr-554-cap-prisma-effect](./quick/261020-wsk-land-dependabot-pr-554-cap-prisma-effect/) |
| 261021-epu | Fold Dependabot PRs #556-#564: vitest 5 (grouped), Sentry 11 with v10 data-collection scope, mermaid 12, dotenv 18, eslint-plugin-jsdoc 65, @types/node 24.19 | 2026-10-21 | a11def5f | [261021-epu-fold-dependabot-prs-556-564-vitest-5-sen](./quick/261021-epu-fold-dependabot-prs-556-564-vitest-5-sen/) |
| 261025-2yd | Staging robots.txt fails closed: Disallow all unless NEXT_PUBLIC_DEPLOY_ENV is production | 2026-10-25 | 2a0d52cd | [261025-2yd-staging-robots-txt-fails-closed-disallow](./quick/261025-2yd-staging-robots-txt-fails-closed-disallow/) |
| 261025-tlm | Close Dependabot alert #214: root zod override, drop eslint-plugin-react-compiler | 2026-10-25 | 66122625 | [261025-tlm-close-dependabot-alert-214-zod-override-](./quick/261025-tlm-close-dependabot-alert-214-zod-override-/) |
| 261025-uz2 | Release app image builds arm64 natively: per-arch legs plus merge-app in build-release.yml | 2026-10-25 | db35a4af | [261025-uz2-release-app-image-builds-arm64-natively-](./quick/261025-uz2-release-app-image-builds-arm64-natively-/) |
| 261025-vze | Admin System Overview: all replicas with poller highlight, API key last used, grouped layout (#596) | 2026-10-25 | f535b865 | [261025-vze-admin-system-overview-all-replicas-with-](./quick/261025-vze-admin-system-overview-all-replicas-with-/) |
| 261026-1vk | Swarm stacks migrate on start: app applies Prisma migrations and seed under an advisory lock (#599) | 2026-10-26 | 73cd6159 | [261026-1vk-swarm-stacks-migrate-on-start-app-applie](./quick/261026-1vk-swarm-stacks-migrate-on-start-app-applie/) |
| 13 | Resolve PR #600 review findings 1 and 2: child time limit, lost lock session kills the child | 2026-10-26 | a74d6639 | — |

### Roadmap Evolution

- 2026-11-09: the roadmap is split into milestones M1–M12. `milestone complete` archived M7 (Phases 1, 1.1); M1–M6 record the work before GSD; M8 (Phases 2–6) is current and M9–M12 are planned

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-15T20:23:34.696Z
Stopped at: Completed 02-25-PLAN.md
Resume file: None

## Operator Next Steps

- Run `/gsd-execute-phase 2`. Plans 02-13 (release 1) and 02-04 (#642) must finish before 2026-11-16 03:00 UTC (D-31)
- Plan 02-09 is done. Plan 02-11 cuts release 2 with the strip (the proof file holds `Verdict: SYMBOLICATED`); it also needs Andrei's release-route decision at its Task 1
