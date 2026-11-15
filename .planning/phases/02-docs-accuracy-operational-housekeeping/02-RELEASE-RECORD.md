# Phase 2 — Release record

## Release 1

Release 1 ships develop as it stood at planning (0.97.3, 0.97.4, 0.98.0 and the `## Unreleased` notes). Migrate-on-start (#599) reaches production with no other code change (D-21 (1), D-31).

| Item | Value |
|------|-------|
| version | 0.98.1 |
| cut PR | #656 (https://github.com/elfensky/helldivers.bot/pull/656), rebase-merged as 9e539e56283b1e94f4e0f2c15277c34bb7d37e62 |
| release PR | #657 (https://github.com/elfensky/helldivers.bot/pull/657), merge commit, head `develop` kept |
| merge sha | b0cfaad86668e55ac3f990fc02ef3fa8d3f9c4a6 |
| tag | v0.98.1 |
| run id | 43656834214 |
| run URL | https://github.com/elfensky/helldivers.bot/actions/runs/43656834214 |
| upload lines amd64 | 1 |
| upload lines arm64 | 1 |
| Pin Production | success |
| pin commit | e0b531117af4fb4184993dc985ad7aa00f3f6191 |
| first seen | 2026-11-15T00:20:36Z |
| map probe URL | https://helldivers.bot/_next/static/chunks/43shl_15f_d1y.js.map |
| map probe status | 200 |

Notes:

- Cut rule: `## Unreleased` held only `### Changed`, so the cut is a patch (0.98.0 to 0.98.1).
- `git diff --quiet v0.98.1 'v0.98.1^2'` exits 0: the release merge commit adds nothing to the released develop commit.
- All nine `Build: Release` jobs concluded `success`.
- `first seen`: the 60 s poll printed 0.97.2 at 00:19:36Z and 0.98.1 at 00:20:36Z. The true switch lies between the two polls.
- Map probe: a chunk's source map name differs from the chunk name. The URL comes from the `sourceMappingURL` comment at the end of chunk `/_next/static/chunks/04o2_8fpjurm0.js`. The plan's literal form (`<chunk>.js.map`) returns 404 for every chunk and is not a valid probe. Production still serves public maps before the D-15 (3) strip, so 200 is the baseline.

Release 1: LIVE

## Seed refresh (#642, plan 02-04)

| Item | Value |
|------|-------|
| PR | #642 (https://github.com/elfensky/helldivers.bot/pull/642), rebase-merged |
| old head H0 | a22b7efc0ee26b65ed13baf55c10a0b9a9b3211a (base 2a86e6c8, before the release-1 cut) |
| rebased head | 430ed90a0806c95e314349853f5d196260d33a01 (seed commit rebased on 9e539e56, plus the CHANGELOG note commit) |
| path that started the runs | push by a user account (assumption A1 held); no run reached `action_required`; API and UI approval not needed |
| runs on the new head | PR #642 43658041596, Check: CI 43658044977, Check: Dependencies 43658044891, Check: Migrate Image (arm64) 43658044939 |
| required checks | Test & Build pass, Visual Regression pass, Review Dependencies pass; `mergeStateStatus` CLEAN |
| merged at | 2026-11-15T00:27:38Z (before 2026-11-16T03:00Z; after tag v0.98.1) |
| merge commit M (develop head) | 6812b2b31b0c3a14f0898368922e64a500af6bf7 |
| Check: CI on M | run 43658272253, success |
| Build: Staging on M | run 43658436778, success, finished 2026-11-15T00:33:04Z |
| deploy/staging | pin commit e77db444e227f022260467a203bfb6f8c8cbce32 (2026-11-15T00:32:56Z) pins `sha-6812b2b31b0c3a14f0898368922e64a500af6bf7` |
| staging version `0.98.1-dev.6812b2b` first seen | 2026-11-15T00:38:33Z (orchestrator poll of `/api/h1/live` every 45 s; the 00:37:48Z poll still showed `0.98.1-dev.9e539e5`) |
| first staging app task on the pin | task `zgl32pyzvt9z4qkjzuiwv7i1r`, node staging01, created 2026-11-15T00:37:49Z |
| `[migrate]` lines of that task | `2026-11-15T00:38:01.871507669Z [migrate] seed data changed, seeding` then `2026-11-15T00:38:02.717259569Z [migrate] up to date (2105 ms)` |
| second app task on the pin | task `kpcjq4jagcwz414xa24x23p58`, node staging02, created 00:38:05Z; `2026-11-15T00:38:15.434008324Z [migrate] seed unchanged, skipped`, then `[migrate] up to date (1274 ms)`. Expected: the first task applied the new seed under the advisory lock |
| tasks before the pin | the tasks on `sha-9e539e56` (about 00:13Z) logged `seed unchanged, skipped`, so the seed change came with M |
| evidence route | Andrei signed in to Arcane in his Chrome; the orchestrator read the logs of service `helldiversbot_app` (environment staging01) through Arcane's log websocket in that session, with Andrei's authorization. Both `[migrate]` lines of the first task are later than the 00:27:38Z merge |
| remote branch `chore/seed-refresh` | deleted (D-27); lane worktree and local branch removed |

## Release 2 route

Release 2 route: strip

Decided by Andrei on 2026-11-15 after he saw both verdicts: `Verdict: SYMBOLICATED` (`02-SYMBOLICATION-PROOF.md`: HELLDIVERSBOT-7D, event 4ec0654f36334c9e88a5830f8843ac73, release 0.98.1-dev.acecf2b, raw `/_next/static/chunks/3kqjs_c4-s7d6.js:2:355` maps to `src/shared/components/AnalyticsOptOut.jsx:18`) and `Verdict: STRIPPED` (`02-SOURCEMAP-MEASUREMENT.md`: static maps 142 to 0, sourceMappingURL lines 131 to 0, debugId lines 131 to 131, server maps 48 to 48). He chose `strip` after a guard for D-32 (issue #661). Version: 0.99.0 (the `## Unreleased` section holds `### Added`).

D-32's residual risk is closed by #679 (PR #679, merge commit 7697b38bb4c900b6b2947e45ca6841c016f2c07e, closes #661): `withSentryConfig` has `errorHandler: (err) => { throw err; }`, so a failed release creation, upload or finalize fails `next build`, the `Build App Image (<arch>)` leg fails, and Pin Production cannot run. The per-leg upload read in Task 3 stays as written.
