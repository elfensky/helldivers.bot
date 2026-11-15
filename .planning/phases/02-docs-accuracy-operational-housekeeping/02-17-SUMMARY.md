---
phase: 02-docs-accuracy-operational-housekeeping
plan: 17
subsystem: docs
tags: [docs, mermaid, serwist, notifications, vitest]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "02-16 (lane docs/02-gap-closure, sweep 3 groups G1 and G2, gap-closure record format)"
provides:
  - "Notification worker, update-route, database and HD1 panels that say only the poller lease holder polls HD1 and does the update work"
  - "In-app flow edge hd1_api to post_update labelled 'lease holder fetches'"
  - "Manifest path public/site.webmanifest on the notifications page"
  - "Caching Strategy table with cache-first and stale-while-revalidate rows"
  - "Sweep 3 group G3 in docsRetiredStrings.test.mjs"
  - "Gap-closure re-check section for /docs/notifications in 02-DOCS-PAGE-CHECK.md"
affects: [02-23, 02-24, 02-18, 02-25, 02-19]

plan_head_before: 5087ee615207218dc4354202a9d435731c3d85cf
plan_head_after: af0f68468405149f07a25c1b03613cdfb96ac83a

actuals:
  tokens: 4300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["Sweep regex group G3 added only after its six sites were fixed (RED run reported 6 hit lines)"]

key-files:
  created: []
  modified:
    - src/app/docs/notifications/notificationFlowConfig.mjs
    - src/app/docs/notifications/inAppFlowDefinition.mjs
    - src/app/docs/notifications/inAppFlowConfig.mjs
    - src/app/docs/notifications/page.mdx
    - src/__tests__/unit/_meta/docsRetiredStrings.test.mjs
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md

key-decisions:
  - "The page makes no claim about how the service worker registers: no register option and no registration call exist in the repo"
  - "The four POST /api/h1/update labels and the ~20s node labels stay (D-07, Phase 18 DOCS-03)"
  - "Drift outside the five classes and the lease lines (themeColor, cache key name, toast position, computeMapState name) is recorded and left"

requirements-completed: [DOCS-02]

coverage:
  - id: D1
    description: "Served /docs/notifications says that only the lease holder polls HD1 and names public/site.webmanifest; guarded by sweep 3 group G3"
    requirement: DOCS-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/_meta/docsRetiredStrings.test.mjs#sweep 3"
        status: pass
      - kind: other
        ref: "curl http://127.0.0.1:3100/docs/notifications holds both lease-holder phrases and the new manifest path, and neither retired string"
        status: pass
    human_judgment: false
  - id: D2
    description: "Caching Strategy table has one row each for NetworkOnly, network-first, cache-first and stale-while-revalidate, no row lumps static files"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 2 table verify (awk over '### Caching Strategy' in page.mdx)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rendered look of the changed in-app diagram edge and the new table rows in the browser"
    requirement: DOCS-02
    verification: []
    human_judgment: true
    rationale: "Plan 02-19 owns the diagram render check; this plan has no browser tool"
  - id: D4
    description: "Page-check record re-checks the notifications surface at a lane commit and replaces the plan 02-05 CHECKED claim"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 2 verify 1: closing line unique, bound to lane commit af0f6846, cited files exist, nine CHECKED lines once each"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-15
status: complete
---

# Phase 2 Plan 17: Notifications gap closure Summary

**Notification panels, the in-app flow edge and the page now say that only the poller lease holder polls HD1, the manifest path is `public/site.webmanifest`, and the Caching Strategy table lists cache-first and stale-while-revalidate groups, guarded by sweep 3 group G3 and a re-check record bound to lane commit af0f6846.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-15T19:40:50Z
- **Completed:** 2026-11-15T19:47:00Z
- **Tasks:** 2
- **Files modified:** 6 (5 in the lane, 1 record)

## Accomplishments

- Tracer: the served `/docs/notifications` page holds "Only the poller lease holder polls the official Helldivers 1 API", "Only the poller lease holder fetches it" and `public/site.webmanifest`, and neither "Thread that polls" nor `src/app/site.webmanifest` (curl against the lane server on :3100, stopped afterwards).
- Sweep 3 group G3: the RED run reported 6 hit lines (inAppFlowConfig 1, inAppFlowDefinition 1, notificationFlowConfig 2, notifications page 2); the GREEN run reports 0 for G1 to G3.
- `worker` panel: every replica runs the thread, it calls the update route every `UPDATE_INTERVAL` seconds, and the Poll interval row says the variable is required and 20 in both stacks. The in-app flow draws `hd1_api -->|"lease holder fetches"| post_update`; its 12 node ids are unchanged.
- Caching Strategy table: the static-assets row became two rows (cache-first for `/_next/static` scripts and the site's own audio and video; stale-while-revalidate for the site's own images, fonts, other scripts and stylesheets), the same groups as the plan 02-16 clause.
- `02-DOCS-PAGE-CHECK.md` holds `## Gap closure: /docs/notifications`, closed by the only `Page notifications: CHECKED` line; the plan 02-05 closing line is now prose.

## Task Commits

Both commits are in the lane `docs/02-gap-closure` (worktree `docs-02-gap-closure`):

1. **Task 1: Tracer, lease-holder statements, manifest path, sweep 3 (G3)** - `5640870d` (docs)
2. **Task 2: Fix drift found in the re-check** - `af0f6846` (docs)

**Plan metadata:** the GSD-tree commit that holds this SUMMARY, STATE.md, ROADMAP.md and the page-check record.

## Files Created/Modified

- `src/app/docs/notifications/notificationFlowConfig.mjs` - `worker`, `update` and `db` panels
- `src/app/docs/notifications/inAppFlowDefinition.mjs` - edge from `hd1_api` into `post_update`
- `src/app/docs/notifications/inAppFlowConfig.mjs` - `hd1_api` and `post_update` panels
- `src/app/docs/notifications/page.mdx` - manifest path, service-worker paragraph, caching table
- `src/__tests__/unit/_meta/docsRetiredStrings.test.mjs` - sweep 3 group G3
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md` - notifications gap-closure section

## Decisions Made

See `key-decisions`. The deferrals and the out-of-scope items are rows in the page-check section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Service-worker paragraph claimed a `register: true` option that no code sets**
- **Found during:** Task 2 (re-check, class: service worker lifecycle)
- **Issue:** `page.mdx` said "Serwist handles registration automatically via the `register: true` config option". `serwist.config.js` has no such option and nothing under `src/` registers the worker.
- **Fix:** Sentence replaced by the `/sw.js` no-cache header that `next.config.mjs` sends, and a pointer to `src/sw.js` for `skipWaiting` and `clientsClaim`.
- **Files modified:** `src/app/docs/notifications/page.mdx`
- **Verification:** unit tests, lint, prettier check
- **Committed in:** `af0f6846`

**2. [Rule 1 - Bug] Update-route and database panels described the update as running on every call**
- **Found during:** Task 2 (lease lines)
- **Issue:** The `update` panel and sequence had no lease step; the `db` panel said "The worker writes campaign status and snapshots"; the in-app `post_update` panel had no lease step. A replica without the lease answers standby and writes nothing.
- **Fix:** Lease-holder wording, sequence step 2 `claimLease()`, and the writer named as the Update Route on the lease holder.
- **Files modified:** `notificationFlowConfig.mjs`, `inAppFlowConfig.mjs`
- **Verification:** diagram contract test passes
- **Committed in:** `af0f6846`

---

**Total deviations:** 2 auto-fixed (2 Rule 1), all inside the notifications files, no node id changed.
**Impact on plan:** Small widening of the panel text. Nothing else moved.

## Issues Encountered

- `npm run lint:fix` prints 321 warnings and 0 errors, all pre-existing and outside the changed files.
- Open question for plan 02-19: no code under `src/` registers the service worker, and `serwist.config.js` is in configurator mode without a registration option. The page no longer makes a claim. Only a browser check can show whether the worker registers.
- Drift left unchanged and recorded as "out of scope, DOCS-03": `themeColor: #282828` (code `#1c1b1b`), cache key `hd1-live-cache` (code `hd1-live-cache-v1`), toast position (mobile is top-center), `computeMapState()` (route calls `computeLiveMapState`).

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lane `docs/02-gap-closure` head is `af0f68468405149f07a25c1b03613cdfb96ac83a`; plans 02-23, 02-24, 02-18 and 02-25 add commits on top. Sweep 3 group G4 is still to add.
- DOCS-02 stays unchecked until plan 02-22 (D-33).
- Plan 02-19 must render the in-app diagram (new `lease holder fetches` edge label) and check the Caching Strategy table.

## Self-Check: PASSED

Lane commits `5640870d` and `af0f6846` are ancestors of lane HEAD, the five lane files exist, the lane working tree is clean under `src`, the lane server on :3100 is stopped, the Task verify commands exit 0, and no acceptance criterion fails.

---
*Phase: 02-docs-accuracy-operational-housekeeping*
*Completed: 2026-11-15*
