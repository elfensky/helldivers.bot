---
phase: quick-261025-tlm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
    - package.json
    - package-lock.json
    - eslint.config.mjs
    - .planning/codebase/STACK.md
    - .planning/codebase/CONVENTIONS.md
autonomous: true
requirements: [DEPS-01] # related only: same intent (clear Dependabot alerts without breaking bumps); alert #214 is newer than the DEPS-01 list — do not tick DEPS-01

estimate:
    tokens: 45000
    raw_tokens: 45000
    tasks: 2
    confidence: low

must_haves:
    truths:
        - "package-lock.json holds no zod below 4.6.6: every `packages` key that ends in `node_modules/zod` has version 4.6.7 (GHSA-mrhx-c7xc-m3w5, CWE-770, vulnerable < 4.6.6)"
        - "`npm ls zod --all` exits 0 and the only zod version it prints is zod@4.6.7"
        - 'package.json `overrides` has `"zod": "$zod"`, so the four @serwist/* 9.5.13 packages that pin zod 4.6.5 exactly resolve to the root zod 4.6.7'
        - "The ESLint React Compiler plugin is gone from devDependencies, package-lock.json and eslint.config.mjs; React Compiler lint diagnostics still come from the eslint-plugin-react-hooks 7 recommended rules that the config already spreads"
        - "babel-plugin-react-compiler (the compiler transform) and `reactCompiler: true` in next.config.mjs are unchanged"
        - "The lockfile change is removals only: no key present in the base lockfile (10478b7b) changes version, and no new key appears"
        - "npm run lint exits 0 with 0 errors and a warning count no higher than the baseline recorded before the change; npm run typecheck, npm run test:unit and npm run build (next build + serwist build on zod 4.6.7) exit 0 and public/sw.js is written"
        - "Exactly one commit, `fix(deps): close Dependabot alert #214 — zod override, drop eslint-plugin-react-compiler`, holds the five files in files_modified; CHANGELOG.md and the package.json version stay untouched"
    artifacts:
        - path: package.json
          provides: zod override, plugin removed from devDependencies
          contains: '"zod": "$zod"'
        - path: package-lock.json
          provides: lockfile with zod 4.6.7 only
        - path: eslint.config.mjs
          provides: flat config without the React Compiler plugin
        - path: .planning/codebase/STACK.md
          provides: lint-tool list without the removed plugin
        - path: .planning/codebase/CONVENTIONS.md
          provides: lint-preset list without the removed plugin
    key_links:
        - from: 'package.json overrides `"zod": "$zod"`'
          to: 'package.json dependencies `"zod": "^4.6.7"`'
          via: 'npm `$name` reference — the only override form npm accepts for a package that is also a direct dependency'
        - from: 'node_modules/@serwist/build, cli, next, webpack-plugin (each declares `"zod": "4.6.5"`)'
          to: 'node_modules/zod 4.6.7'
          via: 'npm override — nested node_modules/zod copies disappear from the lockfile'
        - from: 'eslint.config.mjs `...reactHooks.configs.recommended.rules`'
          to: 'eslint-plugin-react-hooks 7.1.1 compiler-powered rules (purity, refs, set-state-in-effect, static-components, and others)'
          via: 'the existing spread — the config already turns several of these off, which shows they are active'
        - from: 'npm run build (`next build && serwist build`)'
          to: 'serwist.config.js validation by @serwist/build on zod 4.6.7'
          via: 'the build is the only runtime consumer of the overridden copies'
---

<objective>
Close Dependabot alert #214 (zod GHSA-mrhx-c7xc-m3w5, "Zod can exhaust memory while validating oversized constrained collections", vulnerable `< 4.6.6`, patched 4.6.6).

Two changes remove every vulnerable copy from package-lock.json:
1. A root npm override `"zod": "$zod"`. The four @serwist/* packages (build, cli, next, webpack-plugin, 9.5.13 = latest) pin `"zod": "4.6.5"` exactly; the override makes them resolve to the root zod 4.6.7.
2. Remove the ESLint React Compiler plugin (19.1.0-rc.2). It pulls zod 3.25.76 and zod-validation-error 3.5.4 (dev only), and it made GitHub's own security-update job fail. eslint-plugin-react-hooks 7 carries the React Compiler diagnostics, so no lint coverage is lost.

Purpose: the root app already runs zod 4.6.7; the vulnerable copies run only at build time (Serwist config validation) and in lint. The alert stays open while the lockfile lists them.

Output: package.json, package-lock.json, eslint.config.mjs and the two codebase-map docs, in ONE commit on branch `bugfix/zod-alert-214`.

Out of scope (do not do): CHANGELOG.md and the package.json `version` field (the orchestrator writes the 0.96.3 bump as the PR's last commit); pushing, opening a PR, or touching any other branch; ROADMAP.md; removing babel-plugin-react-compiler; `npm audit fix` in any form; deleting package-lock.json; copying env files into the lane; editing files in the main checkout (including its gitignored `.claude/CLAUDE.md`).
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@package.json
@eslint.config.mjs

Facts already established (2026-10-25, do not re-derive):
- Checkout: lane worktree `.worktrees/phase-1-1-production`, branch `bugfix/zod-alert-214`, base commit `10478b7b` (origin/develop, version 0.96.2). The lane has NO node_modules at start.
- Run node through mise: `mise exec -- <cmd>` (Node 26.12.1, npm 11.20.0). No `postinstall` script exists, so `npm ci` needs no env.
- `npx prisma generate` needs `POSTGRES_URL='postgresql://user:pass@localhost:5432/db'`. `npm run build` needs `POSTGRES_URL='postgresql://user:pass@localhost:5432/db' UPDATE_KEY=dummy UPDATE_INTERVAL=20`. lint, typecheck and test:unit need no env. A PreToolUse guard blocks copying `.env.development`; do not copy env files.
- Base lockfile zod copies: `node_modules/zod` 4.6.7; `node_modules/@serwist/{build,cli,next,webpack-plugin}/node_modules/zod` 4.6.5; the React Compiler plugin's nested zod 3.25.76 and zod-validation-error 3.5.4 (dev). Root `node_modules/zod-validation-error` is 4.0.2 and belongs to eslint-plugin-react-hooks 7.1.1 (`zod ^3.25.0 || ^4.0.0`) — it stays.
- Live references to the plugin, found by grep (CHANGELOG.md and `.planning/` history excluded): package.json line 72 (devDependency), eslint.config.mjs line 4 (import `reactCompiler`), line 54 (`plugins` entry), line 61 (rule set to `'warn'`), .planning/codebase/STACK.md line 40, .planning/codebase/CONVENTIONS.md line 39. No reference exists in `src/`, `docs/`, `.github/`, `src/__tests__/unit/_meta/`, and no source file has an eslint-disable comment for the plugin's rule.
- Grep-gate baselines at HEAD: the lowercase hyphenated plugin token appears 3 times in eslint.config.mjs (lines 4, 54, 61 — the comments say "React Compiler" with a space and do not match); the full plugin package name appears once in package.json and 5 times in package-lock.json; `overrides.zod` is undefined. Every gate below fails at HEAD and passes only after the change.
- `npm ls zod --all` output is not filtered by the rtk hook.
</context>

## Source Coverage Audit

| Source | Item | Covered by |
|--------|------|-----------|
| GOAL | Lockfile holds no zod < 4.6.6 (alert #214 closes on the next Dependabot scan) | Task 1 |
| GOAL | Root `"zod": "$zod"` override for the @serwist/* copies | Task 1 |
| GOAL | Plugin removed from devDependencies and eslint.config.mjs | Task 1 |
| GOAL | Every live doc reference updated | Task 2 |
| GOAL | Lint 0 errors (before/after warning counts recorded), typecheck, test:unit, build exit 0 | Task 1 (baseline), Task 2 (after) |
| GOAL | One commit with GHSA body and Co-Authored-By trailer | Task 2 |
| REQ | DEPS-01 (related, not ticked) | Task 1 |
| RESEARCH | none (quick mode, no research) | — |
| CONTEXT | none (no CONTEXT.md) | — |

<tasks>

<!-- planner-discipline-allow: eslint-plugin-react-compiler -->
<!-- planner-discipline-allow: react-compiler -->

<task type="tracer">
  <name>Task 1: Install, record the lint baseline, apply the override and remove the plugin — lockfile clean end to end</name>
  <files>package.json, package-lock.json, eslint.config.mjs</files>
  <action>
Work from the checkout root. Confirm the branch with `git branch --show-current` (must print `bugfix/zod-alert-214`) and the clean tree with `git status --porcelain`.

1. Install the committed lockfile as is: `mise exec -- npm ci`. This adds no new package; it installs the locked versions with their integrity hashes.

2. Record the lint baseline BEFORE any edit. Run `mise exec -- npx eslint . -f json -o "${TMPDIR:-/tmp}/261025-tlm-lint-before.json"` (it exits 0 when there are 0 errors), then print the totals with a one-line `node -e` that sums `errorCount` and `warningCount` over that JSON file. Expected: 0 errors, about 323 warnings. Write both numbers down for the SUMMARY and the commit body.

3. Edit package.json `overrides`: add the entry `"zod": "$zod"` as the first key of the block (above `postcss`), 4-space indent like the rest. Use the `$zod` reference form only: npm rejects a literal version spec for a package that is also a direct dependency. Do not change `dependencies.zod` (`^4.6.7`) or the `version` field.

4. Edit eslint.config.mjs: delete the plugin import on line 4 (the `reactCompiler` default import), delete the `reactCompiler` entry in the `plugins` map (line 54), and delete the plugin's single rule entry set to `'warn'` (line 61). Keep every `react-hooks/*` and `@eslint-react/*` rule and every comment as they are. Do not add a replacement comment: the `...reactHooks.configs.recommended.rules` spread already carries the compiler diagnostics.

5. Remove the package and rewrite the lockfile: `mise exec -- npm uninstall eslint-plugin-react-compiler`, then `mise exec -- npm install` (a no-op when the first command already applied the override). Do NOT touch babel-plugin-react-compiler: next.config.mjs `reactCompiler: true` needs it.

6. Check the result with the verify commands below. Fallback ONLY if a `node_modules/@serwist/*/node_modules/zod` entry is still in package-lock.json after step 5: delete exactly those nested keys from the lockfile `packages` object with a short `node -e` script (read, delete the keys, write back with 2-space JSON plus a trailing newline), delete the matching nested `node_modules/@serwist/*/node_modules/zod` directories, and run `mise exec -- npm install` again. Never delete the whole lockfile, never run `npm dedupe` or `npm update`, never run `npm audit fix`.

7. Run the lockfile drift gate (third verify command). It compares the lockfile with the base commit `10478b7b`. `changed` and `added` must both be empty. If either is not empty, stop and report the keys: an added or re-versioned package is outside this fix. Copy the `removed` list into the SUMMARY (expected: the plugin, its nested zod and zod-validation-error, the four @serwist nested zod copies, and any package only the plugin used).

Do not commit in this task: Task 2 makes the single commit.
  </action>
  <verify>
    <automated>node -e 'const p=require("./package-lock.json").packages;const bad=Object.entries(p).filter(([k,v])=>{if(!k.endsWith("node_modules/zod"))return false;const [M,m,x]=v.version.split(".").map(Number);return M<4||(M===4&&(m<6||(m===6&&x<6)))}).map(([k,v])=>k+"@"+v.version);const rc=Object.keys(p).filter(k=>k.includes("eslint-plugin-react-compiler"));console.log({bad,rc});process.exit(bad.length||rc.length?1:0)'</automated>
    <automated>test "$(mise exec -- npm ls zod --all | grep -o 'zod@[0-9][^ ]*' | sort -u)" = 'zod@4.6.7' && mise exec -- npm ls zod --all > /dev/null</automated>
    <automated>node -e 'const {execSync}=require("child_process");const a=JSON.parse(execSync("git show 10478b7b:package-lock.json",{maxBuffer:1<<30})).packages;const b=require("./package-lock.json").packages;const changed=Object.keys(b).filter(k=>k&&a[k]&&a[k].version!==b[k].version);const added=Object.keys(b).filter(k=>k&&!(k in a));const removed=Object.keys(a).filter(k=>!(k in b));console.log(JSON.stringify({changed,added,removed},null,1));process.exit(changed.length||added.length?1:0)'</automated>
    <automated>node -e 'const p=require("./package.json");const ok=p.overrides.zod==="$zod"&&p.dependencies.zod==="^4.6.7"&&!("eslint-plugin-react-compiler" in p.devDependencies)&&("babel-plugin-react-compiler" in p.devDependencies)&&p.version==="0.96.2";process.exit(ok?0:1)' && ! grep -q 'react-compiler' eslint.config.mjs && grep -q 'reactHooks.configs.recommended.rules' eslint.config.mjs</automated>
    <automated>mise exec -- npx eslint --print-config src/app/page.jsx > /dev/null</automated>
  </verify>
  <done>The lockfile lists zod 4.6.7 only and no React Compiler plugin entry; `npm ls zod --all` exits 0 and shows only zod@4.6.7; the lockfile diff against 10478b7b is removals only; package.json has the `$zod` override, keeps babel-plugin-react-compiler and version 0.96.2; ESLint loads the edited flat config. The baseline error and warning counts are recorded.</done>
</task>

<task type="auto">
  <name>Task 2: Update the codebase-map docs, run the full verify chain, make the single commit</name>
  <files>.planning/codebase/STACK.md, .planning/codebase/CONVENTIONS.md</files>
  <action>
1. Docs (live references only; CHANGELOG.md and other `.planning/` history stay as they are):
   - .planning/codebase/STACK.md line 40: delete the removed plugin from the comma-separated ESLint plugin list (the item between `eslint-plugin-react-hooks` and `eslint-plugin-jsdoc`, with its comma). Keep line 41 (babel-plugin-react-compiler) unchanged.
   - .planning/codebase/CONVENTIONS.md line 39: delete the last list item (the removed plugin with its `warn` level note) and its leading ` + `, so the sentence ends after the `eslint-plugin-compat` item with a period. Change the `eslint-plugin-react-hooks` recommended item to say it is v7 and carries the React Compiler diagnostics (for example: `eslint-plugin-react-hooks` 7 recommended (carries the React Compiler diagnostics)).
   - The gitignored `.claude/CLAUDE.md` exists only in the main checkout and is generated from these maps: do not edit it from the lane. Name it in the SUMMARY as a follow-up.

2. Full verify chain, in this order, from the checkout root:
   - `POSTGRES_URL='postgresql://user:pass@localhost:5432/db' mise exec -- npx prisma generate`
   - Lint after: `mise exec -- npx eslint . -f json -o "${TMPDIR:-/tmp}/261025-tlm-lint-after.json"`, then the comparison gate below (0 errors, warnings no higher than the baseline from Task 1). Also run `mise exec -- npm run lint` and confirm exit 0. Write the after counts down.
   - `mise exec -- npm run typecheck` and `mise exec -- npm run test:unit`
   - Build: `POSTGRES_URL='postgresql://user:pass@localhost:5432/db' UPDATE_KEY=dummy UPDATE_INTERVAL=20 mise exec -- npm run build`. This runs `serwist build` on zod 4.6.7 and must write public/sw.js.
   - If any step fails, report the failing output faithfully. Do not weaken, skip or disable a check to get a green result.

3. Format per project rule: `mise exec -- npm run lint:fix`. Then `git status --porcelain` must list only the five files in files_modified (plus the untracked quick-task directory). If lint:fix or the build changed any other tracked file, restore it with `git restore <file>` and name it in the SUMMARY.

4. Commit once, on `bugfix/zod-alert-214`. Stage the five files by name: `git add package.json package-lock.json eslint.config.mjs .planning/codebase/STACK.md .planning/codebase/CONVENTIONS.md`. Commit with three `-m` flags:
   - subject: `fix(deps): close Dependabot alert #214 — zod override, drop eslint-plugin-react-compiler`
   - body: names GHSA-mrhx-c7xc-m3w5 (zod < 4.6.6, memory exhaustion, CWE-770); says the four @serwist/* 9.5.13 packages pin zod 4.6.5 exactly and the root `"zod": "$zod"` override resolves them to 4.6.7; says the React Compiler ESLint plugin (19.1.0-rc.2) pulled zod 3.25.76, blocked GitHub's security update, and is removed because eslint-plugin-react-hooks 7 carries the compiler rules; gives the lint warning counts before and after.
   - trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
   Do not touch CHANGELOG.md or the version field. Do not push.
  </action>
  <verify>
    <automated>! grep -q 'eslint-plugin-react-compiler' .planning/codebase/STACK.md .planning/codebase/CONVENTIONS.md && grep -q 'babel-plugin-react-compiler' .planning/codebase/STACK.md && grep -q 'React Compiler diagnostics' .planning/codebase/CONVENTIONS.md</automated>
    <automated>node -e 'const s=f=>require(f).reduce((a,r)=>[a[0]+r.errorCount,a[1]+r.warningCount],[0,0]);const d=process.env.TMPDIR||"/tmp";const b=s(d+"/261025-tlm-lint-before.json"),a=s(d+"/261025-tlm-lint-after.json");console.log({before:b,after:a});process.exit(a[0]===0&&a[1]<=b[1]?0:1)'</automated>
    <automated>mise exec -- npm run lint && mise exec -- npm run typecheck && mise exec -- npm run test:unit</automated>
    <automated>set -o pipefail; POSTGRES_URL='postgresql://user:pass@localhost:5432/db' UPDATE_KEY=dummy UPDATE_INTERVAL=20 mise exec -- npm run build 2>&1 | tail -n 40 && test -s public/sw.js</automated>
    <automated>files="$(git show --name-only --format= HEAD)" && msg="$(git log -1 --format=%B)" && subj="$(git log -1 --format=%s)" && br="$(git branch --show-current)" && test "$(printf '%s\n' "$files" | sort | tr '\n' ' ')" = '.planning/codebase/CONVENTIONS.md .planning/codebase/STACK.md eslint.config.mjs package-lock.json package.json ' && printf '%s\n' "$msg" | grep -q 'GHSA-mrhx-c7xc-m3w5' && printf '%s\n' "$msg" | grep -q '^Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>$' && printf '%s\n' "$subj" | grep -q '^fix(deps): close Dependabot alert #214' && test "$br" = bugfix/zod-alert-214</automated>
  </verify>
  <done>Both codebase-map docs drop the removed plugin and keep babel-plugin-react-compiler; lint has 0 errors and no more warnings than the baseline (both counts recorded); typecheck, test:unit and build exit 0 and public/sw.js exists; HEAD is the single fix commit with exactly the five files, the GHSA id in the body and the Co-Authored-By trailer; nothing is pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → lockfile | Package versions and integrity hashes enter the tree here |
| developer config → @serwist/build | Serwist validates serwist.config.js with zod at build time (developer-authored input, not user input) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261025-tlm-01 | Denial of service | zod 4.6.5 nested under @serwist/{build,cli,next,webpack-plugin} (GHSA-mrhx-c7xc-m3w5, CWE-770) | medium | mitigate | Root override `"zod": "$zod"` resolves the copies to 4.6.7; Task 1 verify fails if any lockfile `node_modules/zod` entry is below 4.6.6 or `npm ls zod --all` prints a version other than 4.6.7. Severity is medium, not the advisory's high: the copies validate only developer-authored build config. The runtime validators already use the root 4.6.7. |
| T-261025-tlm-02 | Denial of service | zod 3.25.76 nested under the React Compiler ESLint plugin (dev only) | low | mitigate | The plugin is removed from devDependencies, package-lock.json and eslint.config.mjs (Task 1); eslint-plugin-react-hooks 7 keeps the compiler diagnostics. |
| T-261025-tlm-03 | Tampering | @serwist/* behaviour on a zod version they did not pin (4.6.5 → 4.6.7, patch) | low | mitigate | Task 2 runs the full `npm run build` (`next build && serwist build`) and requires public/sw.js to be written. |
| T-261025-tlm-SC | Tampering | npm installs (`npm ci`, `npm uninstall`, `npm install`) | high | mitigate | No new package name or version enters the tree: `npm ci` installs the committed lockfile with integrity hashes, the override resolves to zod 4.6.7 that is already locked at the root, and the uninstall only removes. The Task 1 drift gate against base 10478b7b fails on any added key or changed version, and the executor stops there. Because no package is added, no legitimacy checkpoint applies; the drift gate is the mechanical check that keeps it so. `npm audit fix` in any form is forbidden. |
</threat_model>

<verification>
- Lockfile: no `node_modules/zod` entry below 4.6.6, no React Compiler plugin key; drift against 10478b7b is removals only.
- `npm ls zod --all` exits 0 and prints only zod@4.6.7.
- package.json: `overrides.zod` is `$zod`; `dependencies.zod` is `^4.6.7`; babel-plugin-react-compiler stays; version stays 0.96.2.
- eslint.config.mjs: no React Compiler plugin import, plugin entry or rule; the react-hooks recommended spread stays.
- `npm run lint` (0 errors, warnings ≤ baseline), `npm run typecheck`, `npm run test:unit`, `npm run build` all exit 0; public/sw.js exists.
- One commit with exactly the five files.
</verification>

<success_criteria>
- Dependabot alert #214 has no remaining vulnerable path in package-lock.json (GitHub closes it on the next scan after merge).
- The four verify-chain commands are green on the commit's tree, and the SUMMARY records the lint warning counts before and after, the lockfile `removed` key list, and the `.claude/CLAUDE.md` follow-up.
- CHANGELOG.md, the version field, ROADMAP.md and every other branch are untouched; nothing is pushed.
</success_criteria>

<output>
Create `.planning/quick/261025-tlm-close-dependabot-alert-214-zod-override-/261025-tlm-SUMMARY.md` when done
</output>
