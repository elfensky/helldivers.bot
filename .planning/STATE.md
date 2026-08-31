---
gsd_state_version: 1.0
current_phase: 01
current_phase_name: Stability Fixes & Release
status: executing
stopped_at: Completed 01-07-PLAN.md
last_updated: "2026-08-31T08:34:26.611Z"
last_activity: 2026-08-31
last_activity_desc: Phase 01 execution started
state_head: ffa0aa5f14b74ba1a0c53aee0ac04aaad8559766
progress:
  total_phases: 18
  completed_phases: 0
  total_plans: 9
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-29)

**Core value:** The live dashboard and API are stable and correct — the poller never loses data across season transitions or replica handovers, and production error volume stays at zero known classes.
**Current focus:** Phase 01 — Stability Fixes & Release

## Current Position

Phase: 01 (Stability Fixes & Release) — EXECUTING
Plan: 6 of 9
Status: Ready to execute
Last activity: 2026-08-31 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: N/A
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- HOUSE-03 (sourcemap stripping) needs GlitchTip symbolication proven on a real release — depends on Phase 1's release landing first
- SITE-03 and ARCH-08 touch the same narrative/vernacular copy — Phase 14 depends on Phase 12 so the second track consumes the first's vocabulary source instead of forking it
- ICE-06/ICE-07 and STAGE-01..04 are gated on external factors (official API behavior, TLS pinning, homelab hardware) — not schedulable by effort alone
- NEXT_PUBLIC_VAPID_PUBLIC_KEY is confirmed ABSENT from the release image (Dockerfile.app has no ARG for it, neither build-release.yml nor build-staging.yml pass it as a build-arg) — plan 01-08's release gate must add it before 01-06's VAPID error-surfacing fix ships, or every push-capable production visitor lands in the new error state. See 01-VAPID-IMAGE-CHECK.md.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260829-219 | Wire SENTRY_DSN into the staging Swarm stack so staging reports to GlitchTip | 2026-08-29 | d8323eef | [260829-219-wire-sentry-dsn-into-the-staging-swarm-s](./quick/260829-219-wire-sentry-dsn-into-the-staging-swarm-s/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-31T08:34:26.593Z
Stopped at: Completed 01-07-PLAN.md
Resume file: None
