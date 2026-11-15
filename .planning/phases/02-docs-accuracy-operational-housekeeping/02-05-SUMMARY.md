---
phase: 02-docs-accuracy-operational-housekeeping
plan: 05
subsystem: docs
tags: [mermaid, docs, worker-heartbeat, lease, browser-render-check, chrome-devtools]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Plan 02-02 lease-model facts in AGENTS.md and the codebase maps; the 02-DOCS-PAGE-CHECK.md format"
provides:
  - "The /docs/architecture diagram with a lease node, a detail panel and flow membership (PR #665)"
  - "Corrected cadence, snapshot flow and seed path on /docs/architecture"
  - "The GET update route and the lease-row push baseline on /docs and /docs/notifications"
  - "02-MERMAID-RENDER.md: dev render of 5 diagrams x 2 widths, Verdict: RENDERED"
  - "Three page-check sections (architecture, overview, notifications)"
affects: [02-15, 02-11, 02-12]

status: complete
actuals:
  tokens: 7662
  tasks: 3
  commits: 5
plan_head_before: ca86b4563de9b8c0e3f8b90c6fa935dc6ffd87ab
plan_head_after: cde8f5f5aff5af9c93df0d55aee4bdc952b36679

tech-stack:
  added: []
  patterns:
    - "Browser render check recorded from the orchestrator's chrome-devtools measurements, with the node-ID rule stated"

key-files:
  created:
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-MERMAID-RENDER.md
  modified:
    - src/app/docs/architecture/dataFlowDefinition.mjs
    - src/app/docs/architecture/dataFlowConfig.mjs
    - src/app/docs/architecture/page.mdx
    - src/app/docs/page.mdx
    - src/app/docs/overviewConfig.mjs
    - src/app/docs/overviewDefinition.mjs
    - src/app/docs/notifications/page.mdx
    - src/app/docs/notifications/notificationFlowConfig.mjs
    - src/app/docs/notifications/pushFlowConfig.mjs
    - CHANGELOG.md
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md

key-decisions:
  - "The five rendered diagrams are proven in a real browser (Chrome 157, mermaid 12.3.0) at 1440 px and 768 px before the PR; the staging re-check of the production build stays plan 02-15"
  - "DOCS-03 drift on the notifications diagrams (update route labelled POST, ~20s labels) is left unchanged by D-07 and recorded in the page check"

requirements-completed: [DOCS-02]

duration: 15min (Task 3 continuation; Tasks 1 and 2 ran in earlier sessions)
completed: 2026-11-15
---

# Phase 2 Plan 05: Rendered-diagram docs pages Summary

**The poller lease is a node in the /docs/architecture Mermaid diagram, the GET update route and the lease-row push baseline are correct on /docs and /docs/notifications, and all five diagrams are proven to render in Chrome 157 under mermaid 12.3.0, merged as PR #665.**

## Performance

- **Duration:** about 15 min for the Task 3 continuation (earlier sessions did Tasks 1 and 2)
- **Completed:** 2026-11-15T02:31Z
- **Tasks:** 3 (Task 2 was a checkpoint, resolved by the orchestrator)
- **Files modified:** 11 (9 docs source files, CHANGELOG.md, the page-check record), 1 file created (the render record)

## Accomplishments

- /docs/architecture: node `lease` (edge `worker --> lease`), `details.lease` (60 s TTL, standby answer, `prev_events`), `lease` in `flows.live` and `flows.snapshot`; `flows.snapshot` no longer lists `h1_statistic` and `h1_event_progress`; the fixed 15 s and 5-15 s intervals now read `UPDATE_INTERVAL`; the seed node names `prisma/seed/seed.mjs` and the file list ends at `season-161.json`.
- /docs and /docs/notifications: the update route is a GET with a Bearer key and POST answers 405; the push baseline is `worker_heartbeat.prev_events`; the `db`, `api_rb` and `worker` overview panels and the worker node label lost their retired text.
- D-23 render proof: 3 pages x 2 widths, 5 diagrams, 0 missing nodes, 0 render errors; the `lease` panel text and both flow highlights were read in the browser. `Verdict: RENDERED`.
- Page-check sections for the three pages, each bound to lane commit `0f2a2432`.

## Task Commits

Task commits were made in the lane `docs-02-diagram-pages` (branch `docs/02-diagram-pages`). PR #665 rebase-merged them into `develop`, so the hashes on `develop` differ.

1. **Task 1: Tracer, the lease reaches the three rendered-diagram pages** - lane `5ba85e93`, `ef2ca449`, `589b8743`, `0f2a2432`; on develop `bbced090`, `71e61cdf`, `d51b1221`, `05d9837f`
2. **Task 2: Render the five diagrams in a real browser** - no commit (checkpoint, resolved by the orchestrator)
3. **Task 3: Render record, page checks, PR** - lane `cde8f5f5` (CHANGELOG), on develop `c46001d0`; the records are in the plan metadata commit

**PR:** https://github.com/elfensky/helldivers.bot/pull/665 (head `cde8f5f5aff5af9c93df0d55aee4bdc952b36679`, state MERGED). Required checks `Test & Build`, `Visual Regression` and `Review Dependencies`, plus CodeQL and both Analyze jobs, passed. No review was requested (`reviewDecision` empty). The remote branch is deleted, the lane worktree and the local branch are removed, the lane server (PID 58696, :3100) is stopped.

**Plan metadata:** see the `docs(02-05)` commit that carries this file.

## Files Created/Modified

- `src/app/docs/architecture/dataFlowDefinition.mjs`, `dataFlowConfig.mjs`, `page.mdx` - lease node, details, flows, cadence and seed text
- `src/app/docs/page.mdx`, `overviewConfig.mjs`, `overviewDefinition.mjs` - data-flow description, GET route, worker and db panels, worker label
- `src/app/docs/notifications/page.mdx`, `notificationFlowConfig.mjs`, `pushFlowConfig.mjs` - push baseline in the lease row
- `CHANGELOG.md` - one `### Changed` note under `## Unreleased`; no version bump
- `02-MERMAID-RENDER.md` - dev render record; plan 02-15 appends the staging lines
- `02-DOCS-PAGE-CHECK.md` - `/docs/architecture`, `/docs (overview)` and `/docs/notifications` sections

## Decisions Made

- The render record uses the node-ID rule `flowchart-<nodeId>-<n>` on `g.node[id]` inside each diagram's own svg, the same rule `MermaidDiagram.jsx:17` uses. Mermaid 12.3.0 also prefixes the diagram id (`mermaid-<diagram>-<n>-`).
- The lane commit in both records is `0f2a2432`, the last commit that touched `src/app/docs`; the CHANGELOG commit does not touch the docs files, so the docs-diff checks hold.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Extra stale text on the overview page**
- **Found during:** Task 1 (earlier executor)
- **Issue:** `overviewConfig.mjs` panels `db`, `api_rb` and `worker` and the `overviewDefinition.mjs` worker label carried retired text (two-table strategy, raw rebroadcast tables, "every 10-20 seconds"). D-07 allows the lease and cadence lines on this page, and these were the same drift.
- **Fix:** Rewritten to the normalized-table and `UPDATE_INTERVAL` facts.
- **Files modified:** `src/app/docs/overviewConfig.mjs`, `src/app/docs/overviewDefinition.mjs`
- **Committed in:** lane `ef2ca449`, `0f2a2432`

**2. [Rule 1 - Bug] Push table row on the notifications page**
- **Found during:** Task 1 (earlier executor)
- **Issue:** The row `Reset: On server restart (ok)` contradicted the lease-row baseline.
- **Fix:** Row `Baseline: Lease row, survives restarts`.
- **Files modified:** `src/app/docs/notifications/notificationFlowConfig.mjs`
- **Committed in:** lane `ef2ca449`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug). Both are lease or cadence text on the pages in scope.
**Impact on plan:** No scope creep. No code, schema or `_diagram.mjs` change.

## Issues Encountered

- `gh pr checks 665 --watch --required` reported "no required checks reported" right after the PR was created, because the checks were still registering. `gh pr checks 665 --watch` then ran to completion with all six checks passing.
- During the browser check, the first `Live Polling` click hit a stale accessibility uid; the orchestrator repeated it after a fresh snapshot (recorded in `02-MERMAID-RENDER.md`).

## Known Stubs

None.

## Items for Andrei

- DOCS-03, unchanged by D-07: the three notifications diagrams label the update route `POST /api/h1/update` (`src/app/docs/notifications/inAppFlowDefinition.mjs:7`, `pushFlowDefinition.mjs:4`, `inAppFlowConfig.mjs:36`, `notificationFlowConfig.mjs:37`), but the worker calls it with GET (`public/workers/cronLogic.js:30`). The `~20s` labels (`notificationFlowDefinition.mjs:5`, `inAppFlowDefinition.mjs:6`) match the deployed 20 s value but are fixed numbers. A later plan or a DOCS-03 task should fix them.
- Side note: `.example.env` holds a UUID-shaped `UPDATE_KEY` example value. It is a committed example file; no action taken.

## Next Phase Readiness

- Plan 02-15 appends the staging lines to `02-MERMAID-RENDER.md` after a production-build check of the same three pages; release 2 (plan 02-11) depends on it.
- Plans 02-06, 02-07 and 02-08 (text-fence parse check, data-flow, database, testing, infrastructure pages) are unblocked by this plan's page-check format.

## Self-Check: PASSED

- `02-MERMAID-RENDER.md` exists; the render verify (six PASS lines, one `Lane commit:`, docs files unchanged since it, exactly one `Verdict: RENDERED`) passed before the lane was removed.
- The three page-check sections each carry a `Lane commit:` line, cite at least 2 repo files that exist in the lane, and the docs diff since that commit is empty; all passed before the lane was removed.
- Lane verify chain before the push: `npm run lint` (0 errors), `npm run typecheck`, `npm run test:unit` (199 files, 2103 tests passed), `npm run build` (rc 0, no "Failed to compile").
- PR #665 state `MERGED`; `gh pr list --state merged --head docs/02-diagram-pages` returns 1; `git branch --list docs/02-diagram-pages` prints nothing; nothing listens on :3100.

---
*Phase: 02-docs-accuracy-operational-housekeeping*
*Completed: 2026-11-15*
