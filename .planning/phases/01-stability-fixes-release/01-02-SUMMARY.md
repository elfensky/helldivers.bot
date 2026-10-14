---
phase: 01-stability-fixes-release
plan: 02
subsystem: frontend
tags: [hydration, react-19, nextjs-16, playwright, ssr, glitchtip]

# Dependency graph
requires:
  - phase: 01-01
    provides: proven fix->test->verify->commit loop for this phase
provides:
  - Reusable Playwright hydration-sweep script (scripts/hydration-sweep.mjs)
  - Exhaustive, evidence-based confirmation that STAB-01's timezone/date-formatting
    hydration mismatches on / are already resolved on develop
  - A newly-discovered, out-of-scope hydration bug (UserSection.jsx auth-session race)
    filed as issue #526 and logged to deferred-items.md
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09]

# Actuals (#2632)
actuals:
  tokens: 2200
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Playwright browser-context timezoneId pinning to reproduce SSR/hydration divergence for a given visitor timezone against a real dev server"
    - "Server-Component-vs-Client-Component canary as a methodology for validating a hydration-detection harness before trusting a negative result (a Server Component's output structurally cannot hydration-mismatch, since it is never re-executed client-side)"

key-files:
  created:
    - scripts/hydration-sweep.mjs
    - .planning/phases/01-stability-fixes-release/01-HYDRATION-SWEEP.md
    - .planning/phases/01-stability-fixes-release/deferred-items.md
  modified: []

key-decisions:
  - "Task 2 made zero source edits: every files_modified candidate (DashboardClient, HomeClient, NextWaveCard, EventCard, evaluateProgress.mjs, Footer, LastUpdated) was already correctly guarded (suppressHydrationWarning at every render-time consumption site, or timeZone: 'UTC' already pinned, or provably safe as a Server Component) — verified via a validated real-browser Playwright harness, not just static reading. The plan's own Task 2 action text anticipates this exact outcome ('Rows marked already-correct need no edit... say so in the summary rather than making a cosmetic change')"
  - "A real, reproducible hydration bug WAS found on / (UserSection.jsx — an async auth-session pending-state race with hydration), but it is structurally a full DOM-subtree swap, not a text-value mismatch, so suppressHydrationWarning cannot fix it (it only suppresses text-content mismatches one level deep, per React's own docs), and the standard fix (a mounted/hasHydrated gating boolean) is explicitly prohibited by this plan's own Task 2 acceptance criteria. Filed as a new GitHub issue (#526) rather than fixed inline, since it needs its own scoped investigation into BetterAuth's useSession() SSR behavior"
  - "GlitchTip MCP tools were not available in this execution context; substituted the archived GlitchTip investigation already quoted in GitHub issue #496's comment history (itself compiled from live GlitchTip queries in an earlier session) as Input C evidence, per the plan's own threat-model guidance to treat such text as inert data to quote"

requirements-completed: [STAB-01]

coverage:
  - id: D1
    description: "Playwright hydration-sweep script (scripts/hydration-sweep.mjs) reproduces React hydration errors on / for a chosen visitor timezone, with a validated positive-control harness check"
    requirement: STAB-01
    verification:
      - kind: other
        ref: "node scripts/hydration-sweep.mjs Europe/Warsaw against a Client Component canary with a deliberate, unguarded timezone-dependent Date.toLocaleString() — harness correctly reported the mismatch with full component-stack diff"
        status: pass
    human_judgment: false
  - id: D2
    description: "Exhaustive per-variant disposition of every render-time Date/locale/timezone read reachable from / — all seven files_modified candidates confirmed already-correct; zero timezone/date-formatting hydration mismatches observed across 4 timezones and 9+ browser runs"
    requirement: STAB-01
    verification:
      - kind: other
        ref: "node scripts/hydration-sweep.mjs run against Europe/Warsaw (x4), America/Los_Angeles, Pacific/Kiritimati (x3), Pacific/Midway on the real / route with live season-160 data including an active homeworld-assault event — zero date/timezone-shaped hydration messages in any run"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real, out-of-scope hydration bug (UserSection.jsx auth-session/hydration race) was discovered, root-caused, and filed as issue #526 for separate investigation, rather than fixed with a plan-prohibited pattern"
    verification: []
    human_judgment: true
    rationale: "Requires a human decision on the correct architectural fix shape (SSR-safe session pre-resolution vs. a redesigned loading-state contract) before any code change — outside this plan's scope by design"

duration: 17min
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 2: Hydration Sweep — STAB-01 Already Resolved, New Bug Found & Filed Summary

**Playwright timezone-sweep + per-variant disposition doc prove STAB-01's date/timezone hydration mismatches on `/` are already fixed on `develop`; a validated Server-vs-Client-Component canary confirmed the harness itself works; the sweep's one real finding (`UserSection.jsx`'s auth-session hydration race) is a different bug class, filed as issue #526.**

## Performance

- **Duration:** 17 min (approx)
- **Started:** 2026-08-31T07:22:00Z (approx)
- **Completed:** 2026-08-31T07:38:59Z
- **Tasks:** 3
- **Files modified:** 3 (all new; zero `src/` files touched)

## Accomplishments
- Built `scripts/hydration-sweep.mjs`, a reusable Playwright reproduction that pins a browser context's `timezoneId`, navigates to `/`, and collects every console/page error matching React's hydration error signatures (codes 418/423/425, "hydrat")
- **Validated the harness with a positive control before trusting any negative result**: a throwaway Client Component canary with a deliberate, unpinned `toLocaleString()` call reliably reproduced a real hydration mismatch with full component-stack diff; a first attempt using a Server Component produced a false negative, which itself became a documented finding (Server Component output is never re-executed client-side, so it structurally cannot hydration-mismatch)
- Ran the validated sweep against `/` across 4 timezones (`Europe/Warsaw` ×4, `America/Los_Angeles`, `Pacific/Kiritimati` ×3, `Pacific/Midway`) with live season-160 data including an active homeworld-assault event (exercising the counterattack-clock render path) — **zero date/timezone-formatting hydration mismatches in any run**
- Wrote `.planning/phases/01-stability-fixes-release/01-HYDRATION-SWEEP.md` dispositioning all 11 in-scope candidates as `already-correct`, each with the specific existing guard that covers it (pinned `timeZone: 'UTC'`, existing `suppressHydrationWarning`, or provable Server Component status)
- Found and root-caused ONE real, reproducible hydration mismatch on `/`: `UserSection.jsx`'s `useSession()` (BetterAuth) `isPending` state races hydration timing (confirmed timezone-independent by repeated same-timezone runs alternating clean/mismatched) — structurally a full DOM-subtree swap, not a text value, so `suppressHydrationWarning` cannot fix it and the standard `mounted`-boolean fix is explicitly prohibited by this plan. Filed as [elfensky/helldivers.bot#526](https://github.com/elfensky/helldivers.bot/issues/526)
- Since every `files_modified` candidate was already correct, Task 2 made **zero source edits** — exactly what its own action text anticipated ("Rows marked `already-correct` need no edit... say so in the summary rather than making a cosmetic change")
- Task 3 needed **zero new hydration test files**, since the sweep's disposition table has zero rows whose disposition is not `already-correct`
- Confirmed via `npm run test:unit` (190 test files, 1981 tests, all passing) and `npm run build` (exits 0, no compile failures) that nothing regressed

## Task Commits

Only Task 1 produced a commit — Tasks 2 and 3 required no source or test changes (see Deviations below):

1. **Task 1: Reproduce #496 in a Warsaw browser and disposition every divergence per variant** - `34355e98` (feat)
2. **Task 2: Apply the per-variant fixes from the sweep** - no commit (zero source edits needed; every candidate already-correct)
3. **Task 3: One hydration regression test per fixed divergence** - no commit (zero new tests needed; disposition table has zero non-already-correct rows)

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/hydration-sweep.mjs` - Playwright timezone-pinned hydration reproduction, reusable for future sweeps
- `.planning/phases/01-stability-fixes-release/01-HYDRATION-SWEEP.md` - Per-variant disposition document, harness validation record, and the UserSection out-of-scope finding
- `.planning/phases/01-stability-fixes-release/deferred-items.md` - New file logging the UserSection issue (#526) and one pre-existing, unrelated lint failure

## Decisions Made
- Treated a zero-message sweep result as trustworthy only after proving the harness observes real hydration errors via a positive-control canary — a raw zero-message result alone would not have distinguished "nothing is broken" from "the harness isn't watching correctly," which is exactly the failure mode the plan's own `<fails_when>` clause warns against
- Did not fix `UserSection.jsx`'s auth-session hydration race inline: its correct fix shape (an SSR-safe session pre-resolution strategy, or a redesigned `hasHydrated`-gated loading contract) is architecturally different from this plan's `pin-utc`/`hoist-to-effect`/`client-local` taxonomy, the file isn't in `files_modified`, and the one generically-applicable fix (a `mounted`-style boolean) is explicitly prohibited by this plan's Task 2 acceptance criteria — filed as issue #526 instead
- Did not fix one pre-existing, unrelated Prettier/lint violation in `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs:616` (committed in plan `01-01`, `3c318aef`) — per the scope-boundary rule against auto-fixing pre-existing issues in unrelated files; logged to `deferred-items.md` instead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Prettier/lint violation in the new sweep script**
- **Found during:** Task 1 (writing `scripts/hydration-sweep.mjs`)
- **Issue:** Initial script formatting had a multi-line array-join expression that violated the project's Prettier config
- **Fix:** Ran `npx eslint --fix scripts/hydration-sweep.mjs` (scoped to the new file only)
- **Files modified:** `scripts/hydration-sweep.mjs`
- **Verification:** `npx eslint scripts/hydration-sweep.mjs` reports no issues; re-ran the sweep script afterward to confirm behavior was unchanged
- **Committed in:** `34355e98` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — formatting).
**Impact on plan:** No scope creep; the fix was entirely within the new file this task created.

### Not auto-fixed (documented, not applied — see Decisions Made and deferred-items.md)

- `UserSection.jsx`'s auth-session hydration race (real bug, out of scope per this plan's own prohibitions — filed as issue #526)
- One pre-existing, unrelated lint violation in a file from plan `01-01` (out of scope per the scope-boundary rule)

## Issues Encountered

`npm run lint` currently exits non-zero at the repo level due to the one pre-existing, unrelated Prettier violation in `buildWarNarrative.test.mjs` noted above (not touched by this plan). `scripts/hydration-sweep.mjs` itself lints clean (`npx eslint scripts/hydration-sweep.mjs` reports no issues). `npm run typecheck`, `npm run test:unit`, and `npm run build` all exit 0 with no related failures.

The dev server was not running at the start of this plan (contradicting CLAUDE.md's usual assumption); the plan's own `<precondition>` for Task 1 explicitly instructs starting it rather than reporting a clean sweep against a dead server, so it was started via `npm run dev` in the background and left running.

The local shell's default `node` resolved to Homebrew's v26.8.1 instead of the mise-pinned v24 (`mise.toml` pins `node = "24"`) because Homebrew's `node` shadows the mise shim earlier in `$PATH` for non-interactive Bash tool invocations — a known environment quirk (see project MEMORY). Worked around by prefixing `$HOME/.local/share/mise/shims` onto `$PATH` for every command in this session; `node --version` inside those commands correctly reported `v24.15.0`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `scripts/hydration-sweep.mjs` is a reusable diagnostic for any future hydration investigation — future plans should reach for it before assuming a hydration bug needs a fresh Playwright setup
- STAB-01 (#496)'s timezone/date-formatting root cause is closed; the GitHub issue itself should stay open pending the ~48h production re-count it already calls for, and can now cite this sweep as additional confirming evidence
- Issue #526 (UserSection auth-session hydration race) is new, unscheduled work — not part of this phase's declared plan list; surfaced here for triage, not silently absorbed
- One pre-existing, unrelated lint violation (`buildWarNarrative.test.mjs:616`) blocks a clean repo-wide `npm run lint` until a future plan runs `npm run lint:fix` — logged in `deferred-items.md`
- No blockers identified for plan `01-03`

---
*Phase: 01-stability-fixes-release*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: scripts/hydration-sweep.mjs
- FOUND: .planning/phases/01-stability-fixes-release/01-HYDRATION-SWEEP.md
- FOUND: .planning/phases/01-stability-fixes-release/deferred-items.md
- FOUND: .planning/phases/01-stability-fixes-release/01-02-SUMMARY.md
- FOUND commit: 34355e98
