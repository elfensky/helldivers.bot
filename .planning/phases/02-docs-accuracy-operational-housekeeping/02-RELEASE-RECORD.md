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
