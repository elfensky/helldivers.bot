---
phase: 02-docs-accuracy-operational-housekeeping
plan: 07
subsystem: docs
tags: [docs, prisma, database, testing, mermaid, worker-heartbeat, api-rate-limit]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Plan 02-06 scripts/check-mermaid-fences.mjs and its known database fence@73 failure"
provides:
  - "/docs/database matching prisma/schema.prisma (PR #667)"
  - "/docs/testing with the layout stated as one rule (PR #667)"
  - "Every text fence of the five DOCS-02 pages parses: check-mermaid-fences.mjs exits 0"
  - "## /docs/database and ## /docs/testing sections in 02-DOCS-PAGE-CHECK.md"
affects: [02-08, 02-11, 02-12, 03-house-01]

status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 3
plan_head_before: 810197fc
plan_head_after: 755ca0955e3f4f18ef172b5f5d1192788139e435

tech-stack:
  added: []
  patterns:
    - "Layout documented as one rule that names the enforcing test, so a later layout change edits one paragraph"

key-files:
  created: []
  modified:
    - src/app/docs/database/page.mdx
    - src/app/docs/testing/page.mdx
    - CHANGELOG.md
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md

key-decisions:
  - "api_rate_limit gets its own section 8 (Rate Limiting) and Index and Constraint Summary stays section 9, so the numbering has no gap"
  - "The testing page now has no mermaid fence; the directory fence went with the enumerated tree (D-11). The fence check runs over all five pages, so its zero-fence guard does not trip"
  - "The root config table on /docs/testing stays and gains the vitest.visual.config.mjs row alignment"

requirements-completed: [DOCS-02]

duration: 10 min
completed: 2026-11-15
---

# Phase 2 Plan 07: Database and testing docs Summary

**/docs/database now lists exactly the models of `prisma/schema.prisma` (no `Review`/`App`, the `worker_heartbeat` lease columns, `api_rate_limit`, `TIMESTAMP(3)`), the ER fence parses under mermaid 12, and /docs/testing states the unit-test layout as one rule that names `mirrorTree.test.mjs`; merged as PR #667.**

## Performance

- **Duration:** about 10 min (02:51Z to 03:01Z)
- **Tasks:** 3
- **Files:** 3 in the PR (two pages, CHANGELOG.md) plus the page-check record

## Accomplishments

- Fail-first run of `node scripts/check-mermaid-fences.mjs`: exit 1, only `database/page.mdx` fence@73 failed (`PK-FK`). After the edit: `checked 8 fences in 5 files`, exit 0.
- /docs/database: `Review` and `App` removed from the ER fence, the User relation table and the sections; later sections renumbered (1 to 9, no gap). `worker_heartbeat` documents all ten columns and the lease behaviour (`cron_api_poller`, 60 s TTL, holder-guarded state, link to Data Flow "Poller lease"). New `## 8. Rate Limiting` / `### api_rate_limit` with the composite `@@id`, `window_start` as `Int`, and the index rows. All 19 `TIMESTAMPTZ` cells became `TIMESTAMP(3)`; a `### Timestamp type` paragraph states naive UTC. The `prisma.config.mjs` and `db.js` samples copy the files.
- /docs/testing: the mermaid directory list, the enumerated tree and the naming table are replaced by one paragraph under `## Directory Structure`. The audience line, the euraika/aegis sentence and the instruction aimed at AI assistants are gone. The scripts table, coverage excludes, smoke environment variables (`TEST_SERVER_URL`, `SMOKE_ALLOW_SKIP`), global-mock list (`vi.resetAllMocks()`) and the CI job reference (`check-ci.yml`) match the files.
- Both page-check sections are recorded with lane commit `3387d4be5c01216f99b4c392ad9c7f93792fb23e` (pre-rebase; the rebase did not change the two pages).

## Task Commits

Made in the lane `docs-02-database-testing` (branch `docs/02-database-testing`). PR #667 rebase-merged them into `develop`, so the hashes there differ.

1. **Task 1 (tracer): database page** - lane `68972b9a`, on develop `75a124ca`
2. **Task 2: testing page** - lane `3387d4be`, on develop `cf5519be` (the page-check sections are in the plan metadata commit)
3. **Task 3: CHANGELOG, verify chain, PR** - lane `755ca095`, on develop `0690b65f`

**PR:** https://github.com/elfensky/helldivers.bot/pull/667 (head `755ca0955e3f4f18ef172b5f5d1192788139e435`, state MERGED). Checks `Test & Build`, `Visual Regression`, `Review Dependencies`, CodeQL and both Analyze jobs passed. No review was requested (`reviewDecision` empty, 0 reviews, 0 comments). The remote branch is deleted; the lane worktree and local branch are removed. No server was started.

**Plan metadata:** see the `docs(02-07)` commit that carries this file.

## Files Created/Modified

- `src/app/docs/database/page.mdx` - schema-accurate models, lease and rate-limit tables, timestamp type, samples
- `src/app/docs/testing/page.mdx` - one-rule layout, scripts, coverage, mocks, smoke, CI reference
- `CHANGELOG.md` - one `### Changed` bullet each for the two pages under `## Unreleased`; no version bump
- `02-DOCS-PAGE-CHECK.md` - `## /docs/database` and `## /docs/testing`

## Decisions Made

- Placed `api_rate_limit` in its own section 8 so `Index and Constraint Summary` keeps number 9 and no section number gaps.
- Did not touch `prisma/schema.prisma` or any migration (`git diff origin/develop...HEAD -- prisma/` was empty).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Further drift beyond the plan's named lines**
- **Found during:** Tasks 1 and 2 (the plan asks for a full re-read)
- **Issue:** Database: the runtime client sample lacked `getConnectionString()`; the `worker_heartbeat` "Used by" line named `cron.js`. Testing: three configs, not two; `vi.clearAllMocks()` in the setup is `vi.resetAllMocks()`; `next/cache`, `next/server`, `LiveDataContext` and `react-slot-counter` mocks missing; the smoke base URL was fixed instead of `TEST_SERVER_URL`.
- **Fix:** Rewrote those lines against `src/db/db.js`, `src/update/lease.mjs`, `vitest.setup.mjs` and `smoke.test.mjs`.
- **Files modified:** the two pages
- **Commits:** lane `68972b9a`, `3387d4be`

---

**Total deviations:** 1 auto-fixed (Rule 1, page text only). **Impact:** none on scope; no code, schema or migration change.

## Issues Encountered

- `gh pr checks 667 --watch --required` answered "no required checks reported" because the checks had not started yet; `gh pr checks 667 --watch` without `--required` waited for all six and all passed.

## Known Stubs

None.

## Items for Andrei

- `npm run lint` reports 321 warnings and 0 errors; none come from this plan's files.
- The repo's pre-existing issue from 02-06 (the `X-Worker-Startup` header that nothing reads) is unchanged.

## Next Phase Readiness

- Plan 02-08 can run `node scripts/check-mermaid-fences.mjs` and it exits 0 for all five pages.
- Phase 3 (HOUSE-01) changes the layout rule in one paragraph of `/docs/testing`.
- Release 2 (plan 02-11) re-reads both pages at the release tag against the page-check record.

## Self-Check: PASSED

- Commits `75a124ca`, `cf5519be`, `0690b65f` are on `origin/develop` (PR #667 MERGED; `gh pr list --state merged --head docs/02-database-testing` returns 1; remote branch deleted; `git branch --list docs/02-database-testing` prints nothing).
- Task 1 verify commands passed: fence check exit 0, retired-term grep count 0, every schema model and lease/rate-limit column on the page, `##` numbers 1 to 9, `prisma/` diff empty.
- Task 2 verify commands passed: retired-reference grep 0, `mirrorTree.test.mjs` present, no `── ` tree, fences parse; the page-check verify printed `VERIFY_PASS` (Lane commit present, pages unchanged since it, 2 or more cited files that exist in the lane) before the lane was removed.
- Lane verify chain before the push: `npm run lint` (0 errors), `npm run typecheck`, `npm run test:unit` (199 files, 2103 tests passed), `npm run build` (completed).

---
*Phase: 02-docs-accuracy-operational-housekeeping*
*Completed: 2026-11-15*
