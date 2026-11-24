---
phase: 02-docs-accuracy-operational-housekeeping
plan: 09
subsystem: infra
tags: [glitchtip, sentry, sourcemaps, symbolication, staging]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Plan 02-10: the sourcemap strip (merge commit ca7e661c) and the D-15 (2) measurement; plan 02-14: the staging browser DSN (merge commit 5a9f7559)"
provides:
  - "02-SYMBOLICATION-PROOF.md with Verdict: SYMBOLICATED (D-15 step 1)"
  - "#502 comments D-15 (1) and D-15 (2), in that order"
  - "The release gate for plan 02-11: the strip may enter release 2"
affects: [02-11, 02-12]

status: complete
actuals:
  tokens: 3500
  tasks: 3
  commits: 3
plan_head_before: 8fb344e38a305420e014f06a988cd670eeae76b7
plan_head_after: 16482fd873021e0416535d0efda9cf13a8243b0d

tech-stack:
  added: []
  patterns:
    - "Symbolication is proven by a real event from a build that serves no public map, not by an assemble answer"

key-files:
  created:
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-SYMBOLICATION-PROOF.md
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-09-SUMMARY.md
  modified: []

key-decisions:
  - "One deliberate real browser error on staging, through the normal SDK path, is a one-time exception to D-30 (Andrei, 2026-11-15). The error was raised inside the app's own bundle code; no envelope was hand-built."
  - "The event came from release 0.98.1-dev.acecf2b, a later staging build than the Task 1 pin (0.98.1-dev.ca7e661). Both have S and D as ancestors, so the plan's coupling note applies."

requirements-completed: []

coverage:
  - id: D1
    description: "Staging runs a build with the strip and the DSN, and serves no public browser map (404)"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "Task 1 verify commands (pin, ancestry, appVersion, map probe 404); recorded in 02-SYMBOLICATION-PROOF.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "A real staging browser error (HELLDIVERSBOT-7D) resolves a minified /_next/static/ frame to src/shared/components/AnalyticsOptOut.jsx:18 with a context line, from the uploaded bundle alone"
    requirement: HOUSE-03
    verification: []
    human_judgment: true
    rationale: "The orchestrator read the event through the GlitchTip MCP; the executor has no GlitchTip tool and cannot re-run the read"
  - id: D3
    description: "#502 holds D-15 (1) and then D-15 (2), with no token, DSN key or private host"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "gh issue view 502 comment-order check (true); secret-prefix scan (0 hits); issue state OPEN"
        status: pass
    human_judgment: false

duration: not tracked across the pause
completed: 2026-11-15
---

# Phase 2 Plan 09: Symbolication proof on staging Summary

**GlitchTip 6.2.6 resolves a real staging browser error from the stripped build (no public maps) to `src/shared/components/AnalyticsOptOut.jsx:18` with a context line, so the strip may enter release 2.**

## Performance

- **Duration:** not tracked across the pause (Tasks 1 and 3 ran in separate executor sessions, with the Task 2 checkpoint between them)
- **Started:** 2026-11-15T02:01Z (Task 1)
- **Completed:** 2026-11-15
- **Tasks:** 3 (Task 2 was the checkpoint, resolved by the orchestrator and Andrei)
- **Files modified:** 1 plan record (the proof file) plus this SUMMARY

## Accomplishments

- Staging pinned a build with the strip (S, PR #660) and the DSN (D, PR #659) as ancestors. The map URL derived from the chunk answered 404 on staging and 200 on production (control).
- One real staging error, HELLDIVERSBOT-7D (event `4ec0654f36334c9e88a5830f8843ac73`, environment staging, release `0.98.1-dev.acecf2b`), carries the raw frame `/_next/static/chunks/3kqjs_c4-s7d6.js:2:355`. GlitchTip resolves it to `AnalyticsOptOut.jsx:18`, and also `AnalyticsOptOut.jsx:17` and `tryCatch.mjs:18`, with a context line. Staging serves no public map, so only the uploaded bundles can explain the resolution.
- `02-SYMBOLICATION-PROOF.md` ends with `Verdict: SYMBOLICATED`.
- #502 holds two new comments in order: D-15 (1) (this event) and D-15 (2) (the 02-SOURCEMAP-MEASUREMENT.md table, verdict STRIPPED).

## Task Commits

1. **Task 1: Tracer, stripped build with the DSN on staging, no public maps** - `6e217f7d` (docs)
2. **Task 2: Raise a real staging error and read its event** - no commit (checkpoint, resolved by the orchestrator and Andrei)
3. **Task 3: Record the verdict and post D-15 (1) and (2) on #502** - `16482fd8` (docs)

**Plan metadata:** the SUMMARY commit that follows this file (docs: complete plan).

**Commit count note.** The branch `chore/plan-phase-2` was rebased onto origin/develop after Task 1, so every SHA changed. The ledger file in the git dir (`gsd-plan-head-before-02-09`) still holds the pre-rebase value `9c9af069` and is stale. The count `commits: 3` is measured by subject (`gsd-tools check evaluation-scope --plan 02-09 --commits-only` returns the two task commits) plus this SUMMARY commit. `plan_head_before` is `6e217f7d^`, and `plan_head_after` is the head before the SUMMARY commit. The docs commit `c93f3a8a` (the pause record) carries no `02-09` tag and is not counted.

## Files Created/Modified

- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-SYMBOLICATION-PROOF.md` - D-15 (1) record: staging build, map 404, browser step, event fields, verdict.
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-09-SUMMARY.md` - this file.

## #502 comments

- D-15 (1): https://github.com/elfensky/helldivers.bot/issues/502#issuecomment-6893913743
- D-15 (2): https://github.com/elfensky/helldivers.bot/issues/502#issuecomment-6893916017

## Decisions Made

- The one-time D-30 exception (Andrei, 2026-11-15) is recorded in the proof file and here. No natural staging error had reached GlitchTip. The error came from a real browser load of `/legal` with `localStorage` null, raised in the app's bundle code and sent by the SDK through `/api/glitchtip` (5 requests, all 200). The page `/` raises nothing on staging, because RecorderScript needs `UMAMI_SITE_ID`.
- The event release (`0.98.1-dev.acecf2b`) is later than the Task 1 pin. Both builds have S and D as ancestors, as the plan's `coupling_justified` note expects.

## Deviations from Plan

None - plan executed exactly as written. The event type differs from the plan's examples (a handled warning-level error reported by `tryCatch`, not a React #418), but the plan only requires an error event with a bundle frame; the verdict rule is met.

## Issues Encountered

- The HELLDIVERSBOT-7D issue stays unresolved on purpose, as the orchestrator instructed.
- The event shows two defects outside this plan's scope, already tracked: #671 (null `localStorage` stops the live poll) and #670 (the service worker never registers).
- The requirement HOUSE-03 stays unchecked. `requirements.ready-ids` reports it blocked, because plans 02-01, 02-11, 02-12 and others that declare it have no SUMMARY yet (shared-ID gate, #2388).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02-11 may cut release 2 with the strip: the proof file holds `Verdict: SYMBOLICATED`.
- #502 stays open for the later steps of D-15.

## Threat Flags

None. The plan adds no code, endpoint or schema. The comments and the proof file hold event ids, frames and versions only (secret scan: 0 hits).

## Known Stubs

None.

---
*Phase: 02-docs-accuracy-operational-housekeeping*
*Completed: 2026-11-15*

## Self-Check: PASSED

- FOUND: `.planning/phases/02-docs-accuracy-operational-housekeeping/02-SYMBOLICATION-PROOF.md` (one `Verdict:` line, `Verdict: SYMBOLICATED`)
- FOUND: commits `6e217f7d` and `16482fd8` on `chore/plan-phase-2`
- FOUND: #502 comment order check prints true; issue state OPEN; secret scan 0 hits
