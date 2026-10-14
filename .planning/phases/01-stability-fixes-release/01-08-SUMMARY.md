---
phase: 01-stability-fixes-release
plan: 08
subsystem: release
tags: [release, git-flow, tag, ghcr, glitchtip, sourcemaps]
status: complete

requires:
  - phase: 01-stability-fixes-release
    provides: plans 01-02, 01-05, 01-06, 01-07 fixes (all in CHANGELOG 0.94.0)
provides:
  - v0.95.2 merged to main (merge commit 11864900), tagged, images published to GHCR
  - main merged back into develop (53b75a52)
  - Deployment id 0-95-2 recorded for plan 01-09
affects: [01-09]

actuals:
  tokens: 3000
  tasks: 5
  commits: 2

key-files:
  created:
    - .planning/phases/01-stability-fixes-release/01-RELEASE-RECORD.md
  modified: []

key-decisions:
  - "Release version is develop's 0.95.2; the August 0.94.0 choice stays as the CHANGELOG section that holds the five Phase-01 fixes"
  - "Release cut by PR #547 (merge commit) and merge-back by PR #548 (merge commit, branch kept), per CLAUDE.md rule 3"

requirements-completed: [STAB-07]

coverage:
  - id: D1
    description: "Release PR merged with a merge commit; annotated tag v0.95.2 on the main merge commit, pushed"
    requirement: STAB-07
    verification:
      - kind: other
        ref: "git ls-remote --tags origin 'v0.95.2^{}' -> 11864900"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tag-triggered Build: Release run succeeded and published images"
    requirement: STAB-07
    verification:
      - kind: other
        ref: "https://github.com/elfensky/helldivers.bot/actions/runs/38547055304 (success)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Production serves v0.95.2"
    requirement: STAB-07
    verification:
      - kind: other
        ref: "curl https://helldivers.bot/api/h1/live .data.appVersion -> 0.95.2 at 2026-10-14T11:22:13Z (dpl 0-95-2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "main merged back into develop"
    requirement: STAB-07
    verification:
      - kind: other
        ref: "git merge-base --is-ancestor origin/main origin/develop -> exit 0"
        status: pass
    human_judgment: false
---

# Phase 01 Plan 08: Cut the v0.95.2 release Summary

v0.95.2 is merged to `main`, tagged, built and deployed: production serves
0.95.2 (`dpl` 0-95-2) since 2026-10-14T11:22:13Z, which starts the STAB-06
48-hour window (ends 2026-10-16T11:22:13Z).

## What happened

**August run (partial).** Tasks 1 to 3 ran in August: the sourcemap gate
(GlitchTip #497, `SENTRY_PROJECT`), the pre-release checks and a version
choice of 0.94.0. The release was never cut.

**Re-execution 2026-10-14.**
- Task 1: the developer fixed the GlitchTip permission issue; effect re-confirmed.
- Task 2: the 7 pre-release checks re-ran against v0.95.2. All passed. The open
  items were resolved by the developer, including `UMAMI_SITE_URL=umami.lav.ren`
  on the production host (commit `4e00ff40`).
- Task 3: superseded. The per-PR bump process (CLAUDE.md rules 0 and 2) replaced
  the merge-into-develop bump. Nothing was bumped; the release is develop's 0.95.2.
- Task 4: the developer approved the release and approved `.planning/` on `main`.
- Task 5: executed as below.

**Task 5 sequence.**
1. Release PR #547, `develop` to `main`. All required checks passed. Merged with
   a merge commit `11864900736070928c514636bdce39ad5e11584a`.
2. Annotated tag `v0.95.2` (matches `v0.90.14` style) on that commit. Only the tag
   was pushed. The peeled remote ref equals the merge commit.
3. Run `38547055304` (Build: Release) finished `success`. The App Image job ended
   at 2026-10-14T10:22:17Z. The GitHub Release was created.
4. Merge-back PR #548, `main` to `develop`, merge commit `53b75a52`. The branch
   was not deleted. `origin/main` is an ancestor of `origin/develop`.
5. `01-RELEASE-RECORD.md` has a `## Release` section with the deployment id
   `0-95-2` (`next.config.mjs`: `APP_VERSION.replaceAll('.', '-')`).

**Sourcemap upload.** The first run of the end-to-end path reported success:
274 files bundled and uploaded to GlitchTip as an artifact bundle, "processing
pending on server". Symbolication of a real `0-95-2` event is not yet confirmed.

## Production deployment

`build-release.yml` only publishes images and the GitHub Release; it has no
deploy step. The developer pulled and restarted the production stack
(Hetzner, `~/docker/helldiversbot/`) between 10:42Z and 11:22Z. Verified at
2026-10-14T11:22:13Z: `appVersion` 0.95.2, page `dpl` `0-95-2`, `/stats.js`
and `/recorder.js` 200 `application/javascript`, `/api/healthcheck` 200, and
the poller writing on the new build (`last_updated` 11:23:03Z), so the
`worker_heartbeat_lease` migration applied.

## Window for plan 01-09

Start 2026-10-14T11:22:13Z (first verified observation of 0.95.2), end
2026-10-16T11:22:13Z. Plan 01-09 filters GlitchTip on `dpl` = `0-95-2` and
also confirms symbolication of the first `0-95-2` event.

## Deviations from Plan

**1. [Rule 3 - Blocking] Merge-back PR created with explicit title and body.**
`gh pr create --fill` failed because local `main` was stale in the shared
repository. Fix: explicit `--title` and `--body-file`. No file changes.

**2. [Scope] Task 3 superseded** by the per-PR bump process (see above).

**3. [Rule 3 - Blocking] Production deployment is manual.** The plan assumed the
tag deploys. It does not: the developer pulled the images by hand, then the
deploy was verified (see above).

## Self-Check: PASSED

- Tag `v0.95.2` on remote peels to `11864900`: checked.
- PR #547 and #548 state MERGED: checked.
- `01-RELEASE-RECORD.md` contains `## Release` and `deployment id`: checked.
- Production serves 0.95.2 (`dpl` 0-95-2) at 2026-10-14T11:22:13Z: checked.
