---
phase: 02-docs-accuracy-operational-housekeeping
plan: 25
subsystem: docs
tags: [docs, infrastructure, mermaid, poller-lease, page-check-record]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "02-18 (lane docs/02-gap-closure at 4ac3350c, Sentry bullets and #686 reference)"
provides:
  - "/docs/infrastructure overview fence routes the worker through the update route; only the lease holder polls the official API (WR-03)"
  - "/docs/infrastructure re-checked statement by statement at lane commit cb68f18f: 19 further drift fixes in the page"
  - "Page-check record section '## Gap closure: /docs/infrastructure' closed by the only Page infrastructure CHECKED line"
affects: [02-19, 02-20, 02-21, 02-22]

plan_head_before: 4ac3350c849e912b38885e6d411f88512bcdeaab
plan_head_after: cb68f18f26c381ae318d9087a96c85300fb1dfb9

actuals:
  tokens: 11400
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/app/docs/infrastructure/page.mdx
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md

key-decisions:
  - "The three CI secret ids and the Umami host name are described by role on the page, because the plan prohibition (D-06) forbids secret names and host names and the plan 02-08 record had wrongly said none were present; env var names and the public image path stay"
  - "The tunnel sentence states the tryCatch report instead of the old 'would self-loop' reason: the server SDK posts straight to GlitchTip, so no loop exists"
  - "The code comment at next.config.mjs:226 ('cannot ship a build without its maps') overclaims like the old page text; it is a code comment outside DOCS-02 and is recorded, not changed"

requirements-completed: [DOCS-02]

coverage:
  - id: C1
    description: "The served /docs/infrastructure overview fence shows the worker calling the update route and only the lease holder polling the official API; all 14 fences parse"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 1 verify 1 (fence found by position, worker edges name /api/h1/update and no POLL, lease-holder edge reaches POLL, fence script, _meta tests, page clean): exit 0"
        status: pass
      - kind: other
        ref: "Task 1 verify 2 (lane server on 127.0.0.1:3100 serves 'Update route /api/h1/update', 'lease holder only' and 'ships without uploaded maps'): exit 0"
        status: pass
    human_judgment: false
  - id: C2
    description: "/docs/infrastructure matches the code statement by statement, and the record binds the read to lane commit cb68f18f"
    requirement: DOCS-02
    verification:
      - kind: unit
        ref: "npx vitest run src/__tests__/unit/_meta (9 files, 35 tests passed) and node scripts/check-mermaid-fences.mjs (14 fences OK)"
        status: pass
      - kind: other
        ref: "Task 2 verify 2: single closing line bound to lane commit cb68f18f, page unchanged after it, cited files exist in the lane, final-check section kept, nine CHECKED lines once each"
        status: pass
    human_judgment: false
  - id: C3
    description: "Rendered look of the overview fence (two-line edge chain) and the edited tables on /docs/infrastructure"
    requirement: DOCS-02
    verification: []
    human_judgment: true
    rationale: "Plan 02-19 owns the render check; this plan has no browser tool"

duration: 17min
completed: 2026-11-15
status: complete
---

# Phase 2 Plan 25: Infrastructure page re-check Summary

**The /docs/infrastructure overview fence no longer draws the worker thread into the official-API node: the worker calls `/api/h1/update` and only the lease holder polls, and the page was re-read against the workflows, Dockerfiles, compose files and config with 19 further drift fixes.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-11-15T20:08:00Z
- **Completed:** 2026-11-15T20:25:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 in the lane, 1 record)

## Accomplishments

- Task 1, tracer (lane commit `2c4eca9d`): the first mermaid fence has `WORKER --> UPDATE["Update route /api/h1/update"]` and `UPDATE --> POLL` labelled `lease holder only`. No HTTP method is named. Verify 1 and verify 2 passed against the lane server (127.0.0.1:3100, stub env, `WORKER_ENABLED=false`, `VITEST=1`), which this plan started and stopped. All 14 fences of the docs tree parse.
- Task 2 (lane commits `c8db31f6` and `cb68f18f`): the page was read statement by statement. Fixes by area:
  - workflows: the staging job table said "Always" for Detect Migration Changes and Build App Image (both are gated on a green CI run from a push to this repository, or a dispatch); the migrate image also builds when it is missing or on dispatch
  - Dockerfile: cache mounts sit in two stages, `--chown` does not cover `/app/migrate`, `prisma.config.mjs` loads `dotenv` rather than importing `dotenv/config`
  - startup: `migrateOrWait()` is called from `instrumentation.node.js`; the Sentry config loads only under the Node.js runtime (diagram edge and text)
  - Sentry and boundaries: tunnel URL keeps the DSN protocol; the tunnel sentence ignored the `tryCatch` report; the boundary list named Timeline instead of Event Log; the `tryCatch` count; the service worker bridge reaches uncontrolled window clients too
  - env table: `UMAMI_SITE_ID` does not gate server-side events (production only), `UMAMI_SITE_URL` absent means 404 for the proxied scripts, the three VAPID keys are all-or-none, production uses `*_FILE` for more than two keys
  - headers: the HTML cache row also excludes `/stats.js`, `/recorder.js` and `/opengraph-image`
  - D-06: the page named the Umami host (three places), the cleanup token's secret name and the four BuildKit secret ids; they are now described by role
- The plan 02-18 Sentry bullets were re-read against `@sentry/bundler-plugins` 11.10.0 (rethrow at `build-plugin-manager.js:102`, skip branches at 539, 545, 551, 455) and hold; the `#686` reference is still on the page.
- Record: `## Gap closure: /docs/infrastructure` with 37 rows (the two prior changes, 19 fixes, 5 classes, 9 parts, the plan 02-08 miss, the D-06 check) and the only `Page infrastructure: CHECKED` line, bound to lane commit `cb68f18f`. The plan 02-08 closing line is prose. The `## Final check (develop 709126df...)` section is unchanged. The nine CHECKED lines are each present once. Every cited `path:line` is inside its file.

## Task Commits

1. **Task 1: overview fence routes the worker through the update route** - `2c4eca9d` (docs, lane `docs/02-gap-closure`)
2. **Task 2: infrastructure re-check fixes** - `c8db31f6` and `cb68f18f` (docs, lane `docs/02-gap-closure`; the second removes the host and secret names)

**Plan metadata:** the GSD-tree commit with this SUMMARY and the page-check record, then the commit for STATE.md and ROADMAP.md.

## Files Created/Modified

- `src/app/docs/infrastructure/page.mdx` - fence edges and 19 text fixes (lane)
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md` - new gap-closure section; the plan 02-08 closing line is prose

## Decisions Made

See `key-decisions`. DOCS-02 stays unchecked until plan 02-22 (D-33).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Host and secret names removed from the page**
- **Found during:** Task 2
- **Issue:** The plan prohibition (D-06) forbids secret names and host names on the page, and the Task 2 action says "keep D-06". The page already held `umami.lav.ren` (three places), `secrets.GHCR_CLEANUP_TOKEN` and the four BuildKit secret ids, and the plan 02-08 record said none were present.
- **Fix:** Described them by role (see Accomplishments). The record row states that the earlier row was wrong.
- **Files modified:** `src/app/docs/infrastructure/page.mdx`
- **Commit:** `cb68f18f`

**Total deviations:** 1 auto-fixed (1 Rule 2). **Impact on plan:** none on scope; one extra lane commit.

## Issues Encountered

- `next.config.mjs:226` still carries the comment "a failed upload stops the build, so Pin Production cannot ship a build without its maps (#661)". The page was scoped in plan 02-18; the comment is code outside DOCS-02 and is unchanged.
- `npm run lint:fix` prints 321 warnings and 0 errors, all pre-existing and outside the changed files. Prettier does not realign MDX tables, so the edited table rows are not column-aligned in the source; they render correctly.
- The image path `ghcr.io/elfensky/helldiversbot` stays on the page (the public pull path, not an org slug of a private system).

## Known Stubs

None.

## Threat Flags

None. The lane server listened on 127.0.0.1 only and is stopped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lane `docs/02-gap-closure` head is `cb68f18f26c381ae318d9087a96c85300fb1dfb9`. Lane commits: `2c4eca9d`, `c8db31f6`, `cb68f18f`. Plan 02-19 lands the lane.
- Plan 02-19 render check: /docs/infrastructure overview fence (the polling node now sits after the update-route node, two edges), the staging job table (long condition cell in two rows), the env table (UMAMI and VAPID rows), the cache header table (long first cell), and the Analytics proxy list (`https://<UMAMI_SITE_URL>/api/send` in a code span).
- Plan 02-21 replaces the `## Final check` section; DOCS-02 stays unchecked until plan 02-22 (D-33).

## Self-Check: PASSED

Lane commits `2c4eca9d`, `c8db31f6` and `cb68f18f` are ancestors of the lane HEAD, the lane tree is clean, Task 1 verifies 1-2 and Task 2 verifies 1-2 exit 0, `_meta` unit tests pass (35), 14 fences parse, the release and staging workflows are unchanged against `origin/develop`, and port 3100 is free.

---
*Phase: 02-docs-accuracy-operational-housekeeping*
*Completed: 2026-11-15*
