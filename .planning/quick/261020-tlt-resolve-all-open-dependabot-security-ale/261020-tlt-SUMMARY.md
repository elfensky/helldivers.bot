---
phase: quick-261020-tlt
plan: 01
subsystem: dependencies
tags: [security, dependabot, npm, release]
requires: []
provides: [SEC-DEPS-01]
affects: [package.json, package-lock.json, CHANGELOG.md]
key-files:
  modified: [package.json, package-lock.json, CHANGELOG.md]
status: complete
commits: 2
plan_head_before: a3c10813bd0082953466e5d6d80c670b15b9c4c7
plan_head_after: 9c6f8557153b3941c6a5e6c0857ca3f9e5022b0a
actuals:
    tasks: 3
    commits: 2
completed: 2026-10-20
---

# Quick 261020-tlt: Resolve all open Dependabot security alerts (0.95.3)

Patched all 54 open Dependabot alerts with exact-version bumps and four overrides; released as 0.95.3 on `bugfix/security-deps` (not pushed).

## Commits

- `4ad6fb84` fix(deps): patch every package with an open Dependabot alert
- `9c6f8557` chore(release): 0.95.3

## Alert scan

- Before (base lockfile): 15 vulnerable lockfile entries, 54 alerts checked
- After: 0 vulnerable lockfile entries, 54 alerts checked (exit 0)
- `npm ci` and `npm ls --all` exit 0; `prisma generate` ok.

## Resolved versions (old to new)

next / @next/env / @next/mdx / @next/eslint-plugin-next 16.3.0 to 16.3.8; axios 1.18.1 to 1.20.0; mermaid 11.16.0 to 11.16.1; vitest, @vitest/mocker, @vitest/browser, @vitest/browser-playwright, @vitest/coverage-v8 4.1.10 to 4.1.11; serwist, @serwist/next, @serwist/cli 9.5.12 to 9.5.13; prisma stays 7.9.1.
Overrides: sharp ^0.35.5 (resolved 0.35.5), brace-expansion ^5.0.12 (5.0.12), mysql2 ^3.22.0 (3.15.3 to 3.24.6), katex ^0.18.2 (0.16.47 to 0.18.10).
Transitive refresh: dompurify 3.4.12 to 3.4.17, source-map-js 1.2.1 to 1.2.2, fast-uri 3.1.5 to 3.1.9, nanoid 3.3.16 to 3.3.20, undici 8.10.0 to 8.12.3, browserslist 4.28.7 to 4.29.4 (dedupe).

## Lockfile package names

- New: `@rolldown/binding-android-arm-eabi` (optional platform binary, expected); `sql-escaper` 1.5.2 (not in plan: new dependency of `mysql2` 3.22+, parent `mysql2@3.24.6` under better-auth and prisma; checked on npm, repo mysqljs/sql-escaper, maintainer sidorares, first published 2026-02).
- Removed: `@rolldown/binding-wasm32-wasi`, `denque`, `quote-js-string`, `seq-queue`, `sqlstring` (replaced by `sql-escaper` in newer mysql2).

## npm audit (recorded, nothing fixed)

- `npm audit`: 10 high, 0 critical/moderate/low. Packages: @next/eslint-plugin-next (via fast-glob), @prisma/config and prisma (via deepmerge-ts), braces, chokidar, chokidar-cli, deepmerge-ts, fast-glob, follow-redirects 1.16.0, micromatch.
- `npm audit --omit=dev`: 4 high: deepmerge-ts, @prisma/config, prisma, follow-redirects 1.16.0.
- None of these is on the open Dependabot alert list (scan is clean). The prisma chain needs a Prisma upgrade (out of scope).

## Verification (final patched tree, before the version-only release commit)

- `npm run lint`: pass (0 errors, 323 warnings, all pre-existing style warnings)
- `npm run typecheck`: pass
- `npm run test:unit`: pass (194 files, 2028 tests)
- `npm run build` (CI stub env): pass

KaTeX guard (`grep -rnF '$$' src`) found nothing, so the katex override is safe for diagrams.

## Deviations from Plan

None - plan executed as written. Two additions beyond the plan's expectations are noted above: `sql-escaper` entered the lockfile (legitimate mysql2 dependency), and `npm audit` still reports 10 advisories not on the Dependabot list.

## Residual risks

- Dependabot closes the alerts only after the merge into `develop`.
- The PR's Visual Regression check (not run locally) covers the Mermaid and Next patch bumps on rendered pages.
- Dependabot PRs #551 and #504 untouched.
- Remaining `npm audit` advisories (follow-redirects, deepmerge-ts/prisma, braces chain) are open.

## Self-Check: PASSED

Both commits exist on the branch (`git log origin/develop..HEAD`); only untracked `.planning/` files remain; nothing pushed.
