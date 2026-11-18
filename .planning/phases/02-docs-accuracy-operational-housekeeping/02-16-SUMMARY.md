---
phase: 02-docs-accuracy-operational-housekeeping
plan: 16
subsystem: docs
tags: [docs, mermaid, serwist, prisma, nextjs-mdx, vitest]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "02-12 (fence guard, Final check) and the plan 02-05 page-check record"
provides:
  - "Architecture page states the immediate service-worker activation and the exact Serwist strategy classes"
  - "h1_* panels, overview edge, Dashboard path and OAuth list that match the code"
  - "Sweep 3 (groups G1, G2) in docsRetiredStrings.test.mjs"
  - "Gap-closure re-check sections for /docs/architecture and /docs (overview) in 02-DOCS-PAGE-CHECK.md"
affects: [02-17, 02-23, 02-24, 02-18, 02-25, 02-19]

plan_head_before: 74b6908802a0d3331afadbc940777689c48fbe08
plan_head_after: 5087ee615207218dc4354202a9d435731c3d85cf

actuals:
  tokens: 6600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns: ["Sweep regex groups grow per gap-closure plan; a group is added only after its sites are fixed"]

key-files:
  created: []
  modified:
    - src/app/docs/architecture/page.mdx
    - src/app/docs/architecture/dataFlowConfig.mjs
    - src/app/docs/architecture/dataFlowDefinition.mjs
    - src/app/docs/overviewConfig.mjs
    - src/app/docs/overviewDefinition.mjs
    - src/__tests__/unit/_meta/docsRetiredStrings.test.mjs
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md

key-decisions:
  - "Caching clause follows the lane's installed @serwist/next 9.5.13: one sentence per strategy class, no group under two strategies"
  - "Notifications link has no fragment; no heading id or rehype plugin added"
  - "api_status and api_snapshot edges into worker stay: that diagram has no update-route node"
  - "The two 02-UI-REVIEW.md copy items on /docs stay unedited (out of scope, DOCS-03)"

requirements-completed: [DOCS-02]

coverage:
  - id: D1
    description: "Served /docs/architecture states the immediate service-worker activation, names exactly the Serwist strategy classes, and links Notifications without a fragment"
    requirement: DOCS-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/_meta/docsRetiredStrings.test.mjs#sweep 3"
        status: pass
      - kind: other
        ref: "curl http://127.0.0.1:3100/docs/architecture holds 'activates as soon as it installs' and neither retired string"
        status: pass
    human_judgment: false
  - id: D2
    description: "h1_* detail panels match prisma/schema.prisma; overview draws api_update --> hd1; Dashboard subtitle and OAuth providers match the code"
    requirement: DOCS-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/app/docs (diagram contract) and sweep 3 group G2"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rendered look of the changed diagrams (new edges, tags) in the browser"
    requirement: DOCS-02
    verification: []
    human_judgment: true
    rationale: "Plan 02-19 owns the diagram render check; this plan has no browser tool"
  - id: D4
    description: "Page-check record re-checks both surfaces at a lane commit and replaces the earlier CHECKED claims"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 3 verify 1: closing lines unique, bound to lane commit 5087ee61, cited files exist"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-15
status: complete
---

# Phase 2 Plan 16: Architecture and overview gap closure Summary

**Architecture and overview docs corrected against the code: immediate service-worker activation with the exact Serwist strategy groups, schema-true h1_* panels, the `api_update --> hd1` edge, the Dashboard path and three OAuth providers, guarded by sweep 3 and a re-check record bound to lane commit 5087ee61.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-15T19:33:01Z
- **Completed:** 2026-11-15T19:41:00Z
- **Tasks:** 3
- **Files modified:** 7 (6 in the lane, 1 record)

## Accomplishments

- Tracer: the served `/docs/architecture` page holds "activates as soon as it installs" and neither retired string (curl against the lane server on :3100, stopped afterwards).
- Panels and edges: all `bucket` rows are `Int (window start)`, `season_duration` is an `Int` scalar, `h1_status` lists `time` and `points / points_taken` and no `players`, `h1_statistic` lists `players`, `h1_event` is keyed `(type, event_id)`, `h1_event_progress` is keyed `(type, event_id, bucket)` with no `points_max` row.
- Overview: `api_update --> hd1` replaces `worker --> hd1`; Dashboard subtitle is `src/app/page.jsx`; Auth API names Discord, GitHub and Google.
- Sweep 3 holds groups G1 and G2 and reads `overviewDefinition.mjs`. RED run before the Task 2 edits reported 9 hit lines; GREEN after: 0.
- Two gap-closure sections in `02-DOCS-PAGE-CHECK.md`, each closed by the only `Page architecture: CHECKED` / `Page overview: CHECKED` line; the plan 02-05 closing lines are now prose.

## Serwist evidence (Task 1)

Installed `@serwist/next` version: 9.5.13 (matches the plan; no group changed). Strategy classes constructed in `node_modules/@serwist/next/dist/index.worker.mjs` plus `src/sw.js`: NetworkFirst, CacheFirst, StaleWhileRevalidate, NetworkOnly. No CacheOnly. Matched `defaultCache` entries (`cacheName`, handler, file:line of `index.worker.mjs`):

| Strategy | Entries the page clause covers |
|---|---|
| NetworkFirst | `next-data` (:129), `static-data-assets` for `.json`/`.xml`/`.csv` (:140), RSC prefetch and RSC requests (:168, :178), pages HTML (:188); also `others` (:198) and `cross-origin` (:208), which the clause does not name |
| CacheFirst | `next-static-js-assets` for `/_next/static` `.js` (:63), `static-audio-assets` (:85), `static-video-assets` (:96); also `google-fonts-webfonts` (:19, cross-origin, not named) |
| StaleWhileRevalidate | `static-image-assets` (:52), `static-font-assets` (:41), `static-js-assets` (:107), `static-style-assets` (:118); also `google-fonts-stylesheets` (:30) and `next-image` (:74), not named |
| NetworkOnly | `src/sw.js:11-14` for same-origin `/api/*`, ahead of `defaultCache`; `defaultCache` also has `/api/auth/` (:151) and a GET catch-all (:219) |

## Task Commits

All three commits are in the lane `docs/02-gap-closure` (worktree `docs-02-gap-closure`):

1. **Task 1: Tracer, service-worker sentence and sweep 3 (G1)** - `e47b6935` (docs)
2. **Task 2: h1_* panels, overview edge, Dashboard path, OAuth list, sweep 3 (G2)** - `10ce7f50` (docs)
3. **Task 3: Fix drift found in the re-check** - `5087ee61` (docs)

**Plan metadata:** the GSD-tree commit that holds this SUMMARY, STATE.md, ROADMAP.md and the page-check record.

## Files Created/Modified

- `src/app/docs/architecture/page.mdx` - PWA paragraph: strategy sentences, immediate activation, fragment-free link
- `src/app/docs/architecture/dataFlowConfig.mjs` - h1_* panels, fe_live and fe_archives reads, seed wording, flows
- `src/app/docs/architecture/dataFlowDefinition.mjs` - edges `h1_statistic --> fe_live` and `--> fe_archives`; edge `h1_event_progress --> fe_archives` removed
- `src/app/docs/overviewDefinition.mjs` - `api_update --> hd1`
- `src/app/docs/overviewConfig.mjs` - Dashboard subtitle, Auth API providers
- `src/__tests__/unit/_meta/docsRetiredStrings.test.mjs` - sweep 3, `overviewDefinition.mjs` in `PAGE_FILES`
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md` - two gap-closure sections

## Decisions Made

See `key-decisions`. The judgment rows (worker edges stay; UI-review copy items out of scope, DOCS-03) are recorded in the page-check sections.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] h1_event_progress is not read by the app, yet the diagram said archives use it**
- **Found during:** Task 3 (re-check, D-01 source order)
- **Issue:** The `h1_event_progress` panel ("Used by archives to show event progression charts"), its tag, the `fe_archives` panel and tag, the `read_archives` flow and the edge `h1_event_progress --> fe_archives` claim a reader that does not exist. Nothing in `src/` reads the table; only `scripts/analysis/lib/dataset.mjs` does.
- **Fix:** Panel sentence and tag say the app only writes it and the analysis scripts read it; the edge, flow entry and `fe_archives` text no longer name it. Node ID kept.
- **Files modified:** `src/app/docs/architecture/dataFlowConfig.mjs`, `src/app/docs/architecture/dataFlowDefinition.mjs`
- **Verification:** diagram contract test, sweep 3, fence script pass
- **Committed in:** `5087ee61`

**2. [Rule 1 - Bug] fe_live and fe_archives omitted h1_statistic, the source of player counts**
- **Found during:** Task 3
- **Issue:** Both panels said they read `h1_status` and render player counts; `players` lives on `h1_statistic` (`getCampaign`).
- **Fix:** Edges `h1_statistic --> fe_live` and `--> fe_archives`, flow entries, panel text and tags.
- **Files modified:** same two files
- **Verification:** diagram contract test passes
- **Committed in:** `5087ee61`

**3. [Rule 1 - Bug] Seed panels said the script uses the live-update pipeline**
- **Found during:** Task 3
- **Issue:** `prisma/seed/seed.mjs` writes `h1_season`, `h1_status` and `h1_event` with an inlined copy of the bucket math.
- **Fix:** Both panels say so.
- **Files modified:** `dataFlowConfig.mjs`
- **Committed in:** `5087ee61`

---

**Total deviations:** 3 auto-fixed (3 Rule 1), all inside the six surface files, no node ID changed.
**Impact on plan:** The fixes widen the diagram change set (two new edges, one removed edge). Plan 02-19's render check must look at the architecture diagram's Frontend subgraph.

## Issues Encountered

- `npm run lint:fix` prints 321 warnings and 0 errors, all pre-existing and outside the changed files.
- `<automated>` commands in the plan `cd` into the lane, which is outside the GSD tree. The project root pin names the lane as the carve-out, so this is intended.
- The hd1 overview panel says the official API "Updates roughly every second". The repo cannot confirm it; recorded in the page-check as not checkable and left unchanged.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lane `docs/02-gap-closure` head is `5087ee615207218dc4354202a9d435731c3d85cf`; plans 02-17, 02-23, 02-24, 02-18 and 02-25 add commits on top. Sweep 3 groups G3 and G4 are still to add.
- DOCS-02 stays unchecked until plan 02-22 (D-33).
- Plan 02-19 must render the architecture diagram to check the new Frontend edges.

## Self-Check: PASSED

All six lane files exist, lane commits `e47b6935`, `10ce7f50` and `5087ee61` are ancestors of lane HEAD, the lane working tree is clean, the lane server on :3100 is stopped, all Task verify commands exit 0, and no acceptance criterion fails.

---
*Phase: 02-docs-accuracy-operational-housekeeping*
*Completed: 2026-11-15*
