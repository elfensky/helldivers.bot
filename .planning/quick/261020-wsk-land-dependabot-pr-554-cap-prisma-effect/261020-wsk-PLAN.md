---
phase: quick-261020-wsk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
    - package.json
    - package-lock.json
    - .github/workflows/check-ci.yml
    - scripts/visual-tests.sh
    - src/app/docs/testing/page.mdx
    - .planning/codebase/STACK.md
    - .planning/codebase/TESTING.md
    - .github/dependabot.yml
    - CHANGELOG.md
    - src/__tests__/visual/__screenshots__/ # only if the Docker visual run shows browser-bump diffs
autonomous: true
requirements: [DEPS-02]

must_haves:
    truths:
        - package.json overrides.prisma.effect is "^3.20.0"; the hono and @hono/node-server overrides in the same block are unchanged
        - npm ls effect --all lists only effect 3.x, and prisma generate with a stub POSTGRES_URL exits 0 (the Test & Build CI failure is gone)
        - The CI visual job container, the IMAGE in scripts/visual-tests.sh and the /docs/testing page all name mcr.microsoft.com/playwright:v1.64.1-noble, which matches the playwright 1.64.1 devDependency
        - .github/dependabot.yml (npm ecosystem) ignores version-update:semver-major for @types/node and for typescript, each with a one-line reason comment
        - npm run lint, npm run typecheck, npm run test:unit and npm run build all exit 0 under Node 24 (mise)
        - Either npm run test:visual passed in Docker (baselines rewritten only for browser-bump diffs and listed in the SUMMARY), or the SUMMARY states that Docker was not available and CI is the only visual check
        - CHANGELOG.md has Changed and Fixed bullets under the existing Unreleased heading; package.json version stays 0.95.4; no version section is created; nothing is pushed
    artifacts:
        - path: package.json
          provides: effect override capped below 4.x
          contains: '"effect": "^3.20.0"'
        - path: package-lock.json
          provides: lockfile resolving effect to 3.x under @prisma/config
        - path: .github/workflows/check-ci.yml
          provides: visual job container on the Playwright 1.64.1 image
          contains: 'mcr.microsoft.com/playwright:v1.64.1-noble'
        - path: scripts/visual-tests.sh
          provides: local visual runner on the same image
          contains: 'mcr.microsoft.com/playwright:v1.64.1-noble'
        - path: .github/dependabot.yml
          provides: major-update ignores for @types/node and typescript
          contains: "dependency-name: 'typescript'"
        - path: CHANGELOG.md
          provides: Unreleased entries for the #554 dependency group
    key_links:
        - from: package.json overrides.prisma.effect
          to: package-lock.json node_modules/effect entry
          via: npm install re-resolution
          pattern: '"effect": "\^3\.20\.0"'
        - from: package.json devDependencies.playwright
          to: .github/workflows/check-ci.yml container + scripts/visual-tests.sh IMAGE
          via: identical version string (browser build in the image must match the npm package)
          pattern: 'playwright:v1\.64\.1-noble'
        - from: .github/actions/verify/action.yml (npx prisma generate)
          to: prisma.config.mjs loaded by @prisma/config with effect 3.x
          via: CI Test & Build job
---

<objective>
Make Dependabot PR #554 (22 minor/patch updates) pass both failing CI jobs, and stop Dependabot from reopening two major-version PRs that are closed on purpose.

Purpose: the PR is blocked by two root causes. (1) The `effect` override under `prisma` has no upper bound, so it now resolves to `effect` 4.x, a breaking major; `@prisma/config` 7.10.1 cannot load `prisma.config.mjs` with it and `npx prisma generate` fails. (2) The visual job runs in the Playwright 1.62.1 image while the `playwright` devDependency is now 1.64.1, so the expected Chromium build is missing. Covers DEPS-02 (#510 and #511 are each closed with a reason, recorded as Dependabot ignores).

Output: capped override + refreshed lockfile, Playwright image bumped in CI, script and docs, two Dependabot ignores, CHANGELOG Unreleased entries, a green local verify chain. Commits stay local.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

Facts the planner measured on the Dependabot commit 1f9ef054 (2026-10-20):
- `mise exec -- npm ls effect` prints `prisma@7.10.1 > @prisma/config@7.10.1 > effect@4.0.5`. `@prisma/config` 7.10.1 pins `effect` 3.20.0 exactly; develop resolved `effect` 3.22.1.
- `package.json` lines 93-97: `overrides.prisma` holds `hono`, `@hono/node-server` and `effect`. The two hono overrides are inert under Prisma 7.10.1 (no hono installed). Leave them.
- `mise exec -- npm run lint` exits 0 with 0 errors and 323 warnings. Warnings do not fail CI. Do not chase them.
- `src/generated/prisma/` does not exist yet, so `npm run typecheck` cannot run until Task 1 generates the client.
- The shell's bare `node` is v26. The repo pins Node 24. Run EVERY node/npm/npx command as `mise exec -- <cmd>`.
- The gitignored env files are not in this worktree (a secret-read guard blocks the copy). Pass env inline, as CI does in `.github/actions/verify/action.yml`: `POSTGRES_URL=postgresql://x:y@localhost:5432/ci` for `prisma generate`; add `UPDATE_KEY=ci-stub-key UPDATE_INTERVAL=20` for `npm run build`.
- The Docker CLI is installed, but `docker info` failed at planning time (daemon not running).
- `node_modules/yaml` is installed (transitive), so `require("yaml")` works for YAML checks.
- `.claude/CLAUDE.md` is gitignored, absent from this worktree, and generated by GSD from `.planning/codebase/*.md`. Do not edit the main checkout's copy. Update its tracked sources (`.planning/codebase/STACK.md`, `.planning/codebase/TESTING.md`) on this branch instead.
- Commit trailer for every commit: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push. Never bump `package.json` version. Never create a `## X.Y.Z` CHANGELOG section.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Cap the effect override and prove the CI Test & Build path end to end</name>
  <files>package.json, package-lock.json</files>
  <action>
In `package.json`, set `overrides.prisma.effect` to `"^3.20.0"`. This keeps the security floor at 3.20.0 and blocks 4.x. Keep 4-space indentation and leave `hono` and `@hono/node-server` unchanged.

Run `mise exec -- npm install` to refresh `package-lock.json`. Then inspect `git diff --stat package-lock.json` and the changed `"node_modules/..."` keys in `git diff package-lock.json`. Only the `effect` entry and packages in effect's own dependency subtree may change. The root `"version"` must stay 0.95.4. If other packages moved, restore the lockfile with `git checkout -- package-lock.json` and use `mise exec -- npm install --package-lock-only` instead, then run `mise exec -- npm ci` so `node_modules` matches.

Prove the Test & Build CI path on this one change, in the CI order: `prisma generate`, then `typecheck`, then `build`, with the inline env listed in context. If `typecheck` or `build` fails for a reason unrelated to effect (Next 16.4, React 19.3, Prisma 7.10 type changes), do not fix it here; record the exact output and let Task 3 fix it. In that case only `prisma generate` must pass for this task. After the build, `git status` must show no unexpected tracked changes (a regenerated `next-env.d.ts` or similar file is acceptable only if it is the expected Next 16.4 output; otherwise restore it).

Commit `package.json` and `package-lock.json` as `fix(deps): cap prisma's effect override at 3.x` with a body that names the cause in one sentence (the open range resolved to effect 4.x, which @prisma/config 7.10.1 cannot load) and the trailer.
  </action>
  <verify>
    <automated>mise exec -- npm ls effect --all 2>&1 | grep -E 'effect@3\.' && test -z "$(mise exec -- npm ls effect --all 2>&1 | grep -E 'effect@([4-9]|[1-9][0-9])\.')" && POSTGRES_URL=postgresql://x:y@localhost:5432/ci mise exec -- npx prisma generate && mise exec -- npm run typecheck && POSTGRES_URL=postgresql://x:y@localhost:5432/ci UPDATE_KEY=ci-stub-key UPDATE_INTERVAL=20 mise exec -- npm run build</automated>
  </verify>
  <done>`overrides.prisma.effect` is `^3.20.0`; `npm ls effect --all` shows only 3.x; `prisma generate` exits 0. Typecheck and build exit 0, or their failures are recorded verbatim for Task 3. The fix(deps) commit exists locally.</done>
</task>

<task type="auto">
  <name>Task 2: Move the visual job to the Playwright 1.64.1 image and add the two Dependabot ignores</name>
  <files>.github/workflows/check-ci.yml, scripts/visual-tests.sh, src/app/docs/testing/page.mdx, .planning/codebase/STACK.md, .planning/codebase/TESTING.md, .github/dependabot.yml, src/__tests__/visual/__screenshots__/ (conditional)</files>
  <action>
Playwright image. Set the image tag to `mcr.microsoft.com/playwright:v1.64.1-noble` at `.github/workflows/check-ci.yml` line 33 (`container:`) and `scripts/visual-tests.sh` line 12 (`IMAGE=`). The comment above the CI container already says the tag, the `playwright` devDependency and the script move together; keep it.

Docs that describe the current setup get the new version too: `src/app/docs/testing/page.mdx` line 271 (image tag), `.planning/codebase/TESTING.md` lines 23 and 139 (image tag), `.planning/codebase/STACK.md` line 31 (Playwright browser engine version becomes 1.64.1). Change only the Playwright version in these lines. Leave the historical records unchanged, because they describe what was true when they were written: `docs/superpowers/plans/2026-08-04-visual-regression-testing.md` (a dated implementation plan) and `.planning/phases/01-stability-fixes-release/01-FONT-MEASUREMENTS.md` (the record of one run). Then grep the repo once more for `1\.62` outside `node_modules`, `.next`, `.worktrees`, `.git` and `package-lock.json`; only those two historical files may still match.

Visual run. Check `docker info`. Do not start Docker Desktop.
- If Docker is available: run `mise exec -- npm run test:visual`. If it passes, nothing more. If screenshots differ, open the diff PNGs in `.vitest-attachments/`. If every diff is anti-aliasing or font-rendering noise from the new Chromium build (no layout, color or content change), run `mise exec -- npm run test:visual:update` and commit the rewritten baselines as `test(visual): refresh baselines for the Playwright 1.64.1 browser`, and list each changed PNG in the SUMMARY. If a diff shows a real layout or content change, do not rewrite that baseline; record it in the SUMMARY with the diff path and stop for the orchestrator.
- If Docker is not available: state in the SUMMARY that the visual suite did not run locally and that the CI Visual Regression job is the only check.

Commit the image bump and doc lines as `ci: run visual tests on the Playwright 1.64.1 image` with the trailer.

Dependabot ignores (`.github/dependabot.yml`, npm ecosystem entry only). Add an `ignore:` key at the same level as `groups:` (6 spaces), placed after the `groups:` block and before `open-pull-requests-limit:`. Match the file style: 4-space nesting, single-quoted strings, block lists (the `update-types:` list under `groups` is the model). Two entries:
- `dependency-name: '@types/node'`, `update-types:` with `'version-update:semver-major'`. One-line comment above it: `@types/node` stays on ^24 to match the Node 24 runtime (commit a78e9d68). This stops #510 from recurring.
- `dependency-name: 'typescript'`, `update-types:` with `'version-update:semver-major'`. One-line comment above it: TypeScript 7 fails `npm run typecheck` with 268 JSDoc errors; remove this ignore when #555 is done. This is why #511 is closed.
Do not touch the `github-actions` entry. Commit as `chore(dependabot): ignore major updates for @types/node and typescript` with the trailer.
  </action>
  <verify>
    <automated>test "$(grep -l 'mcr.microsoft.com/playwright:v1.64.1-noble' .github/workflows/check-ci.yml scripts/visual-tests.sh src/app/docs/testing/page.mdx .planning/codebase/TESTING.md | wc -l | tr -d ' ')" = 4 && grep -q 'Playwright 1.64.1' .planning/codebase/STACK.md && test -z "$(grep -rnE 'playwright:v1\.62|Playwright 1\.62' .github scripts src/app/docs .planning/codebase)" && mise exec -- node -e 'const u=require("yaml").parse(require("fs").readFileSync(".github/dependabot.yml","utf8")).updates.find((x)=>x["package-ecosystem"]==="npm");const m=Object.fromEntries((u.ignore||[]).map((i)=>[i["dependency-name"],String(i["update-types"])]));if(m["@types/node"]!=="version-update:semver-major"||m.typescript!=="version-update:semver-major")process.exit(1);console.log("dependabot ignores ok")'</automated>
  </verify>
  <done>CI, the local script and the current docs name the v1.64.1-noble image; only the two historical files still mention 1.62. The visual suite either passed in Docker (with any browser-noise baselines rewritten and listed) or the SUMMARY says Docker was not available. dependabot.yml parses and ignores semver-major for `@types/node` and `typescript`, each with its reason comment. Two (or three, with baselines) local commits exist.</done>
</task>

<task type="auto">
  <name>Task 3: Run the full verify chain, fix root causes, write the CHANGELOG entries</name>
  <files>CHANGELOG.md, plus any source file a verify failure points to</files>
  <action>
Run the four gates in CI order, under mise, with the inline env from context: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`. All four must exit 0.

If a gate fails (Next 16.4, React 19.3, Prisma 7.10, zod 4.6, better-auth 1.7 or @eslint-react 5.28 can surface new errors), fix the root cause in the code. Do not disable an ESLint rule, add `@ts-ignore` or `@ts-expect-error`, skip or loosen a test, or pin a package back to get a green result. Read `node_modules/next/dist/docs/` before changing Next-specific code. If a fix needs more than about 5 files, or a behavior or design choice, stop and report the failure output to the orchestrator instead of widening scope. Format only the files you changed with `mise exec -- npx eslint --fix <files>`; do not run the repo-wide `npm run lint:fix`, because the new @eslint-react fixers would rewrite unrelated files. Commit each fix as its own `fix:` commit with the trailer.

CHANGELOG. Under the existing empty `## Unreleased` heading, add `### Changed` then `### Fixed`, in the style of the 0.95.3 and 0.95.4 sections: short plain sentences, end state only, no process narrative, wrapped near 80 columns. Take the exact versions from `git show 1f9ef054 -- package.json`.
- Changed: the dependency bumps from the Dependabot group (#554), naming the notable ones with from/to versions: `next`, `@next/mdx` and `@next/eslint-plugin-next` 16.3.8 to 16.4.2; `react` and `react-dom` 19.2.8 to 19.3.1; `prisma`, `@prisma/client` and `@prisma/adapter-pg` 7.9.1 to 7.10.1; `better-auth` 1.6.25 to 1.7.10; `zod` 4.4.3 to 4.6.7; `playwright` 1.62.1 to 1.64.1; `@eslint-react/eslint-plugin` 5.18.0 to 5.28.1; then the count of the smaller patch updates.
- Changed: the visual regression tests (CI job and `scripts/visual-tests.sh`) run in `mcr.microsoft.com/playwright:v1.64.1-noble`, to match the `playwright` devDependency. If baselines were rewritten in Task 2, say so in the same bullet.
- Changed: Dependabot no longer opens major updates for `@types/node`, which stays on ^24 to match the Node 24 runtime, or for `typescript`, which stays on 6.x until the TypeScript 7 JSDoc errors are fixed (#555).
- Fixed: `npx prisma generate` works again. The `effect` override under `prisma` is `^3.20.0`: the open range resolved to `effect` 4.x, which `@prisma/config` cannot load.
- Fixed: one bullet per root-cause fix made in this task, if any.
Do not create a version section and do not change `package.json` `"version"`. Commit as `docs(changelog): record the #554 dependency group fixes` with the trailer.
  </action>
  <verify>
    <automated>mise exec -- npm run lint && mise exec -- npm run typecheck && mise exec -- npm run test:unit && POSTGRES_URL=postgresql://x:y@localhost:5432/ci UPDATE_KEY=ci-stub-key UPDATE_INTERVAL=20 mise exec -- npm run build && grep -q '"version": "0.95.4"' package.json && awk '/^## Unreleased/{f=1;next} /^## [0-9]/{f=0} f' CHANGELOG.md | grep -qx '### Changed' && awk '/^## Unreleased/{f=1;next} /^## [0-9]/{f=0} f' CHANGELOG.md | grep -qx '### Fixed' && git rev-parse --verify -q '@{u}' >/dev/null && test -z "$(git log --invert-grep --grep='Co-Authored-By: Claude Opus 5.5' --format=%h '@{u}..HEAD')"</automated>
  </verify>
  <done>All four gates exit 0 on the final tree under Node 24. Any fix is at the root cause, with no rule disabling or suppression. CHANGELOG Unreleased holds Changed and Fixed bullets covering the bumps, the image, both Dependabot ignores and the effect fix. Version stays 0.95.4. Every new commit carries the trailer. Nothing is pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry -> package-lock.json | Package tarballs and integrity hashes enter the build |
| container registry -> CI visual job | The Playwright image runs `npm ci` and the visual suite |
| Dependabot config -> future PRs | Ignore rules decide which upstream updates reach review |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261020-wsk-01 | Tampering | package.json overrides.prisma.effect | medium | mitigate | `^3.20.0` keeps the 3.20.0 security floor; Task 1 checks that only effect's own subtree changes in the lockfile |
| T-261020-wsk-02 | Tampering | .github/workflows/check-ci.yml container, scripts/visual-tests.sh IMAGE | low | accept | Official `mcr.microsoft.com/playwright` image, same publisher and tag scheme as before; only the version moves to match the npm package |
| T-261020-wsk-03 | Elevation of Privilege | .github/dependabot.yml ignore rules | low | mitigate | Ignores cover only `version-update:semver-major` for two named packages; each carries its reason, and the typescript one its exit condition (#555). Advisories for both packages still surface as Dependabot alerts, which this file does not control |
| T-261020-wsk-SC | Tampering | npm install (lockfile refresh) | high | mitigate | No new package names enter the tree: `effect` 3.x was already in develop's lockfile (3.22.1) and the other bumps come from Dependabot's own commit; the lockfile keeps registry `resolved` URLs and `integrity` hashes |
</threat_model>

<verification>
- `mise exec -- npm ls effect --all` lists only effect 3.x.
- `npx prisma generate`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` all exit 0 under Node 24 with the CI stub env.
- `grep -rn 'playwright:v1.64.1-noble'` hits the CI workflow, the visual script and the testing docs page.
- `.github/dependabot.yml` parses and ignores semver-major for `@types/node` and `typescript`.
- `git status` is clean; `git log origin/dependabot/npm_and_yarn/develop/minor-and-patch-f46053a4da..HEAD` lists the local commits; nothing is pushed.
</verification>

<success_criteria>
- Both CI failures on #554 have their root cause fixed: prisma generate loads its config, and the visual job image matches the playwright devDependency.
- #510 and #511 cannot recur: both majors are ignored, each with a recorded reason.
- The verify chain is green with no suppressed checks.
- CHANGELOG Unreleased describes the end state; version and push are left to the orchestrator.
</success_criteria>

<output>
Create `.planning/quick/261020-wsk-land-dependabot-pr-554-cap-prisma-effect/261020-wsk-SUMMARY.md` when done. Include: the lockfile diff scope for effect, the result of each gate, whether the visual suite ran (and any rewritten baselines), every root-cause fix, and the list of local commits.
</output>
