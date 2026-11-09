---
phase: 01-stability-fixes-release
plan: 01
subsystem: game-utils
tags: [null-safety, vitest, war-narrative, campaign-status]

# Dependency graph
requires: []
provides:
  - Null-tolerant getWarOutcome victory-signal checks (STAB-05)
  - Regression coverage for null faction slots in live status and snapshot data
  - Regression coverage for buildPlayerBeats' zero-baseline and single-sample guards
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09]

# Actuals (#2632)
actuals:
  tokens: 1476
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Optional-chained f?.status inside .every() victory-signal callbacks instead of a pre-filter or reduce rewrite"
    - "Phrase-prefix derivation from a live PHRASES pool (via a sentinel substitution) instead of hardcoded prose copies in test assertions"

key-files:
  created: []
  modified:
    - src/shared/utils/game/getWarOutcome.mjs
    - src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs
    - src/__tests__/unit/features/archives/buildWarNarrative.test.mjs

key-decisions:
  - "Used optional chaining (f?.status) at both .every call sites rather than an early some((f) => !f) bail — smaller diff, identical semantics, keeps the two checks visually symmetric per the plan's requirement"
  - "buildPlayerBeats zero-baseline/single-sample coverage asserts absence of surge/collapse beats via prefixes extracted from the live PHRASES.surge/PHRASES.collapse pools (sentinel substitution), not hardcoded prose, so the assertion survives the #453 phrasing-variety work"

requirements-completed: [STAB-05]

coverage:
  - id: D1
    description: "getWarOutcome tolerates a null faction slot in live data.status without throwing and without reporting a false victory"
    requirement: STAB-05
    verification:
      - kind: unit
        ref: "src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs#does not throw and does not report victory when a live status slot is null"
        status: pass
    human_judgment: false
  - id: D2
    description: "getWarOutcome tolerates a null faction slot inside a snapshot's data array without throwing and without reporting a false victory"
    requirement: STAB-05
    verification:
      - kind: unit
        ref: "src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs#does not throw and does not report victory when a snapshot faction slot is null"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildPlayerBeats' zero-baseline guard (median player total <= 0) is pinned by a regression test"
    verification:
      - kind: unit
        ref: "src/__tests__/unit/features/archives/buildWarNarrative.test.mjs#emits no surge or collapse beat when the median player baseline is zero"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildPlayerBeats' single-sample guard (series.length < 2) is pinned by a regression test"
    verification:
      - kind: unit
        ref: "src/__tests__/unit/features/archives/buildWarNarrative.test.mjs#emits no surge or collapse beat with a single playerTimeseries sample"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 1: Null-Tolerant getWarOutcome + buildPlayerBeats Guard Coverage Summary

**Both `getWarOutcome` victory-signal `.every` checks now optional-chain faction-slot access instead of dereferencing bare, closing the STAB-05 crash; `buildPlayerBeats`' pre-existing zero-baseline and single-sample guards are now pinned by dedicated regression tests.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-31T07:12:00Z (approx)
- **Completed:** 2026-08-31T07:20:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed the unguarded `f.status` dereference at both `getWarOutcome` victory-signal call sites (`live.every`, `snapshot.data.every`) with optional chaining, so a null faction slot fails the all-defeated check instead of throwing a `TypeError` — closes STAB-05 (#459) at root cause
- Extended the algorithm JSDoc block to document the null-slot behaviour, keeping the "verified against 137 wiki-confirmed seasons" claim accurate
- Added two regression cases to `getWarOutcome.test.mjs` (13 total, up from 11) pinning the null-slot behaviour for both live status and snapshot data inputs
- Added two regression cases to `buildWarNarrative.test.mjs` (32 total, up from 30) pinning `buildPlayerBeats`' previously-untested zero-baseline and single-sample guards, driven through the public `buildWarNarrative` entry point since `buildPlayerBeats` is module-private
- Proved the phase's fix → test → verify → commit loop end to end (this is the phase's tracer slice) before any other bug class in Phase 1 is touched

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end null-slot tolerance in getWarOutcome** - `d477ace4` (fix)
2. **Task 2: Pin buildPlayerBeats' zero-baseline guard with a fixture test** - `3c318aef` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/shared/utils/game/getWarOutcome.mjs` - Optional-chained `f?.status` at both `.every` victory-signal call sites; JSDoc null-slot behaviour line
- `src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs` - Two new regression cases (null live-status slot, null snapshot-data slot)
- `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs` - Two new regression cases (zero median baseline, single playerTimeseries sample), driven through `buildWarNarrative`

## Decisions Made
- Optional chaining (`f?.status`) chosen over an early `some((f) => !f)` bail at both call sites — smaller diff, identical outcome (a null slot never satisfies the all-defeated check), and keeps the two victory-signal checks symmetric as the plan required
- The two new `buildPlayerBeats` test cases assert absence of surge/collapse beats by deriving the phrase prefixes from the live `PHRASES.surge`/`PHRASES.collapse` pools via sentinel substitution (`fn('__N__').split('__N__')[0]`) rather than duplicating hardcoded prose — this keeps the assertion valid across the #453 phrasing-variety work landing in a later phase

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npm run build` failed locally with `POSTGRES_URL is not set` on the first attempt — this is a pre-existing local environment condition (`next build` runs in production mode and does not auto-load `.env.development`), not a regression introduced by this plan. Re-ran with `.env.development` sourced into the shell environment; build then compiled successfully with no errors related to the change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The phase's fix → test → verify → commit loop is proven end to end; plans 01-02 through 01-09 can now repeat it against their own bug classes with confidence in the mechanics
- `getWarOutcome` is null-tolerant at both call sites; no other Phase 1 plan needs to revisit this file for STAB-05
- No blockers identified

---
*Phase: 01-stability-fixes-release*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: src/shared/utils/game/getWarOutcome.mjs
- FOUND: src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs
- FOUND: src/__tests__/unit/features/archives/buildWarNarrative.test.mjs
- FOUND: .planning/phases/01-stability-fixes-release/01-01-SUMMARY.md
- FOUND commit: d477ace4
- FOUND commit: 3c318aef
