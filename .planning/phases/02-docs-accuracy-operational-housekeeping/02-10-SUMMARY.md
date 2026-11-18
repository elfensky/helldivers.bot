---
phase: 02-docs-accuracy-operational-housekeeping
plan: 10
subsystem: infra
tags: [sentry, glitchtip, sourcemaps, nextjs, docker, ci]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Plan 02-14: staging carries the GlitchTip DSN; plan 02-13: release 0.98.1 and the map-probe correction"
provides:
  - "Token builds upload browser sourcemaps to GlitchTip, then delete them; token-less builds emit none (PR #660, merge commit ca7e661c)"
  - "Staging image sha-ca7e661c holds 0 static maps, 131 debug IDs and 48 server maps (Verdict: STRIPPED)"
  - "#502 comment 1 (D-13 gate evidence); D-32 issue #661"
affects: [02-09, 02-11, 02-12]

status: complete
actuals:
  tokens: 6500
  tasks: 3
  commits: 1
plan_head_before: 1d393d66de9c6532e7a730514279d8f1c22c9862
plan_head_after: 11d55c36e98a1fb1c888013d9de87b2e8128b335

tech-stack:
  added: []
  patterns:
    - "Sentry wrapper owns browser sourcemaps: no productionBrowserSourceMaps key, sourcemaps.deleteSourcemapsAfterUpload stated in place"

key-files:
  created:
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-SOURCEMAP-MEASUREMENT.md
  modified:
    - next.config.mjs
    - src/app/docs/infrastructure/page.mdx
    - .planning/codebase/CONCERNS.md
    - .planning/milestones/M7-phases/01-stability-fixes-release/01-REVIEW-DISPOSITION.md
    - CHANGELOG.md

key-decisions:
  - "The explicit delete option equals the SDK default; it stays so the intent is readable in the config (D-14)."
  - "The commits field counts the GSD working tree only. The two code commits live on develop (2c644866, ca7e661c) by the plan's lane carve-out."

requirements-completed: [HOUSE-03, DOCS-02]

coverage:
  - id: D1
    description: "next.config.mjs has no productionBrowserSourceMaps key and sets sourcemaps.deleteSourcemapsAfterUpload: true in the withSentryConfig options; no silent option"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "Task 1 automated check 1 (grep, comment lines excluded)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A token-less stub-env build emits 0 .map files under .next/static"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "npm run build with stub env, then find .next/static -name '*.map' (0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/docs/infrastructure shows the real ternary and options and the strip behavior; IN-03 resolved (02-10); CONCERNS #502 note; changelog entry"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 1 automated check 3; git show origin/develop IN-03 row grep"
        status: pass
    human_judgment: false
  - id: D4
    description: "#502 carries the D-13 gate evidence; D-32 issue #661 is open in Engineering Health"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "gh issue view 502 comments grep (1 match); gh issue list Engineering Health search (1 match)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Build: Staging run 43664483511 for S logs the upload line in both build legs; origin/deploy/staging pins sha-S"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "gh run view 43664483511 --log, grep of the upload line per job (amd64 1, arm64 1)"
        status: pass
    human_judgment: false
  - id: D6
    description: "sha-S image measured against v0.97.2 (amd64, export): Verdict: STRIPPED"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "02-SOURCEMAP-MEASUREMENT.md Task 3 automated checks 1-3"
        status: pass
    human_judgment: false

duration: 14 min
completed: 2026-11-15
---

# Phase 2 Plan 10: Browser sourcemap strip Summary

**Token builds now upload the browser sourcemaps to GlitchTip and delete them (`sourcemaps.deleteSourcemapsAfterUpload`), and the staging image sha-ca7e661c holds 0 static maps against 142 in v0.97.2 while it keeps all 131 debug IDs and the 48 unserved server maps.**

## Performance

- **Duration:** 14 min (01:35Z to 01:49Z)
- **Tasks:** 3 of 3
- **Files modified on develop:** 5 (`next.config.mjs`, `src/app/docs/infrastructure/page.mdx`, `.planning/codebase/CONCERNS.md`, `01-REVIEW-DISPOSITION.md`, `CHANGELOG.md`)

## Accomplishments

- PR #660 passed all 6 checks (Test & Build, Visual Regression, Review Dependencies, CodeQL x3) and was rebase-merged. The remote branch, the local branch and the lane worktree are removed. Merge commit S = `ca7e661c0176885a797186154f6814e32c1eacb8`.
- `next.config.mjs`: `productionBrowserSourceMaps` removed; `sourcemaps: { deleteSourcemapsAfterUpload: true }` added after `sentryUrl`; no `silent` key.
- `/docs/infrastructure` shows the real ternary and options and explains token builds, token-less builds and the server maps.
- #502 comment 1 records the D-13 gate (HELLDIVERSBOT-6C, release 0.95.2, `NotificationToggle.jsx:118`). Comment: `https://github.com/elfensky/helldivers.bot/issues/502#issuecomment-6887418674`.
- D-32 issue: https://github.com/elfensky/helldivers.bot/issues/661 (Engineering Health, labels infrastructure and chore). Plan 02-11 Task 1 shows it to Andrei.
- Staging gate passed. Build: Staging run `43664483511` (success): `Build App Image (amd64)` and `Build App Image (arm64)` each logged one `Successfully uploaded source maps to Sentry` line; no upload error line. `origin/deploy/staging` pins `ghcr.io/elfensky/helldiversbot:sha-ca7e661c0176885a797186154f6814e32c1eacb8`. The staging roll itself (Arcane Git Sync) was not awaited; plan 02-09 needs it before it reads a staging event.
- `02-SOURCEMAP-MEASUREMENT.md` ends `Verdict: STRIPPED`: static maps 142 to 0, static map bytes 31,057,870 to 0, sourceMappingURL lines 131 to 0, debugId lines 131 to 131, server maps 48 to 48, static js bytes 7,264,852 to 7,259,101. Not posted on #502.

## Task Commits

1. Task 1 (tracer): `2c644866` on develop (`chore(build): delete browser sourcemaps after the Sentry upload (HOUSE-03, #502)`); the token-less build, the verify greps and the docs check passed in the lane before the commit.
2. Task 2: `ca7e661c` on develop (`docs(house-03): record the sourcemap strip in IN-03, CONCERNS and the changelog (#502)`).
3. Task 3: `11d55c36` in the GSD working tree (`docs(02-10): measure the sha-S image against v0.97.2 (D-15 step 2)`).

The two develop commits are outside the GSD working tree, as the plan requires. The tracer gate (auto and end-of-phase modes) re-ran the tracer `<verify>`: it passed, so expansion went ahead.

## Deviations from Plan

### Auto-fixed Issues

None.

### Observations

**1. Map-probe URL form.** This plan runs no public `.map` probe. The correction from plan 02-13 (derive the map URL from the chunk's `sourceMappingURL` comment) still binds plans 02-09 and 02-12. After the strip a chunk has no such comment, which is the expected result.

**2. Content size grew from 119 MB to 207 MB.** The 31 MB of maps are gone, yet the image is larger. The growth is outside `.next/static` and `.next/server` (static `.js` bytes differ by 6 KB). It is not attributed and does not bear on the verdict; recorded in the measurement file.

**3. `sw.js` `.map` count is 3 in both images.** All 3 hits are `Array.prototype.map` calls. The count of `.js.map` and `sourceMappingURL` in `sw.js` is 0 in both. A8 holds.

**4. The SDK enables browser maps for Turbopack builds only** (`maybeEnableTurbopackSourcemaps`). The staging build uploaded maps in both legs and the image has debug IDs, so the build path is the one the SDK covers. No action needed.

**Total deviations:** 0 auto-fixed, 4 observations. **Impact:** none on the plan.

## Authentication Gates

None. The GHCR pulls needed no login.

## Known Stubs

None.

## Threat Flags

None. The strip removes a served resource; no endpoint, auth path or schema was added.

## Issues Encountered

None.

## Next Phase Readiness

Plan 02-09 (D-15 (1)) may read a staging event once Arcane has rolled `sha-ca7e661c` onto staging; it then posts step (1) on #502, then the numbers from `02-SOURCEMAP-MEASUREMENT.md`. Plan 02-11 must re-gate each release build leg on the upload line (D-32) and show #661 to Andrei. Release 2 may ship the strip: the verdict is STRIPPED.

## Self-Check: PASSED

- `02-SOURCEMAP-MEASUREMENT.md` exists; commit `11d55c36` is an ancestor of HEAD.
- Commits `2c644866` and `ca7e661c` are on `origin/develop`; PR #660 state is MERGED.
- #502 has 1 comment with the D-13 evidence; issue #661 is open in Engineering Health; the comment and issue bodies hold no `sntrys_`, `ghp_` or `<32 hex>@` string.
- Task 1, 2 and 3 `<automated>` checks exit 0.
