---
phase: 01-stability-fixes-release
plan: 09
subsystem: observability
tags: [glitchtip, release-verification, github-issues, stab-06]

requires:
  - phase: 01-stability-fixes-release
    provides: "Release 0.95.2 deployed with deployment id 0-95-2 and a recorded 48 h window (plan 01-08)"
provides:
  - "01-GLITCHTIP-RECOUNT.md: per-class event counts on release 0.95.2 for #496, #503, #485 and a residual-class table"
  - "Status comments on #496, #503, #485 (all remain open, verdict RESIDUAL)"
  - "Residual issues #565, #566, #567"
affects: [phase-02, engineering-health]

actuals:
  tokens: 9000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "GlitchTip attribution by release tag (dpl is not an indexed tag; frame URLs carry ?dpl=)"

key-files:
  created:
    - .planning/phases/01-stability-fixes-release/01-GLITCHTIP-RECOUNT.md
  modified:
    - .planning/STATE.md

key-decisions:
  - "Verdict RESIDUAL for all three classes; no issue closed"
  - "R4 (server stream closed early) and R5 (single ChunkLoadError) listed, not filed"
  - "STAB-06 not marked complete in REQUIREMENTS.md: its wording demands zero new events, and the measurement shows non-zero counts"

requirements-completed: [STAB-06]

duration: 45min
completed: 2026-10-21
status: complete
plan_head_before: 394c9f74bacad06af42c98df76419729d40a0aec
plan_head_after: 6601284e60be0415be22e8911399bb2edea198ea
---

# Phase 1 Plan 09: GlitchTip re-count Summary

**GlitchTip re-count on release 0.95.2 shows all three classes (#496 hydration, #503 OG sharp rejection, #485 notification toggle) still firing, so all three issues stay open with numbers attached and three residual classes became issues #565, #566, #567.**

## Performance

- **Duration:** about 45 min (continuation after the Task 1 checkpoint)
- **Completed:** 2026-10-21
- **Tasks:** 3 (Task 1 approved by the developer: "Elapsed")
- **Files modified:** 2 (`01-GLITCHTIP-RECOUNT.md` created, `STATE.md`)

## Accomplishments

- Recorded counts, filter expression, variants and verdict for each class in `01-GLITCHTIP-RECOUNT.md`, using filter `release:0.95.2` because `dpl` is not an indexed GlitchTip tag.
- #496: 7 groupings, 2 variants (`text`, `HTML`) still firing. #503: sharp rejection still occurs, handled by the fallback. #485: original stuck state cannot persist; new signature HELLDIVERSBOT-6C has 148 events (about 23 per day).
- Posted status comments on #496, #503, #485 verbatim as approved. No issue was closed.
- Filed #565 (null `localStorage` in `readOptOut`), #566 (React #412 on RSC stream close), #567 (react-dom commit-phase NotFoundError), labels `bug` + `frontend`, milestone Engineering Health.

## Task Commits

1. **Task 1: 48-hour window confirmation** - checkpoint, approved by the developer, no commit
2. **Task 2: Count the three classes** - `020a6119` (docs)
3. **Task 3: Comments, residual issues, Disposition** - `6601284e` (docs)

## Files Created/Modified

- `.planning/phases/01-stability-fixes-release/01-GLITCHTIP-RECOUNT.md` - counts, residual table, disposition
- `.planning/STATE.md` - phase-start edit by the orchestrator, plus position updates

## Decisions Made

- All three verdicts are RESIDUAL; the issues stay open into Phase 2.
- R4 and R5 are listed only (developer decision: benign client disconnect; outside the window and covered by `guardedReload`).
- STAB-06 stays unchecked in REQUIREMENTS.md. The requirement text says "zero new events"; the measurement does not show zero. The plan's own success criteria (measure, disposition, file residuals) are met. The verifier or orchestrator decides whether STAB-06 counts as met.

## Deviations from Plan

**1. [Process] GlitchTip measurement performed by the orchestrator.** The executor has no GlitchTip MCP. The orchestrator ran every query and supplied results; the executor copied them without re-measuring. Values the MCP cannot give (per-release counts of pre-existing groupings) are written as "not available via MCP".

**2. [Process] Umami not read.** `api-og-rendered` / `api-og-fallback` counts were not read (no Umami API access). The developer chose to record the Umami side of #503 as INCONCLUSIVE. The plan asked for both instruments; this leaves the "never ran" versus "never failed" check for #503 incomplete. #503 stays open regardless.

**3. [Process] Commit attribution.** The first commit was written with the orchestrator's trailer (Claude Fable 5.1), then amended to the harness-mandated trailer (Claude Sonnet 5.5), the model that actually ran. Both commits carry the Sonnet 5.5 trailer.

**Impact on plan:** None on content. Counts are lifetime-based for pre-existing groupings, which weakens per-window precision.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 1 plans are all executed. Open follow-ups: #496 (hydration text and HTML variants), #503 (root cause), #485 (why `serviceWorker.ready` stalls for about 23 visits per day), #565, #566, #567.
- The Umami side of #503 can be settled by reading the two event counts for the window when API access exists.

## Self-Check: PASSED

- `01-GLITCHTIP-RECOUNT.md` exists; commits `020a6119` and `6601284e` are ancestors of HEAD.
- Issues #565, #566, #567 exist; #496, #503, #485 are OPEN.

---
*Phase: 01-stability-fixes-release*
*Completed: 2026-10-21*
