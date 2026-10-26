---
gsd_state_version: "1.0"
milestone: v0.96.2
current_phase: 02
current_phase_name: Docs Accuracy & Operational Housekeeping
status: executing
stopped_at: Phase 2 context refreshed (assumptions mode)
last_updated: "2026-10-26T12:17:30.921Z"
last_activity: 2026-10-26
last_activity_desc: Phase 01 complete, transitioned to Phase 2
state_head: a74d66396640b04f9063b79dc3dcdb37fd28cb18
progress:
  total_phases: 19
  completed_phases: 1
  total_plans: 21
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-21)

**Core value:** The live dashboard and API are stable and correct — the poller never loses data across season transitions or replica handovers, and production error volume stays at zero known classes.
**Current focus:** Phase 2 — Docs Accuracy & Operational Housekeeping

## Current Position

Phase: 02 (Docs Accuracy & Operational Housekeeping) — READY TO EXECUTE
Plan: Not started
Status: Ready to execute
Last activity: 2026-10-26 - Completed quick task 261026-1vk: Swarm stacks migrate on start: app applies Prisma migrations and seed under an advisory lock (#599)

Progress: [█░░░░░░░░░] 6%

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: N/A
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 9 | - | - |

**Recent Trend:**

- Last 5 plans: N/A
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 8min | 2 tasks | 3 files |
| Phase 01 P02 | 17min | 3 tasks | 3 files |
| Phase 01 P03 | 15min | 3 tasks | 6 files |
| Phase 01 P06 | 15min | 3 tasks | 3 files |
| Phase 01 P07 | 35min | 3 tasks | 3 files |
| Phase 01 P04 | 12min | 3 tasks | 2 files |
| Phase 01 P05 | 10min | 2 tasks | 1 files |
| Phase 01 P09 | 45min | 3 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Stability (Phase 1) ships and releases before any other phase, since every later phase re-renders the same dashboard tree
- Roadmap: HOUSE-01 (test co-location) is a standalone Phase 3 that must land before any phase adding tests (5, 7, 8, 9, 10, 11, 12, 13, 15, 17)
- Roadmap: SEO & Analytics Foundation (Phase 5) is inserted right after Test Co-location and Dependency Cleanup, before every feature track — ranking compounds with time. It absorbs HOUSE-02's Rich Results/Schema.org/Search Console checks into SEO-05, and depends on Phase 1 (STAB-02's OG fallback) and Phase 3 (tests)
- Roadmap: LOAD-01/02/03 (catalogs + hash codec) is a standalone Phase 7 — the milestone's one-way door — before any Loadout UI
- Roadmap: New public pages shipped by Loadout Builder Core (Phase 8) and Archive Analytics (Phases 11, 12) register in the sitemap/llms.txt/metadata registry per the SEO-02/04 convention established in Phase 5
- Roadmap: SSE (Phase 17) is spike-gated and scheduled after staging (Phase 16) so it can test against real multi-replica topology; "don't implement" is a valid outcome
- Roadmap: Final Documentation Pass (Phase 18) also runs SEO-07's recurring Search Console review; findings become GitHub issues rather than inline fixes
- [Phase 01]: Used optional chaining (f?.status) at both getWarOutcome .every call sites rather than an early bail — smaller diff, symmetric checks, closes STAB-05 at root cause
- [Phase 01]: STAB-01's timezone/date hydration mismatches on / are already resolved on develop; the sweep made zero source edits — All files_modified candidates were already correctly guarded (suppressHydrationWarning at every render-time consumer, or timeZone: 'UTC' already pinned, or provably a Server Component); verified via a validated real-browser Playwright harness across 4 timezones
- [Phase 01]: A real, out-of-scope hydration bug (UserSection.jsx auth-session race) was found and filed as issue #526 rather than fixed inline — Its correct fix is a mounted/hasHydrated gating boolean, explicitly prohibited by this plan's own acceptance criteria, and the bug is structurally different from the date/timezone taxonomy this plan targets
- [Phase 01]: next.config.mjs's catch-all Cache-Control header rule must exclude any route setting its own outcome-dependent Cache-Control — it silently overrides route-level headers in a production build, which is how the /opengraph-image no-store fallback fix was almost defeated
- [Phase 01]: [Phase 01]: NotificationToggle's stale-attempt guard uses a closure-scoped cancelled flag (set in effect cleanup) rather than a ref-based attempt-id counter — Promise.race already discards a timed-out attempt's late settlement, so the guard only needs to cover Retry-supersedes-previous-attempt and unmount
- [Phase 01]: [Phase 01]: subscribeToPush() returns a discriminated {error} result instead of throwing or silently no-op'ing, so enable() can tell 'no push support in this browser' (legitimate no-op) apart from 'VAPID key missing' (misconfiguration) — previously both returned undefined
- [Phase 01]: Kept Space Mono per D-17 and made it load for real via next/font, following the working variable-reference pattern rather than the bare-string pattern --font-display/--font-body still use (separate, out-of-scope bug, flagged for later)
- [Phase 01]: The project's vitest browser-mode visual-regression harness cannot execute next/font (runs under Vite, not Next's build pipeline) — switched the before/after measurement instrument to the real dev server via a temporary, non-committing file revert/restore
- [Phase 01]: [Phase 01]: getCampaign() audited (D-11) — no masking found; the OG route's own null-slot handling in factionStats/allDefeated was the real bug, fixed with the same f?.field pattern as getWarOutcome.mjs (STAB-05)
- [Phase 01]: [Phase 01]: OG route telemetry uses after() (not fire-and-forget) since opengraph-image is documented as a special Route Handler; no separate cache-hit event needed since the route only executes on a real invocation
- [Phase 01]: [Phase 01]: OG sharp rejection (#503) reproduction attempt: NOT REPRODUCED against a locally built linux/arm64 standalone image across three distinct real map states; two of three hypotheses ruled out by inspection, findings posted to #503 which stays open
- [Phase 01]: 01-09: all three STAB-06 classes RESIDUAL on release 0.95.2; #496/#503/#485 stay open; residual issues #565/#566/#567 filed

### Pending Todos

None yet.

### Blockers/Concerns

- HOUSE-03 (sourcemap stripping): v0.95.2 uploaded sourcemaps and GlitchTip symbolicates 0.95.2 events (turbopack frames resolve to source paths in the recount), so #502 can proceed in Phase 2
- [Phase 1] Production `/opengraph-image` serves the static fallback on every request (sharp rejection on x64 production, not reproduced on arm64) — #503
- [Phase 1] Hydration #418 still fires on `/` for real browsers on 0.95.2 — #496, #526
- [Phase 1] Code review WR-01..11 recorded open in 01-REVIEW-DISPOSITION.md; WR-08 (shared-cache HTML with session-dependent admin widget) and WR-07 (unconditional Umami proxy rewrite) deserve Phase 2 triage first
- SITE-03 and ARCH-08 touch the same narrative/vernacular copy — Phase 14 depends on Phase 12 so the second track consumes the first's vocabulary source instead of forking it
- ICE-06/ICE-07 and STAGE-01..04 are gated on external factors (official API behavior, TLS pinning, homelab hardware) — not schedulable by effort alone

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260829-219 | Wire SENTRY_DSN into the staging Swarm stack so staging reports to GlitchTip | 2026-08-29 | d8323eef | [260829-219-wire-sentry-dsn-into-the-staging-swarm-s](./quick/260829-219-wire-sentry-dsn-into-the-staging-swarm-s/) |
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

- Phase 01.1 inserted after Phase 1: Production on the Hetzner Swarm (#588): pin-production deploys every release; Phase 2 plans 02-01/02-09/02-11/02-12 assume v0.95.7 and a manual pull (URGENT)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-23T09:01:15.039Z
Stopped at: Phase 2 context refreshed (assumptions mode)
Resume file: .planning/phases/02-docs-accuracy-operational-housekeeping/02-CONTEXT.md
