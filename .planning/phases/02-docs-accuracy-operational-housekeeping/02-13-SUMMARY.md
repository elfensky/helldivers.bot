---
phase: 02-docs-accuracy-operational-housekeeping
plan: 13
subsystem: infra
tags: [release, github-actions, docker-swarm, migrate-on-start, sentry]

requires:
  - phase: 01.1-production-on-the-hetzner-swarm
    provides: pin-production job and Arcane Git Sync deploy path
provides:
  - "Release 0.98.1 (tag v0.98.1) live in production: migrate-on-start (#599) with its own rollback point"
  - "02-RELEASE-RECORD.md ## Release 1: PRs, merge sha, tag, run id, upload lines per build leg, pin commit, map-probe baseline"
affects: [02-04, 02-09, 02-10]

status: complete
actuals:
  tokens: 2000
  tasks: 2
  commits: 1
plan_head_before: 14c9697b8565204aca5faff2b1708b6236fe2242
plan_head_after: 9a1d764ae6f05aaf20f32367a004e946f6115ea8

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-RELEASE-RECORD.md
  modified:
    - package.json
    - package-lock.json
    - CHANGELOG.md

key-decisions:
  - "V1 = 0.98.1 (patch): `## Unreleased` held only `### Changed`"
  - "Map probe takes the URL from the chunk's sourceMappingURL comment, not `<chunk>.js.map`"

requirements-completed: [HOUSE-03, HOUSE-04]

duration: 20 min
completed: 2026-11-15
---

# Phase 2 Plan 13: Release 1 Summary

**Release 0.98.1 (develop as planned, migrate-on-start #599 alone) went through cut PR #656, release PR #657 and tag v0.98.1; production reported 0.98.1 about 14 minutes after the tag push.**

## Accomplishments

- Cut PR #656 (`chore(release): 0.98.1`: package.json, package-lock.json, CHANGELOG.md only) passed all checks and was rebase-merged as `9e539e56`. The remote branch and the lane worktree are removed.
- Release PR #657 (`develop` to `main`) passed all 11 checks (1 skipped) and was merged with a merge commit `b0cfaad86668e55ac3f990fc02ef3fa8d3f9c4a6`. `develop` was kept.
- Annotated tag `v0.98.1` points at that merge commit. `git diff --quiet v0.98.1 'v0.98.1^2'` exits 0.
- Build: Release run 43656834214 concluded success in all nine jobs. Pin Production moved `deploy/production` to commit `e0b53111`, which pins `ghcr.io/elfensky/helldiversbot:v0.98.1`.
- Production `/api/h1/live` first reported `appVersion` 0.98.1 between 00:19:36Z and 00:20:36Z (polls 60 s apart). Nothing was touched on the production host.
- Sentry upload line count: one `Successfully uploaded source maps to Sentry` line each for `Build App Image (amd64)` and `Build App Image (arm64)`.
- Production serves public source maps (status 200), the baseline for D-15 (3).

## Task Commits

1. Task 1 (tracer): cut and release. Commit `9e539e56` (`chore(release): 0.98.1`) on `develop`, merge commit `b0cfaad8` on `main`, tag `v0.98.1`. These are outside the GSD working tree, as the plan requires.
2. Task 2: record. Commit `9a1d764a` (`docs(02-13): record release 1 (0.98.1) live in production`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's map-probe URL form returns 404**
- **Found during:** Task 2, step 5
- **Issue:** `<chunk>.js.map` returns 404 for every chunk. Each chunk ends with `//# sourceMappingURL=<other-hash>.js.map`, so the map name differs from the chunk name.
- **Fix:** Resolved the URL from the `sourceMappingURL` comment of `/_next/static/chunks/04o2_8fpjurm0.js` (`43shl_15f_d1y.js.map`): status 200, `application/json`, 1.67 MB. The record states the correction.
- **Impact on plan 02-09/02-10:** the D-15 (3) probe after the strip must use the same `sourceMappingURL` derivation. Otherwise it returns 404 before and after, and proves nothing.
- **Files modified:** `02-RELEASE-RECORD.md`
- **Commit:** 9a1d764a

**2. [Observation] `gh pr checks --required` reports no required checks for a PR into `develop`**
- The `--required` flag printed "no required checks" because the checks had not yet registered. The plain `gh pr checks --watch` was used instead. All checks passed before merge.

**Total deviations:** 1 auto-fixed (Rule 1), 1 observation. **Impact:** none on the release; one correction for the later D-15 (3) probe.

## Authentication Gates

None.

## Known Stubs

None.

## Issues Encountered

None. Time-to-live from tag push (00:08Z approx.) to production 0.98.1: about 12 minutes, well inside the 30 min limit.

## Next Phase Readiness

Plan 02-04 (#642, season 161) may land on `develop`. D-31 requires it to finish before 2026-11-16 03:00 UTC. No rollback was needed or performed.

## Self-Check: PASSED

- 02-RELEASE-RECORD.md exists; commit 9a1d764a is an ancestor of HEAD.
- Tag `v0.98.1` is annotated, points at `origin/main`, and `package.json` at the tag reads 0.98.1.
- Task 1 and Task 2 `<automated>` verifications all exit 0; the record holds no `sntrys_`, `ghp_` or `gho_` string.
