---
phase: quick-261020-wsk
plan: 01
subsystem: dependencies
tags: [dependabot, prisma, effect, playwright, better-auth]
requirements: [DEPS-02]
status: complete
commits: 5
plan_head_before: 1f9ef0549d16dd5f8363b2015650b4e85aa35731
plan_head_after: c0bb75ba8f2cec15544d0add3ac8111f9e56fd7c
key-files:
    modified:
        - package.json
        - package-lock.json
        - .github/workflows/check-ci.yml
        - .github/dependabot.yml
        - scripts/visual-tests.sh
        - src/app/docs/testing/page.mdx
        - .planning/codebase/STACK.md
        - .planning/codebase/TESTING.md
        - src/auth-client.js
        - src/app/profile/page.jsx
        - src/features/account/AccountActions.jsx
        - CHANGELOG.md
actuals:
    tasks: 3
    commits: 5
---

# Phase quick-261020-wsk Plan 01: Land Dependabot PR #554 Summary

`effect` override capped at `^3.20.0`, visual CI image moved to Playwright 1.64.1, majors of `@types/node` and `typescript` ignored, and the better-auth 1.7 unlink API break fixed. Local verify chain is green; the visual suite did NOT run locally.

## Results

| Gate | Result |
| ---- | ------ |
| `npm ls effect --all` | only `effect@3.22.3` (under `@prisma/config`) |
| `prisma generate` (stub `POSTGRES_URL`) | exit 0, client 7.10.1 |
| `npm run lint` | exit 0, 0 errors, 323 warnings (unchanged baseline) |
| `npm run typecheck` | exit 0 (after the auth fix below) |
| `npm run test:unit` | exit 0, 194 files, 2028 tests passed |
| `npm run build` | exit 0 |
| `npm run test:visual` | NOT RUN: Docker daemon unavailable |

## Lockfile diff scope

`package-lock.json`: 52 insertions, 8 deletions. Changed keys only: `node_modules/effect` (4.0.5) replaced by `node_modules/@prisma/config/node_modules/effect` 3.22.3, plus its subtree additions `node_modules/fast-check` 3.23.2 and `node_modules/pure-rand` 6.1.0. Root version stays 0.95.4.

## Visual suite

Docker CLI is installed but the daemon never came up. `docker info` was retried for about 3 minutes and still failed with "dial unix /Users/andrei/.docker/run/docker.sock: no such file". Only the `com.docker.vmnetd` helper was running; Docker Desktop itself was not. No baseline was rewritten. The CI Visual Regression job on the 1.64.1 image is the only visual check.

## Deviations from Plan

**1. [Rule 1 - Bug] better-auth 1.7 `unlinkAccount` API change**
- **Found during:** Task 1 (typecheck), fixed in Task 3.
- **Issue:** better-auth 1.7.10 `/unlink-account` takes only `{ accountId }`, meaning the Better Auth account row id. The code passed `{ providerId, accountId }` with the provider's own account id, so typecheck failed and at runtime no row would match.
- **Fix:** `profile/page.jsx` selects and passes `id`; `AccountActions.jsx` passes `linked.id`; `auth-client.js` `unlinkAccount(accountId)`.
- **Files:** `src/auth-client.js`, `src/app/profile/page.jsx`, `src/features/account/AccountActions.jsx`
- **Commit:** f534b5f6
- **Not tested end to end:** no unit test covers unlink and no OAuth session was available. Worth a manual check on staging.

**2. Pre-commit branch allow-list not applied.** The executor's worktree guard expects an `agent-*` branch. This lane worktree is on the Dependabot branch by orchestrator instruction, so commits went to it. It is not a protected branch.

## Commits

- 32d6e08b fix(deps): cap prisma's effect override at 3.x
- 40637fc7 ci: run visual tests on the Playwright 1.64.1 image
- cb13c365 chore(dependabot): ignore major updates for @types/node and typescript
- f534b5f6 fix(auth): unlink accounts by Better Auth account id
- c0bb75ba docs(changelog): record the #554 dependency group fixes

Nothing pushed. `package.json` version stays 0.95.4. No version section in CHANGELOG.

## Notes

- Repo-wide `prettier --check CHANGELOG.md` already flags older entries; the new lines are clean.
- `npm install` reports 6 high-severity audit findings; not investigated (out of scope).

## Known Stubs

None.

## Self-Check: PASSED
