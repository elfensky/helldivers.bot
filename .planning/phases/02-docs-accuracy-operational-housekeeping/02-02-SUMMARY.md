---
phase: 02-docs-accuracy-operational-housekeeping
plan: 02
subsystem: docs
tags: [agents-md, worker-heartbeat, lease, codebase-maps, claude-md-regeneration]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Plan 02-04 gaps issue #658 and plan 02-10 CONCERNS #502 edit, both already on develop"
provides:
  - "AGENTS.md lease facts and the lane-safe merge line on develop (PR #664)"
  - "Four #516-era comments rewritten for the lease model; no code line changed"
  - "Corrected STACK, ARCHITECTURE, INTEGRATIONS and CONCERNS maps"
  - "Issues #662 (WR-07) and #663 (WR-08) in Engineering Health"
  - "Regenerated main-checkout .claude/CLAUDE.md (action updated)"
  - "02-DOCS-PAGE-CHECK.md with the AGENTS.md and codebase-map sections"
affects: [02-03, 02-05, 02-06, 02-07, 02-08, 02-11]

status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 1
plan_head_before: fc38c79b76c7e80d8aa29a945938bb02312d926d
plan_head_after: a05756da55248c0f174cee482d73bc2d0e5ff6db

tech-stack:
  added: []
  patterns:
    - "Merge through gh pr merge <n> --rebase, then delete the branch with git push origin --delete once MERGED"

key-files:
  created:
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md
  modified:
    - AGENTS.md
    - src/app/api/h1/update/route.js
    - src/shared/utils/initializeWorker.mjs
    - public/workers/cron.js
    - .planning/codebase/STACK.md
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/INTEGRATIONS.md
    - .planning/codebase/CONCERNS.md
    - .planning/milestones/M7-phases/01-stability-fixes-release/01-REVIEW-DISPOSITION.md
    - CHANGELOG.md

key-decisions:
  - "Both page-check sections cite the same lane commit (the map commit). The plan's check diffs every covered file from the cited commit to HEAD, so the AGENTS.md section cannot cite the earlier AGENTS.md commit."
  - "Extra drift fixed in the maps: Node 24 to Node 26 in STACK.md:16,79 (mise.toml says 26), the worker-bootstrap trigger line in ARCHITECTURE.md, and the route.js:38 throttle reference."
  - "Issues #662 and #663 carry labels chore and security, and name no host (the Umami host is left out of the text)."

requirements-completed: [DOCS-01]

coverage:
  - id: D1
    description: "AGENTS.md states the lease facts (WORKER_ENABLED opt-out, LEASE_TTL_S 60 s, standby 200, 2 replicas) and the lane-safe merge line; no section added or restored; no IPv4 address"
    requirement: DOCS-01
    verification:
      - kind: other
        ref: "Task 1 automated checks 1 and 2 (grep; heading list equals origin/develop); AGENTS.md grew by 5 lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "The four comment sites describe the lease model; the diff of the three code files holds comment lines only; the 403 guard is unchanged"
    requirement: DOCS-01
    verification:
      - kind: other
        ref: "Task 1 automated checks 3, 4, 5 (diff filter on non-comment lines is empty)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The five wrong map lines and the two CONCERNS entries are fixed from the code; no map line holds a stale phrase or an IPv4 address"
    requirement: DOCS-01
    verification:
      - kind: other
        ref: "Task 2 automated checks 1 and 2 (stale-phrase sweep empty; step 4 names h1_event_progress; step 7 says neither)"
        status: pass
    human_judgment: false
  - id: D4
    description: "WR-07 (#662) and WR-08 (#663) are filed in Engineering Health, link #631 and #629, and the disposition rows point at them"
    requirement: DOCS-01
    verification:
      - kind: other
        ref: "Task 2 automated check 3 (two rows match 'deferred → #N'); gh issue create output"
        status: pass
    human_judgment: false
  - id: D5
    description: "PR #664 rebase-merged under the develop ruleset with no version change; the generated .claude/CLAUDE.md was regenerated afterwards and the main checkout's git state is unchanged"
    requirement: DOCS-01
    verification:
      - kind: other
        ref: "Task 3 automated checks 1-4: lint, typecheck, test:unit, build exit 0; gh pr list merged count 1; generated-file grep exits 0"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-11-15
---

# Phase 2 Plan 02: Lease model in AGENTS.md, comments and maps Summary

**AGENTS.md, four code comments and the codebase maps now describe the `worker_heartbeat` lease model, the merge line no longer removes lane worktrees, and the main checkout's generated `.claude/CLAUDE.md` was regenerated from the corrected maps.**

## Performance

- **Duration:** 9 min (about 01:51Z to 02:00Z, wall clock of the executor host)
- **Tasks:** 3 of 3
- **Files modified on develop:** 10 (see key-files); 1 file created in the GSD tree

## Accomplishments

- Task 1 (tracer): AGENTS.md § Architecture invariants gained 4 lines (every replica spawns the cron thread, lease 60 s, standby `200 {role:'standby'}`, optional `WORKER_ENABLED=false`, 2 replicas). § Branches now says `gh pr merge <n> --rebase`, then `git push origin --delete <branch>` after MERGED, and that a release PR never deletes `develop`. The tracer `<verify>` re-ran after the commit and passed, so expansion went ahead.
- The four comments (`route.js` throttle and guard, `initializeWorker.mjs` JSDoc, `cron.js` lifecycle) describe the lease model. The diff of the three code files has comment lines only.
- Task 2: STACK.md:85-86, ARCHITECTURE.md steps 2, 3, 4, 5, 7, INTEGRATIONS.md:79-80 and the two CONCERNS entries are fixed from the code. Issues #662 (WR-07) and #663 (WR-08) were filed in Engineering Health; their disposition rows read `deferred → #662` and `deferred → #663`.
- `02-DOCS-PAGE-CHECK.md` holds the two sections. Its automated check passed against the lane (7 and 12 cited files, both bound to the lane commit).
- Task 3: lint (0 errors), typecheck, `test:unit` (199 files, 2103 tests) and the stub-env build all exited 0 before the push. Required checks `Test & Build`, `Visual Regression` and `Review Dependencies` passed. PR #664 was rebase-merged from the GSD tree. `origin/develop` is `ca86b456`, version 0.98.1 (V0 = 0.98.1, unchanged). The remote branch, the local branch and the lane worktree are removed.
- Regeneration: develop sha `ca86b4563de9b8c0e3f8b90c6fa935dc6ffd87ab`; JSON `"action": "updated"`, 6 of 6 sections. In the regenerated file: `dedicated 1-replica worker` 0, `eslint-plugin-react-compiler` 0 (before: 3 stale hits together), `worker_heartbeat` 5 (before 4), `GSD:stack-start` 1. `git -C /Users/andrei/Developer/helldivers.bot status --porcelain` printed nothing before and after. The detached lane `chore-claude-md-regen` is removed.

## Task Commits

| Task | Commit | Notes |
|------|--------|-------|
| 1 | `4cedd0da` on develop (lane `0fbb1bb8`) | AGENTS.md and the four comments |
| 2 | `8e1893de` on develop (lane `50fe508c`); `a05756da` in the GSD tree | maps and disposition rows on develop; the page-check record in the GSD tree |
| 3 | `ca86b456` on develop (lane `8ee8df83`) | CHANGELOG note; PR #664 |

The rebase merge rewrote the three lane hashes. The page-check record cites the lane commit `50fe508c7254cc5d7556b3da4b68f40a1f091d71`; its content on develop is the same (`8e1893de`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extra map drift fixed in the same lines**
- **Found during:** Task 2
- **Issue:** STACK.md:16,79 said Node 24 (`mise.toml` says 26); ARCHITECTURE.md said a `WORKER_ENABLED=false` replica is "guarded by isWorkerEnabled()" at bootstrap and cited `route.js:38` for the throttle (now `:40`); step 3 and 5 line references had moved.
- **Fix:** corrected in place and listed as "extra drift" in the page-check record.
- **Files modified:** `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`
- **Commit:** `8e1893de` on develop

**Total deviations:** 1 auto-fixed (1 doc bug). **Impact:** none on the plan; the maps feed the generated CLAUDE.md, so the extra fixes reach it too.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The code diff is comment-only, the 403 guard is unchanged, the new issues and docs hold no IP address, host name or secret name (T-02-40, T-02-41), and the main checkout's git state is unchanged (T-02-53).

## Issues Encountered

None.

## Next Phase Readiness

Plans 02-03, 02-05 to 02-08 and 02-11 append their sections to `02-DOCS-PAGE-CHECK.md` in the same format. No later plan of this phase changes the four generator inputs (`PROJECT.md`, `STACK.md`, `CONVENTIONS.md`, `ARCHITECTURE.md`), so the regenerated `.claude/CLAUDE.md` stays current.

## Self-Check: PASSED

- `02-DOCS-PAGE-CHECK.md` exists; commit `a05756da` is an ancestor of HEAD in the GSD tree.
- PR #664 state is MERGED; `origin/develop` holds `4cedd0da`, `8e1893de` and `ca86b456`; issues #662 and #663 exist.
- Task 1, 2 and 3 `<automated>` checks exit 0 (Task 3 check 4 against the regenerated file).
