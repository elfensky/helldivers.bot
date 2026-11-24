---
phase: 02-docs-accuracy-operational-housekeeping
plan: 06
subsystem: docs
tags: [mermaid, docs, data-flow, worker-heartbeat, lease, migrate-on-start, jsdom]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Plan 02-05 page-check format and the merged rendered-diagram pages (PR #665)"
provides:
  - "scripts/check-mermaid-fences.mjs: offline mermaid.parse check for docs text fences (reused by plans 02-07, 02-08, 02-11)"
  - "/docs/data-flow matching the lease-era worker pipeline (PR #666)"
  - "A /docs/data-flow section in 02-DOCS-PAGE-CHECK.md with the fail-first output"
affects: [02-07, 02-08, 02-11, 02-12]

status: complete
actuals:
  tokens: 9400
  tasks: 3
  commits: 3
plan_head_before: c46001d04fa64d0e6c138351f965eb833bece007
plan_head_after: 62faa82f307eb39670e008810febf2566f640b21

tech-stack:
  added: []
  patterns:
    - "Promise-form error capture (mermaid.parse(...).then(() => null, (e) => e)) instead of try/catch in a script"
    - "jsdom window and document on globalThis before the dynamic mermaid import"

key-files:
  created:
    - scripts/check-mermaid-fences.mjs
  modified:
    - src/app/docs/data-flow/page.mdx
    - CHANGELOG.md
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md

key-decisions:
  - "The fence check imports only installed jsdom and mermaid; no dependency was added and no npm script was created"
  - "The page documents X-Worker-Startup as sent on the first poll but not acted on by the update route, because nothing in src/ reads the header"
  - "Section 3 and 4 were rewritten against status.mjs and season.mjs (real upsert* names, step order, which failures throw, warnings), not only the plan's named lines"

requirements-completed: [DOCS-02]

duration: 9 min
completed: 2026-11-15
---

# Phase 2 Plan 06: Data-flow docs and fence check Summary

**An offline `mermaid.parse` check for the docs text fences (it fails on the known-bad database ER fence and on zero fences), and /docs/data-flow rewritten to the lease-era worker pipeline with migrate-on-start first, merged as PR #666.**

## Performance

- **Duration:** about 9 min (02:33Z to 02:42Z)
- **Tasks:** 3
- **Files:** 1 created, 3 modified (the page, CHANGELOG.md, the page-check record)

## Accomplishments

- `scripts/check-mermaid-fences.mjs` prints one `OK`/`FAIL <file> fence@<line>` line per fence and `checked <N> fences in <M> files`. It exits 1 on a failed fence or on zero fences. A read error throws. Fail-first run before any page edit: exit 1, only `database/page.mdx` fence@73 failed (`PK-FK`), the other 8 fences OK. A file with no fence (`notifications/page.mdx`) exits 1.
- /docs/data-flow section 2: startup fence and text now run `register()` to `initializeHelldivers1Api()` to `initializeEnvironmentVariables()` to `migrateOrWait()` (advisory lock, retries 30 s / 60 s / 2 min / 5 min, before the worker) to `initializeWorker()` with the `WORKER_ENABLED` branch. The sample is the Bearer-header GET with `X-Worker-Startup` on the first poll and the optional GlitchTip heartbeat. The exit handler (`process.exit(1)` outside shutdown) and the SIGINT/SIGTERM `shuttingDown` flag are documented. A 13-line `### Poller lease` subsection links `/docs/database` and `/docs/infrastructure`.
- Section 3 intro and steps match `status.mjs`: key check, 403 opt-out, lease claim and early standby, real `upsert*` names, step order, only event progress goes to `warnings`.
- Section 4: new "Where `updateSeason` runs" (every poll with `protectedBucket`, closing pass, on demand). "On-demand invocation" and "Frontend on-demand fetching" are kept and list `getCampaignOrSeed`, `/api/h1/rebroadcast`, `backfillAndRetry` via `backfillSeason`, `reseedSeason`. The closing pass reads its season from the lease row and survives restarts and handovers.
- Sections 5 to 7: `worker_heartbeat` noted, `UPDATE_INTERVAL` cadence, current `bucketing.mjs` sample, and the fetch layer as it is (`HD1_API_URL`, `fetchWithUntrustedCert`, three throw cases).

## Task Commits

All three task commits were made in the lane `docs-02-data-flow` (branch `docs/02-data-flow`). PR #666 rebase-merged them into `develop`, so the hashes there differ.

1. **Task 1 (tracer): fence check, startup chain, lease** - lane `9ae46eae`, on develop `338fc265`
2. **Task 2: rest of the page and the record** - lane `12c79531`, on develop `288f4338` (the page-check section is in the plan metadata commit)
3. **Task 3: CHANGELOG, verify chain, PR** - lane `62faa82f`, on develop `810197fc`

**PR:** https://github.com/elfensky/helldivers.bot/pull/666 (head `62faa82f307eb39670e008810febf2566f640b21`, state MERGED). Checks `Test & Build`, `Visual Regression`, `Review Dependencies`, CodeQL and both Analyze jobs passed. No review was requested (`reviewDecision` empty). The remote branch is deleted and the lane worktree and local branch are removed. No server was started.

**Plan metadata:** see the `docs(02-06)` commit that carries this file.

## Files Created/Modified

- `scripts/check-mermaid-fences.mjs` - the fence check
- `src/app/docs/data-flow/page.mdx` - sections 1 to 7 corrected, `### Poller lease` added
- `CHANGELOG.md` - one `### Added` and one `### Changed` note under `## Unreleased`; no version bump
- `02-DOCS-PAGE-CHECK.md` - `## /docs/data-flow` section bound to lane commit `12c79531`

## Decisions Made

- The plan's tracer and the page rewrite were done in one pass, so Task 1's commit holds the script and most of the page and Task 2's commit is small (the text-version lease line). The verify commands for both tasks passed on the final state.
- Heading anchors do not exist on the docs site (`mdx-components.jsx` renders `h2`/`h3` without ids), so the page refers to sections by name, not by `#anchor`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Further drift in sections 3 to 7 beyond the plan's named lines**
- **Found during:** Task 2 (top-to-bottom read, which the plan asks for)
- **Issue:** Calls named `queryUpsert*` (real: `upsert*`), event progress ordered before `h1_status`, statistic and event-progress failures called non-fatal logging (statistic throws; event progress goes to `warnings`), `getApiURL()`/`fetchInvalidHttps` that do not exist, `season_duration` listed for `updateSeason`, "every few seconds" cadence.
- **Fix:** Rewrote the affected text against `status.mjs`, `season.mjs`, `fetch.mjs`, `bucketing.mjs`.
- **Files modified:** `src/app/docs/data-flow/page.mdx`
- **Commit:** lane `9ae46eae`

**2. [Rule 1 - Bug] Heading anchors in the new text would not resolve**
- **Found during:** Task 1
- **Issue:** First draft linked `#poller-lease`; the site has no heading ids.
- **Fix:** Plain section names.
- **Commit:** lane `9ae46eae`

---

**Total deviations:** 2 auto-fixed (both Rule 1, page text only). **Impact:** none on scope; no code, schema or `src/app/docs` component change.

## Issues Encountered

- A first `Edit` on the page failed once because the file had changed on disk; re-reading it and repeating the edit worked.
- `gh pr checks 666 --watch` ran to completion on the first call.

## Known Stubs

None.

## Items for Andrei

- `src/app/api/h1/update/route.js:26` exports `WORKER_STARTUP_HEADER` and `public/workers/cronLogic.js:33` sends `X-Worker-Startup` on the first poll, but nothing in `src/` reads the header: the "one-time startup pass" the comments describe does not exist. The page says so. Either build the pass or drop the header; no code was changed.
- `scripts/check-mermaid-fences.mjs` still fails on `src/app/docs/database/page.mdx` fence@73 by design. Plan 02-07 fixes the fence.
- `npm run lint` reports 321 warnings and 0 errors; none come from this plan's files.

## Next Phase Readiness

- Plans 02-07 and 02-08 can run `node scripts/check-mermaid-fences.mjs` on the database, infrastructure and testing pages.
- Release 2 (plan 02-11) re-reads the page at the release tag against the 02-DOCS-PAGE-CHECK.md record.

## Self-Check: PASSED

- `scripts/check-mermaid-fences.mjs` and the page exist on `origin/develop` (`338fc265`, `288f4338`, `810197fc`).
- Task 1 and 2 verify commands passed: data-flow 2 fences OK, database exit 1, notifications (zero fences) exit 1, retired-term sweeps empty, required terms present, `/usr/bin/grep -c 'try {'` prints 0, no UUID-shaped value, `### Poller lease` is 13 lines.
- Page-check verify (Lane commit present, docs files unchanged since it, 2 or more cited files that exist in the lane) printed `VERIFY_PASS` before the lane was removed.
- Lane verify chain before the push: `npm run lint` (0 errors), `npm run typecheck`, `npm run test:unit` (199 files, 2103 tests passed), `npm run build` (completed).
- PR #666 state `MERGED`; `gh pr list --state merged --head docs/02-data-flow` returns 1; the remote branch is deleted; `git branch --list docs/02-data-flow` prints nothing.

---
*Phase: 02-docs-accuracy-operational-housekeeping*
*Completed: 2026-11-15*
