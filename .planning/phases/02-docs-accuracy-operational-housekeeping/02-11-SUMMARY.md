---
phase: 02-docs-accuracy-operational-housekeeping
plan: 11
subsystem: infra
tags: [release, github-actions, docker-swarm, sourcemaps, sentry, docs-check, migrations]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Verdicts SYMBOLICATED and STRIPPED (02-09, 02-10), the CHECKED docs pages (02-02, 02-03, 02-07, 02-08), the staging render (02-15), release 1 (02-13)"
provides:
  - "Release 0.99.0 (tag v0.99.0) live in production: sourcemap strip with the build-failure guard, corrected docs, staging DSN, season 161, #671 and #677"
  - "02-DOCS-PAGE-CHECK.md: one Final check section on develop 709126df with Final check: PASS"
  - "02-RELEASE-RECORD.md: Release 2 route (strip) and Release 2 record ending in Release 2: LIVE"
  - "02-MERMAID-RENDER.md: staging render of the three diagram pages on 0.99.0-dev.709126d"
affects: [02-12, phase-verification]

status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 6
plan_head_before: 514a74f908fb9be0bfc6b3bfe04da236f6e523f4
plan_head_after: bbf7dffb

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-RELEASE-RECORD.md
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-MERMAID-RENDER.md

key-decisions:
  - "Release 2 route: strip (Andrei, 2026-11-15), after both HOUSE-03 verdicts were positive; D-32 closed by #679"
  - "Release 2 also carries #674, #675, #679, #681, #671 and #677 (Andrei, 2026-11-15); merge freeze on develop until the tag existed"
  - "The #677 notes moved into ## 0.99.0 by a notes PR (#683) with no version bump; that PR is the release commit"

requirements-completed: [HOUSE-03, DOCS-02]

duration: 3 days (plan span; this continuation about 50 min)
completed: 2026-11-15
---

# Phase 2 Plan 11: Release 2 Summary

**Release 0.99.0 (strip route) went through the final docs check on develop 709126df, notes PR #683, release PR #684 and the annotated tag v0.99.0; production reported 0.99.0 at 13:20:28Z, six minutes after the tag push, with both build legs' maps uploaded and the S159 statistics fix applied.**

## Accomplishments

- Task 1: Andrei chose `strip` on 2026-11-15 (commit 5f86f08d). Both verdicts were positive.
- Final check on R = 709126df159c180b050756887257a0b2be1d02d3 (the develop head with #671 and #677): sweep 1, sweep 2 and the AGENTS sweep print 0 lines; `node scripts/check-mermaid-fences.mjs` exits 0 (8 fences in 5 files). Six hunks since the CHECKED lane commit c6bcfdb3 were read against the code at R (#671: notifications paragraph and the AGENTS.md `tryCatch` bullet; #677: four data-flow hunks against `src/update/status.mjs` and the migration). The record holds one `## Final check (develop 709126df...)` heading and one `Final check: PASS` line; the earlier result at 12704b0c is one prose sentence.
- Notes PR #683 moved the #677 CHANGELOG notes into `## 0.99.0` / `### Fixed`, left `## Unreleased` empty and changed only `CHANGELOG.md`. It was rebase-merged as C = d2f6f5379e51ab93957a0b8449a8c84bf9a8b469; `C^` is R. Branch and lane removed.
- Upload pre-flight on C: Build: Staging run 43717003849 succeeded; one `Successfully uploaded source maps to Sentry` line per `Build App Image` leg and no `Couldn't finish all operations` or `Error [SentryError]`. `deploy/staging` pinned `sha-d2f6f537...` and staging served `0.99.0-dev.d2f6f53` from 13:08:41Z.
- Staging S159 check: `https://staging.helldivers.bot/stats` reads Friendly Fire 0.55005 and Accuracy 47.248 for season 159; production (still 0.98.1) read 1144.09 and 37.97 at the same time.
- Render record: one `Staging version: 0.99.0-dev.709126d` line and three `desktop staging: PASS` lines. The 02-15 Task 3 verify exits 0. The D-23 pre-flight `git diff --quiet 709126d C` over the render sources exits 0.
- Release PR #684 (`develop` to `main`): every check passed, merged with a merge commit c139d9aff053d7b564a11802fc08f1a9f685a557, `develop` kept. Annotated tag `v0.99.0` pushed.
- Build: Release run 43717947582: all nine jobs `success`. Both `Build App Image` legs logged one upload line and no errors. Pin Production pinned `deploy/production` to v0.99.0 (commit d1bd44be, 13:19:08Z).
- Production `/api/h1/live` reported `0.99.0` at 13:20:28Z. Map probe: a main chunk has 0 `sourceMappingURL` comments and 3 `debugId` comments; its `.js.map` and the release-1 probe name `43shl_15f_d1y.js.map` return 404.
- Production S159 check at 13:21Z: Friendly Fire 0.55005, Accuracy 47.248.

## Task Commits

1. Task 1: decision record. `5f86f08d` (docs(02-11): record Release 2 route strip).
2. Task 2 (tracer): final check and render. `2d07c17a` and `c000ef29` (final check at 12704b0c, then re-recorded at 709126df), `1054b066` and `b743c48f` (render records). Outside the GSD tree: cut PR #682 (`96e34c95`), notes PR #683 (`d2f6f537`), release PR #684 (`c139d9af`), tag `v0.99.0`.
3. Task 3: record. `bbf7dffb` (docs(02-11): record release 2 (0.99.0) as live).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan verify picks a skipped Build: Staging run**
- **Found during:** Task 2 verify (fifth `<automated>`)
- **Issue:** The command takes `head -1` of the runs whose `headSha` is the released develop commit. After the release PR merged, a second run for the same commit (43717847477) appeared with conclusion `skipped`, so the count was 0.
- **Fix:** Re-ran the check on the run that built the image (43717003849, success); it lists both `Build App Image` legs. The plan text should select `conclusion==success`.
- **Files modified:** none (record note in `02-RELEASE-RECORD.md`)

**2. [Scope change, by decision] Release carries #671 and #677**
- Andrei decided on 2026-11-15 to include both after the first final check (12704b0c) and cut PR #682. This needed a repeat final check, a notes PR (#683) and a repeat staging render. All were done as specified in the continuation brief.

**3. [Observation] Per-leg upload read came after Pin Production**
- Both `Build App Image` legs and Pin Production finished inside one 60 s poll window. The legs were read after the pin (1 line each, 0 errors). The #679 guard fails a leg whose upload errors, so a missing line could not have reached the pin.

**Total deviations:** 1 auto-fixed (Rule 1), 1 scope change by decision, 1 observation. **Impact:** none on the release.

## Authentication Gates

None.

## Known Stubs

None.

## Issues Encountered

- The `[migrate]` lines of production's first start were not read. The executor does not touch the production host and has no log route. The corrected `/stats` values on production show that the S159 data migration applied.

## Threat Flags

None.

## Next Phase Readiness

Plan 02-12 runs next (D-15 (3) and (4): the production map probe and the #502 close). Phase verification re-reads the seven docs surfaces at tag v0.99.0 (D-12). No rollback was needed or performed.

## Self-Check: PASSED

- 02-DOCS-PAGE-CHECK.md, 02-MERMAID-RENDER.md and 02-RELEASE-RECORD.md exist; commits 5f86f08d, c000ef29, b743c48f and bbf7dffb are ancestors of HEAD.
- Tag `v0.99.0` is annotated and points at `origin/main` (c139d9af); `v0.99.0^2` is C and `C^` is R.
- Task 2 and Task 3 `<automated>` verifications exit 0 (the fifth after the deviation above); the record holds no `sntrys_`, `ghp_` or `gho_` string.
