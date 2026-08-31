---
phase: 01-stability-fixes-release
plan: 07
subsystem: frontend
tags: [next-font, css-custom-properties, typography, vitest-browser, playwright]

# Dependency graph
requires: []
provides:
  - Space Mono genuinely loaded via next/font/google, wired onto <html> alongside Space Grotesk and Inter
  - --font-mono resolving through the generated var(--font-space-mono) variable (both layout.css declarations)
  - Documented, evidence-based finding that the project's vitest browser-mode visual harness cannot execute next/font at all
  - Documented, evidence-based finding that --font-display/--font-body share the same unresolved bare-string bug (out of scope for this plan)
affects: []

# Actuals (#2632)
actuals:
  tokens: 4644
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Temporary on-disk revert/restore of a committed file (via `git show <prev-commit>:<path>` written to disk, never staged) to get a true before/after reading from a live, already-running dev server without disturbing git history"
    - "getComputedStyle().fontFamily proves the CSS declaration, not the rendered face; document.fonts.check() is unreliable (returns true for nonexistent font names); the reliable signal is a bounding-box width delta on static (non-animated) text plus the presence of next/font's auto-generated '<Family> Fallback' face name"

key-files:
  created:
    - .planning/phases/01-stability-fixes-release/01-FONT-MEASUREMENTS.md
  modified:
    - src/app/layout.jsx
    - src/app/layout.css

key-decisions:
  - "Kept Space Mono per D-17 and made it load for real, following the working next/font-variable pattern rather than the bare-string pattern --font-display/--font-body still use (those two are a separate, out-of-scope bug — same symptom, flagged for a future plan)"
  - "Rejected the vitest browser-mode visual harness as the before/after instrument after discovering it cannot execute next/font under Vite; switched the authoritative measurement to the real Next.js dev server via a temporary, non-committing file revert/restore"
  - "Treated the visual-regression suite's identical pass count and zero baseline diffs (before and after) as a documented, pre-existing suite blind spot rather than evidence the fix had no effect — the suite is architecturally incapable of seeing a next/font change"

requirements-completed: [STAB-04]

coverage:
  - id: D1
    description: "Space Mono is loaded via next/font/google (both weights, display swap) and wired onto <html> alongside the existing Space Grotesk/Inter variables"
    requirement: STAB-04
    verification:
      - kind: other
        ref: "grep -c 'Space_Mono' src/app/layout.jsx -> 2"
        status: pass
      - kind: e2e
        ref: "real dev server: getComputedStyle().fontFamily reads \"Space Mono\", \"Space Mono Fallback\", monospace post-fix (Space Mono Fallback only exists when next/font actually loads the face)"
        status: pass
    human_judgment: false
  - id: D2
    description: "--font-mono resolves through var(--font-space-mono) in both layout.css declarations instead of a bare family-name string"
    requirement: STAB-04
    verification:
      - kind: other
        ref: "grep -c 'var(--font-space-mono)' src/app/layout.css -> 2"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every D-18 mono row measured before and after in a real browser, recorded on issue #476"
    requirement: STAB-04
    verification:
      - kind: e2e
        ref: "01-FONT-MEASUREMENTS.md paired Before/After tables; gh issue comment on #476"
        status: pass
    human_judgment: false
  - id: D4
    description: ".sector-card-meta does not overflow or wrap differently at 300px/260px card widths after the font change"
    requirement: STAB-04
    verification:
      - kind: e2e
        ref: "01-FONT-MEASUREMENTS.md narrow-width wrap tables (300px/260px, before and after, both scenarios: barLabel-present and PaceIndicator-in-meta)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No visual-regression baseline was silently invalidated by the metric change"
    verification:
      - kind: other
        ref: "sh scripts/visual-tests.sh (Docker) — 3 files / 5 tests, zero baseline diffs, before and after"
        status: pass
    human_judgment: true
    rationale: "The suite passing with zero diffs is only meaningful once the reader understands it cannot execute next/font at all (documented in 01-FONT-MEASUREMENTS.md) — a human should read that caveat rather than treat '0 diffs' at face value as proof of a correct fix."

duration: 35min
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 7: Space Mono Loaded via next/font, --font-mono Repointed Summary

**Space Mono is now fetched through `next/font/google` and `--font-mono` resolves through the generated `var(--font-space-mono)` in both `layout.css` declarations, proven via real dev-server before/after measurements (not the project's visual-regression harness, which turned out to be structurally blind to `next/font`) and posted to #476.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-31T08:11:00Z (approx)
- **Completed:** 2026-08-31T08:32:12Z
- **Tasks:** 3
- **Files modified:** 2 source files (`src/app/layout.jsx`, `src/app/layout.css`) + 1 measurement doc created

## Accomplishments
- Added `Space_Mono` to the existing `next/font/google` import in `src/app/layout.jsx`, instantiated with both weights (`400`/`700` — Space Mono is not variable-weight, unlike Space Grotesk/Inter), `display: 'swap'`, and a `--font-space-mono` CSS variable; wired the instance's `.variable` onto `<html>` alongside the two existing font variables
- Repointed `--font-mono` in both `layout.css` declarations (`:root` and `@theme`) from the bare `'Space Mono', monospace` string to `var(--font-space-mono), monospace`
- Discovered, during Task 1's before-state work, that `--font-display`/`--font-body` have the identical bare-string bug — neither resolves through its `next/font`-generated variable either — and correctly did NOT copy that broken pattern for `--font-mono`, following the working variable-reference shape instead
- Discovered, while trying to measure the fix, that the project's `vitest` browser-mode visual-regression harness (`vitest.visual.config.mjs`) cannot execute `next/font` at all — it runs under Vite, not Next's webpack/Turbopack build pipeline — so a Task 1 fixture re-run against it post-fix was byte-identical to the pre-fix run. Documented this as a methodology correction and switched the authoritative before/after instrument to the real Next.js dev server
- Proved `document.fonts.check()` is not reliable evidence for font-resolution (it returns `true` even for a font name that does not exist anywhere) and used measured glyph-metric width deltas on static (non-animated) text instead, combined with the `next/font`-only `"Space Mono Fallback"` face name appearing in computed `font-family`
- Captured paired Before/After measurements for all 7 D-18 mono element classes plus `.sector-card-meta` at 300px/260px card widths in both the barLabel-present and PaceIndicator-in-meta scenarios; posted the evidence to GitHub issue #476
- Ran the visual-regression suite (Docker) before and after: 3 files / 5 tests, zero baseline diffs both times — documented as a genuine pre-existing suite blind spot (can't see `next/font`) rather than evidence of no effect

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the before-state measurements of every affected mono row** - `66fa6c6a` (docs)
2. **Task 2: Load Space Mono through next/font and repoint the token** - `60b30313` (fix)
3. **Task 3: Capture the after-state, check the narrow-card row, and post the evidence to #476** - `8a0b128c` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/app/layout.jsx` - Added `Space_Mono` import + instance (weight 400/700, `--font-space-mono` variable), wired `.variable` onto `<html>`
- `src/app/layout.css` - Repointed both `--font-mono` declarations to `var(--font-space-mono), monospace`
- `.planning/phases/01-stability-fixes-release/01-FONT-MEASUREMENTS.md` - Paired Before/After computed-style, bounding-box, and narrow-width measurements, plus methodology notes on what does and does not constitute evidence of a font-loading fix

## Decisions Made
- Kept Space Mono (per D-17) and made it load for real, rather than dropping the token — matches the original visual A/B decision
- `--font-display`/`--font-body`'s identical bare-string bug is explicitly out of scope for this plan (D-17 is narrowly about `--font-mono`); flagged in STATE.md for a future plan rather than silently fixed here
- Switched the before/after measurement instrument mid-plan from the vitest browser-mode visual harness to the real Next.js dev server, once it became clear the harness cannot execute `next/font` under Vite — this is a real, load-bearing methodology correction, not a minor implementation detail, and is documented in full in `01-FONT-MEASUREMENTS.md`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in measurement methodology] Vitest browser-mode harness cannot prove the font fix**
- **Found during:** Task 3 (re-measuring Task 1's fixtures post-fix)
- **Issue:** The project's `vitest.visual.config.mjs` harness runs under Vite, not Next.js's build pipeline — `next/font/google` never executes there. Re-running the Task 1 fixtures against it after the fix produced byte-identical computed `font-family` strings and widths to the pre-fix run, which would have read as "the fix did nothing" if taken at face value.
- **Fix:** Switched the authoritative before/after instrument to the real Next.js dev server (`localhost:3000`), using a temporary, non-committing on-disk revert of `layout.jsx`/`layout.css` to the pre-fix commit's content (via `git show <commit>:<path>`, never staged) to get a genuine paired comparison without disturbing the running dev session or git history.
- **Files modified:** None (measurement-only; the temporary revert was restored byte-for-byte and verified via `git diff` before continuing)
- **Verification:** `git diff --stat src/app/layout.jsx src/app/layout.css` showed zero changes after restoration, both times the technique was used
- **Committed in:** `8a0b128c` (documented in `01-FONT-MEASUREMENTS.md`, not a code commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — methodology bug caught before it produced a false conclusion)
**Impact on plan:** No production code was affected. The deviation is entirely in how the plan's own verification evidence was gathered, and is fully documented so a future reader understands why the visual-regression suite shows zero diffs.

## Issues Encountered

- `document.fonts.check()` was initially used as a stronger signal than `getComputedStyle().fontFamily` for whether a font is actually loaded, but was found to return `true` even for a completely nonexistent font name (`document.fonts.check('14px "TotallyBogusFontXYZ123"')` → `true`) — it does not fail closed for unmatched families. Dropped in favor of measured glyph-metric width deltas plus the `next/font`-only `"Space Mono Fallback"` face-name signal.
- `.sector-card-assault` (assault ETA) did not render on the live dashboard in either capture — no active event currently has a computable ETA forecast. Verified by shared-CSS-declaration argument instead (it uses the byte-identical `font-family: var(--font-mono, monospace);` rule confirmed working on four sibling elements, and `--font-mono` is a single global custom property).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- STAB-04 (#476) is resolved: Space Mono is genuinely loaded, `--font-mono` resolves to it in both declarations, and the narrow-card meta row is confirmed intact at both documented widths
- `--font-display`/`--font-body`'s matching bare-string bug is now known and documented but unfixed — worth a small follow-up plan or GitHub issue if the same "declared but never verified" pattern matters there too
- The visual-regression suite's inability to execute `next/font` is a real, documented coverage gap — not blocking, but worth knowing before relying on that suite to catch a future font-loading regression
- No blockers identified

---
*Phase: 01-stability-fixes-release*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: src/app/layout.jsx
- FOUND: src/app/layout.css
- FOUND: .planning/phases/01-stability-fixes-release/01-FONT-MEASUREMENTS.md
- FOUND commit: 66fa6c6a
- FOUND commit: 60b30313
- FOUND commit: 8a0b128c
