---
phase: 02-docs-accuracy-operational-housekeeping
plan: 18
subsystem: docs
tags: [docs, infrastructure, sentry, database, oauth, page-check-record]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "02-24 (lane docs/02-gap-closure at 1894d747, data-flow re-check)"
provides:
  - "/docs/infrastructure Sentry bullets scoped to what the plugin does: a failed upload fails the build, a skipped upload does not (WR-01)"
  - "GitHub issue #686 tracking the CI guard for skipped uploads (Engineering Health)"
  - "/docs/database names Discord, GitHub and Google everywhere and was re-checked statement by statement at lane commit 4ac3350c (WR-04)"
  - "Sweep 3 complete with groups G1-G4, 0 hit lines"
  - "Page-check record section '## Gap closure: /docs/database' closed by the only Page database CHECKED line"
affects: [02-25, 02-19, 02-20, 02-22]

plan_head_before: 1894d74712cfb0be6905e4323551a8ff9fcd3a7b
plan_head_after: 4ac3350c849e912b38885e6d411f88512bcdeaab

actuals:
  tokens: 9500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/app/docs/infrastructure/page.mdx
    - src/app/docs/database/page.mdx
    - src/__tests__/unit/_meta/docsRetiredStrings.test.mjs
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md

key-decisions:
  - "The two-provider linking examples on /docs/database are rewritten to name all three providers, so the broad G4 pattern `Discord and GitHub` stays (plan decision)"
  - "The skip bullet also states that the deletion step still removes the maps from .next/static after a skipped upload, from the plugin source (deleteArtifacts runs after uploadSourcemaps returns early)"
  - "Issue #686 is new: no open issue matched the search and #661 is closed"

requirements-completed: [DOCS-02]

coverage:
  - id: C1
    description: "The infrastructure page states which Sentry failures stop a build and which pass, with the CI-guard issue reference, and the served page shows it"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 1 verify 1 (page greps, workflows unchanged against origin/develop, vitest sweeps): exit 0"
        status: pass
      - kind: other
        ref: "Task 1 verify 2 (issue #686 open, names SENTRY_PROJECT, no token- or DSN-shaped value): exit 0"
        status: pass
      - kind: other
        ref: "Task 1 verify 3 (lane server on 127.0.0.1:3100 serves 'ships without uploaded maps', no overclaim): exit 0"
        status: pass
    human_judgment: false
  - id: C2
    description: "/docs/database matches the schema and the code it names statement by statement; the three OAuth providers are named"
    requirement: DOCS-02
    verification:
      - kind: unit
        ref: "npx vitest run src/__tests__/unit/_meta (9 files, 35 tests passed) and node scripts/check-mermaid-fences.mjs on the page (2 fences OK)"
        status: pass
      - kind: other
        ref: "Task 2 verify 2: single closing line bound to lane commit 4ac3350c, page unchanged after it, cited files exist in the lane, nine CHECKED lines once each"
        status: pass
    human_judgment: false
  - id: C3
    description: "Rendered look of the two new infrastructure bullets and the edited lifecycle diagram node on /docs/database"
    requirement: DOCS-02
    verification: []
    human_judgment: true
    rationale: "Plan 02-19 owns the render check; this plan has no browser tool"

duration: 12min
completed: 2026-11-15
status: complete
---

# Phase 2 Plan 18: Sentry bullet scope and /docs/database re-check Summary

**The infrastructure page no longer claims that Pin Production cannot pin a build without its maps: a failed upload fails the build, a skipped upload (empty project, empty org, zero maps) passes and ships without uploaded maps, and issue #686 tracks the CI guard; /docs/database now names Discord, GitHub and Google and was re-read against the schema, with eight further contradictions fixed.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-15T20:00:00Z
- **Completed:** 2026-11-15T20:12:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 in the lane, 1 record)

## Accomplishments

- Task 1, tracer: read `@sentry/bundler-plugins` 11.10.0 and `@sentry/nextjs` 11.10.0 in the lane (code fact 2 held for 11.10.0). Source lines in `build/cjs/core/build-plugin-manager.js`:
  - rethrow path: `handleRecoverableError` calls the user `errorHandler` and lets its throw propagate (lines 102-116); the `writeBundle` upload hook and the release step call it (lines 321, 340, 476)
  - no-token skip: `canUploadSourceMaps` warns and returns false (lines 540-544); `uploadSourcemaps` returns early at line 357; in this repo an empty token never reaches the plugin, because `next.config.mjs:213` skips `withSentryConfig`
  - no-org skip for a token without the `sntrys_` prefix: lines 545-550
  - no-project skip: lines 552-556
  - zero-maps skip: warns "No source maps found ..." and returns (lines 456-460)
  - `deleteArtifacts` (line 503) still runs after a skipped upload; `handleRunAfterProductionCompile.js` awaits `createRelease`, `uploadSourcemaps` and `deleteArtifacts` in that order
- Issue #686 "Build: a skipped sourcemap upload passes the build (empty token, org or project, or zero maps)" in milestone Engineering Health: the four skip cases with file and line, the effect, two fix options, the note that Phase 2 keeps the workflows unchanged. Env var names only.
- `/docs/infrastructure`: the last Sentry bullet became two bullets, "A failed upload fails the build." and "A skipped upload does not fail the build." (lane commit `3b088805`). The workflows are unchanged against `origin/develop`.
- Task 2 (lane commit `4ac3350c`): the three OAuth lines name Discord, GitHub and Google. The statement-by-statement re-check found eight more contradictions:
  - the `season` sentence: `h1_event_progress` links to `h1_event`, not `h1_season` (three sentences)
  - `last_updated` null: an unfinished import, not a pre-seeded row
  - `banned`: sessions are revoked on the next `/profile` request
  - "constant-time" and "O(1)" lookup of the API key hash: an indexed lookup
  - the lease claim also succeeds while `lease_until` is unset
  - the read-path diagram omitted `h1_statistic` and overstated "All h1_* tables" for `/archives`
  - the Prisma client is cached in every environment, not only in development
  - `providerId` examples omitted `"google"`
- Sweep 3 now holds G4 (`cannot pin a build without its maps|Discord and GitHub`): 0 hit lines. `src/app/docs/authentication/page.mdx` lines 12, 22 and 191 still name two providers: out of scope, DOCS-03 (D-07), recorded.
- Record: `## Gap closure: /docs/database` with 28 rows and the only `Page database: CHECKED` line; the plan 02-07 closing line is prose; the nine CHECKED lines are each present once. A range check confirmed every cited `path:line` is inside its file.

## Task Commits

1. **Task 1: Sentry bullets, issue #686, sweep 3 G4 (first pattern)** - `3b088805` (docs, lane `docs/02-gap-closure`)
2. **Task 2: database page re-check and OAuth provider lists** - `4ac3350c` (docs, lane `docs/02-gap-closure`)

**Plan metadata:** the GSD-tree commit with this SUMMARY and the page-check record, then the commit for STATE.md and ROADMAP.md.

## Files Created/Modified

- `src/app/docs/infrastructure/page.mdx` - last Sentry bullet split in two (lane)
- `src/app/docs/database/page.mdx` - 15 lines changed (lane)
- `src/__tests__/unit/_meta/docsRetiredStrings.test.mjs` - sweep 3 group G4 (lane)
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md` - new gap-closure section; the plan 02-07 closing line is prose

## Decisions Made

See `key-decisions`. DOCS-02 stays unchecked until plan 02-22 (D-33).

## Deviations from Plan

None - plan executed as written. Notes: `npm run lint:fix` prints 321 warnings and 0 errors, all pre-existing and outside the changed files. The lane server (127.0.0.1:3100, stub env, started by this plan) served 200 on `/docs/infrastructure` and was stopped after the Task 1 verify; port 3100 is free. The commit trailer is `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Total deviations:** 0 auto-fixed. **Impact on plan:** none.

## Issues Encountered

- `prisma/schema.prisma:101` still carries the comment "also used as the key" on `ApiKey.id`; the code generates a separate random UUID key (`src/features/account/actions.mjs:93`). The page is correct; the schema comment is stale. A code comment outside DOCS-02, not changed.
- `User.username` is documented as "intended to hold the user's Discord username"; no code in `src` reads or writes it. The hedged wording is kept.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lane `docs/02-gap-closure` head is `4ac3350c849e912b38885e6d411f88512bcdeaab`; plan 02-25 (infrastructure page re-check) adds commits on top. Plan 02-25 must keep the two Sentry bullets and the `#686` reference (sweep 3 and the Task 1 verify read them).
- Plan 02-19 render check: /docs/infrastructure (two Sentry bullets after the code block; the bullet text holds inline code spans), /docs/database (the lifecycle fence read-path node now has two lines and feeds three routes; the `last_updated` table row; the Account section provider names).
- DOCS-02 stays unchecked until plan 02-22 (D-33).

## Self-Check: PASSED

Lane commits `3b088805` and `4ac3350c` are ancestors of the lane HEAD, the lane tree is clean, Task 1 verifies 1-3 and Task 2 verifies 1-2 exit 0, `_meta` unit tests pass (35), the database fences parse, issue #686 is open, `git diff --stat origin/develop HEAD -- .github/workflows` prints nothing, and port 3100 is free.

---
*Phase: 02-docs-accuracy-operational-housekeeping*
*Completed: 2026-11-15*
