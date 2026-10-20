---
phase: quick-261020-tlt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
    - package.json
    - package-lock.json
    - CHANGELOG.md
autonomous: true
requirements: [SEC-DEPS-01]

estimate:
    tokens: 60000
    raw_tokens: 60000
    tasks: 3
    confidence: low # estimate-calibration: factor 1, 0 samples

must_haves:
    truths:
        - The alert scan (every open Dependabot alert's vulnerable range checked against every entry of package-lock.json) prints "0 vulnerable lockfile entries" and exits 0
        - The lockfile holds next, @next/env, @next/mdx and @next/eslint-plugin-next at 16.3.8 (no 16.4.x), axios 1.20.0, mermaid 11.16.1, vitest, @vitest/mocker, @vitest/browser, @vitest/browser-playwright and @vitest/coverage-v8 at 4.1.11, serwist, @serwist/next and @serwist/cli at 9.5.13, and prisma still at 7.9.1
        - package.json overrides hold sharp ^0.35.5, brace-expansion ^5.0.12, mysql2 ^3.22.0 and katex ^0.18.2; no file under src contains the KaTeX math marker, so the katex override cannot change a rendered diagram
        - npm ci installs the committed lockfile without error and npm ls --all exits 0
        - npm run lint, npm run typecheck, npm run test:unit and npm run build all pass on the final tree
        - package.json, the lockfile's top-level version and its root package entry all read 0.95.3; CHANGELOG.md has an empty Unreleased section followed by a 0.95.3 section with a Security entry
        - The branch carries exactly two new commits, fix(deps) then chore(release) 0.95.3 as the last one, each ending with the Co-Authored-By trailer; nothing is pushed
    artifacts:
        - path: package.json
          provides: patched direct dependency ranges and the four security overrides
          contains: '"mysql2": "^3.22.0"'
        - path: package-lock.json
          provides: resolved tree with no copy inside an open alert range
          contains: '"version": "0.95.3"'
        - path: CHANGELOG.md
          provides: 0.95.3 Security entry
          contains: '## 0.95.3'
    key_links:
        - from: package.json overrides
          to: package-lock.json nested entries (prisma's mysql2, mermaid's katex, next's sharp)
          via: npm install --package-lock-only re-resolution
          pattern: '"mysql2": "\^3\.22\.0"'
        - from: package-lock.json
          to: CI verify action (.github/actions/verify/action.yml runs npm ci)
          via: npm ci
          pattern: 'npm ci'
        - from: package.json version
          to: '.github/workflows/check-version.yml (Check: Version Bump)'
          via: version differs from origin/develop
          pattern: '"version": "0.95.3"'
---

<objective>
Resolve every open Dependabot security alert on the repo (54 open at planning time, all against
package-lock.json, 3 of them critical remote-code-execution advisories in `next`) with the smallest
dependency change that reaches the patched versions, then ship it as patch release 0.95.3 on the
lane branch `bugfix/security-deps` (SEC-DEPS-01).

Purpose: production runs `next` 16.3.0, which is inside three critical advisories. The other alerts
cover the HTTP client the poller uses (`axios`), the docs diagrams (`mermaid`, `dompurify`, `katex`),
the build tool chain and the dev/test tool chain.

Output: package.json + package-lock.json with patched versions and four overrides, a CHANGELOG
Security entry, and two local commits (`fix(deps): ...` then `chore(release): 0.95.3`). No push, no
PR, no `.planning/` commit — the orchestrator owns those.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@package.json
@.github/actions/verify/action.yml

Environment rules (hard, from the orchestrator and CLAUDE.md):

- Work only in this worktree (branch `bugfix/security-deps`). Never touch the main checkout. Every
  command in this plan assumes cwd = the worktree root.
- The default `node` on PATH is v26; the repo pins Node 24 via `mise.toml`. Run every node/npm/npx
  command as `mise exec -- <cmd>` from the worktree root. Before Task 1, confirm
  `mise exec -- node --version` prints `v24.x` (verified at planning time: v24.15.0).
- Never read, copy or create `.env*` files. Commands that need env vars get placeholder values inline:
  `prisma generate` uses `POSTGRES_URL=postgresql://placeholder@localhost:5432/placeholder` (it does
  not connect); `npm run build` uses the same stub values as CI's verify action:
  `POSTGRES_URL=postgresql://ci:ci@localhost:5432/ci UPDATE_KEY=ci-stub-key UPDATE_INTERVAL=20`.
- Never run `npm audit fix` (with or without `--force`), never use `--force` or `--legacy-peer-deps`
  on install, and never run a bare `npm update` (it would move every caret range, e.g. `next` to
  16.4.x, `vitest` to 4.1.12).

Facts established at planning time (dry run of the full sequence below against a scratch copy of
package.json + package-lock.json):

- Every target version exists on the npm registry: next/@next/mdx/@next/eslint-plugin-next 16.3.8,
  axios 1.20.0, mermaid 11.16.1, vitest and @vitest/browser, @vitest/browser-playwright,
  @vitest/coverage-v8 4.1.11, serwist/@serwist/next/@serwist/cli 9.5.13, sharp 0.35.5,
  brace-expansion 5.0.12, mysql2 3.22.0, katex 0.18.2. Latest dist-tags are next 16.4.2,
  vitest 5.0.5, mermaid 12.2.0 — which is why every direct bump names an exact version.
- The vitest family peer-pins each other exactly (`vitest@4.1.10` peer-requires
  `@vitest/browser-playwright@4.1.10` and so on). An in-place `npm install vitest@4.1.11 ...` and a
  range edit plus `npm install` both fail with ERESOLVE. Uninstalling the four packages
  (lock-only) and installing them again at 4.1.11 resolves cleanly and leaves the package.json
  devDependencies diff limited to the four version strings.
- `@serwist/next` 9.5.13 replaces the exact `browserslist` 4.28.6 pin with ^4.29.3; the nested copy
  dedupes into the top-level `browserslist` (4.29.4).
- `npm update --package-lock-only dompurify source-map-js fast-uri nanoid undici` moves only those
  transitive packages (dry run: 3.4.17, 1.2.2, 3.1.9, 3.3.20, 8.12.3). The overrides resolved to
  sharp 0.35.5, brace-expansion 5.0.12, mysql2 3.24.6, katex 0.18.10.
- The only package name the new lockfile adds is `@rolldown/binding-android-arm-eabi` (an optional
  platform binary of the `@rolldown/binding-*` family already in the lock); `@rolldown/binding-wasm32-wasi`
  drops out. No new top-level package enters the tree.
- `grep -rnF '$$' src` (js/mjs/jsx/mdx) finds nothing: no Mermaid diagram uses KaTeX math.
- The alert scan in Task 1's verify printed 15 vulnerable entries / exit 1 on the base lockfile and
  "0 vulnerable lockfile entries" / exit 0 on the dry-run lockfile. `npm ls --all` exits 0 on the
  base tree.
- CHANGELOG convention: feature commits add entries under `## Unreleased`; the release commit inserts
  the `## X.Y.Z` heading (plus one blank line) directly under `## Unreleased`. A `### Security`
  heading with a bold lead sentence is an existing pattern (see `## 0.65.7`). Release commits are
  titled `chore(release): X.Y.Z`. The base lockfile's root version still reads 0.94.0 (drift); npm
  rewrites it to the package.json version on the first install.

Out of scope (do not touch): Dependabot PRs #551 and #504 (the orchestrator handles them), any Prisma
upgrade, any other dependency update, `npm run test:visual`, pushing, opening a PR.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Patch every vulnerable package in package.json and package-lock.json and prove it with the alert scan</name>
  <files>package.json, package-lock.json</files>
  <read_first>package.json (overrides block, dependencies, devDependencies), .github/actions/verify/action.yml (what CI runs on the lockfile)</read_first>
  <action>
End-to-end path for this slice: manifest edit, then lockfile re-resolution, then a clean install of
the lockfile, then the alert scan. Run each step in this order (the order is the one proven in the
dry run). All commands from the worktree root, prefixed `mise exec --`.

1. KaTeX guard (before the katex override is added). Run
   `grep -rnF '$$' src --include='*.mjs' --include='*.js' --include='*.jsx' --include='*.mdx'`.
   It must print nothing. If it prints any match inside a Mermaid definition, do NOT add the katex
   override: leave katex out, finish the rest, and report the katex alert as open with the matches.

2. Edit the `overrides` block of package.json with the Edit tool (keep 4-space indentation and the
   existing key order): change `sharp` from `^0.35.3` to `^0.35.5`; change `brace-expansion` from
   `^5.0.8` to `^5.0.12`; add `"mysql2": "^3.22.0"` and then `"katex": "^0.18.2"` directly after the
   `find-my-way` line, before the nested `prisma` object. Leave `postcss`, `better-sqlite3`, `valibot`,
   `find-my-way` and the nested `prisma` block unchanged. mysql2 is overridden because `prisma@7.9.1`
   pins `mysql2` exactly at 3.15.3; Prisma itself stays at 7.9.1 (an upgrade is out of scope).

3. Production dependencies at exact patched versions (npm writes a caret range, the lockfile pins the
   exact version): `mise exec -- npm install --package-lock-only --no-audit --no-fund next@16.3.8 @next/mdx@16.3.8 axios@1.20.0 mermaid@11.16.1 @serwist/next@9.5.13 serwist@9.5.13`.
   This also applies the overrides from step 2.

4. Vitest family (exact peer pins block an in-place move): first
   `mise exec -- npm uninstall --package-lock-only --no-audit --no-fund vitest @vitest/browser @vitest/browser-playwright @vitest/coverage-v8`,
   then
   `mise exec -- npm install -D --package-lock-only --no-audit --no-fund vitest@4.1.11 @vitest/browser@4.1.11 @vitest/browser-playwright@4.1.11 @vitest/coverage-v8@4.1.11 @next/eslint-plugin-next@16.3.8 @serwist/cli@9.5.13`.
   The `-D` keeps all six in devDependencies. Target is 4.1.11 per the orchestrator, not 4.1.12.

5. Transitive refresh inside existing parent ranges, naming only these five packages:
   `mise exec -- npm update --package-lock-only --no-audit --no-fund dompurify source-map-js fast-uri nanoid undici`.

6. Check the manifest diff with `git diff package.json`. Expected: only the version strings of the
   six production and six dev packages above, the two changed overrides and the two added overrides.
   Any other change (reordered keys, moved dependency type, reformatting) is a defect: fix it before
   continuing.

7. Supply-chain check: list the package names present in the new package-lock.json and absent from
   `git show HEAD:package-lock.json` (strip everything up to the last `node_modules/` in each
   `packages` key). Expected: only `@rolldown/binding-android-arm-eabi`. For any other new name,
   confirm it on `https://www.npmjs.com/package/<name>` and name its parent in the SUMMARY; if a name
   looks wrong (typosquat, no parent in the tree), stop and report instead of continuing.

8. Install the lockfile exactly as CI does, then regenerate the Prisma client:
   `mise exec -- npm ci`, then
   `POSTGRES_URL=postgresql://placeholder@localhost:5432/placeholder mise exec -- npx prisma generate`.
   `npm ci` fails if package.json and the lockfile disagree; treat that as a defect in steps 2-5.

9. Run the two checks in `<verify>` (pin check and alert scan) plus `mise exec -- npm ls --all` (must
   exit 0). Then record, without fixing anything: the full output of `mise exec -- npm audit --omit=dev`
   and of `mise exec -- npm audit` (counts by severity, and any remaining advisory with its package and
   path). If either audit reports an advisory, record it for the SUMMARY and the CHANGELOG; do not run
   any audit fix.

If the alert scan still reports an entry, read the printed lockfile path: a top-level transitive
entry gets a targeted `npm update --package-lock-only <name>`; a nested entry under a parent that
pins an old exact version gets reported to the orchestrator (do not add an unplanned override, do not
force). If `gh api` fails (no network or no auth), the scan command fails (it captures the `gh api` output
first), and an empty alert list exits 2 "no alerts read": report either case as a blocker; do not
substitute a weaker check.

No commit in this task (Task 2 commits after the verify chain passes).
  </action>
  <verify>
    <automated>mise exec -- node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package-lock.json","utf8")).packages,o=JSON.parse(fs.readFileSync("package.json","utf8")).overrides;const want={"next":"16.3.8","@next/env":"16.3.8","@next/mdx":"16.3.8","@next/eslint-plugin-next":"16.3.8","axios":"1.20.0","mermaid":"11.16.1","vitest":"4.1.11","@vitest/mocker":"4.1.11","@vitest/browser":"4.1.11","@vitest/browser-playwright":"4.1.11","@vitest/coverage-v8":"4.1.11","@serwist/next":"9.5.13","serwist":"9.5.13","@serwist/cli":"9.5.13","prisma":"7.9.1"};const ov={"sharp":"^0.35.5","brace-expansion":"^5.0.12","mysql2":"^3.22.0","katex":"^0.18.2"};const bad=[...Object.entries(want).filter(([n,v])=>p["node_modules/"+n]?.version!==v).map(([n,v])=>n+" lock="+p["node_modules/"+n]?.version+" want="+v),...Object.entries(ov).filter(([n,v])=>o[n]!==v).map(([n,v])=>"override "+n+"="+o[n]+" want="+v)];console.log(bad.length?bad.join("\n"):"pins and overrides ok");process.exit(bad.length?1:0)'</automated>
    <automated>a=$(gh api --paginate 'repos/elfensky/helldivers.bot/dependabot/alerts?state=open&per_page=100' --jq '.[] | [.dependency.package.name, .security_vulnerability.vulnerable_version_range] | @tsv') && printf '%s\n' "$a" | mise exec -- node -e 'const s=require("semver"),fs=require("fs");const pk=JSON.parse(fs.readFileSync("package-lock.json","utf8")).packages;const rows=fs.readFileSync(0,"utf8").trim().split("\n").filter(Boolean).map(l=>l.split("\t"));if(!rows.length){console.error("no alerts read");process.exit(2)}let bad=0;for(const [k,v] of Object.entries(pk)){if(!k||!v.version)continue;const n=k.slice(k.lastIndexOf("node_modules/")+13);const hit=rows.filter(([a,r])=>a===n&&s.satisfies(v.version,r.replace(/,/g,""),{includePrerelease:true}));if(hit.length){bad++;console.log("VULNERABLE",k,v.version,hit.map(h=>h[1]).join(" | "))}}console.log(bad+" vulnerable lockfile entries, "+rows.length+" alerts checked");process.exit(bad?1:0)'</automated>
    <automated>mise exec -- npm ls --all</automated>
  </verify>
  <done>Pin check prints "pins and overrides ok"; the alert scan prints "0 vulnerable lockfile entries, N alerts checked" with N greater than 0 and exits 0; `npm ls --all` exits 0; `npm ci` and `prisma generate` succeeded; the package.json diff holds only the planned version strings and overrides; the new-package-name list and both audit outputs are recorded for the SUMMARY.</done>
</task>

<task type="auto">
  <name>Task 2: Run the full verify chain, write the CHANGELOG entry and commit the fix</name>
  <files>CHANGELOG.md, package.json, package-lock.json</files>
  <read_first>CHANGELOG.md (lines 1-40 for the current format, and the `## 0.65.7` Security section for the heading style)</read_first>
  <action>
1. Run the project verify chain on the Task 1 tree, in this order, each via `mise exec --` from the
   worktree root: `npm run lint`, `npm run typecheck`, `npm run test:unit`, and the build with the CI
   stub env inline (see `<verify>`). All four must pass. Report any failure faithfully with its
   output. A failure caused by a bumped package (for example a new rule in
   `@next/eslint-plugin-next` 16.3.8, or a changed Next 16.3.8 build behavior) gets a real fix only if
   it is small and mechanical; read `node_modules/next/dist/docs/` before touching Next code. Anything
   larger: stop and report to the orchestrator. Never disable a rule, skip a test or weaken a check to
   get a green result.

2. Add the entry under `## Unreleased` in CHANGELOG.md (above `## 0.95.2`), in the existing style:
   a `### Security` heading, bullets with a bold lead sentence, lines wrapped near 80 characters,
   impersonal register, end state only (no process narrative). Content, with the real numbers and
   resolved versions read from the scan output and the lockfile (not from this plan):
   - Bold lead: every open Dependabot alert is resolved, including the critical
     remote-code-execution advisories in `next`; give the alert count from the scan line.
   - Direct dependencies, old version to new version: `next`, `@next/mdx` and
     `@next/eslint-plugin-next` 16.3.0 to 16.3.8 (kept on the 16.3 line); `axios` 1.18.1 to 1.20.0;
     `mermaid` 11.16.0 to 11.16.1; `vitest` and the `@vitest/*` packages 4.1.10 to 4.1.11;
     `serwist`, `@serwist/next` and `@serwist/cli` 9.5.12 to 9.5.13, which ends the exact
     `browserslist` 4.28.6 pin.
   - Overrides: `sharp` and `brace-expansion` raised to `^0.35.5` and `^5.0.12`; `mysql2`
     `^3.22.0` added because Prisma 7.9.1 pins 3.15.3 exactly (Prisma stays on 7.9.1); `katex`
     `^0.18.2` added because Mermaid still asks for 0.16, with the note that no diagram uses KaTeX
     math, so rendered diagrams are unchanged.
   - Lockfile refresh inside existing ranges: `dompurify`, `source-map-js`, `fast-uri`, `nanoid`,
     `undici` with their resolved versions.
   - The `npm audit` result (full and production-only) as recorded in Task 1.
   Do not add the `## 0.95.3` heading here (Task 3 does it).

3. Run `mise exec -- npm run lint:fix` (project rule before every commit). Then `git status --porcelain`
   must list only `package.json`, `package-lock.json`, `CHANGELOG.md` as modified (plus untracked
   `.planning/` files, which are not committed). If lint:fix changed any other file, stop and report.

4. Commit only those three files: `git add package.json package-lock.json CHANGELOG.md`, then one
   commit titled `fix(deps): patch every package with an open Dependabot alert`. Body: two to five
   short lines naming the direct bumps, the four overrides, the transitive refresh, the scan result
   and the audit result, then a blank line and the trailer line
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` as the last line. Do not commit
   `.planning/` files. Do not push.
  </action>
  <verify>
    <automated>mise exec -- npm run lint && mise exec -- npm run typecheck && mise exec -- npm run test:unit && POSTGRES_URL=postgresql://ci:ci@localhost:5432/ci UPDATE_KEY=ci-stub-key UPDATE_INTERVAL=20 mise exec -- npm run build</automated>
    <automated>c=$(git rev-list --grep='^fix(deps): ' origin/develop..HEAD) && test -n "$c" && test "$(echo "$c" | wc -l | tr -d ' ')" = 1 && b=$(git log -1 --format=%B "$c") && echo "$b" | grep -v '^$' | tail -1 | grep -q '^Co-Authored-By: Claude Opus 5.5 ' && f=$(git diff --name-only "$c^" "$c") && test "$(echo "$f" | sort | tr '\n' ' ')" = "CHANGELOG.md package-lock.json package.json " && s=$(git status --porcelain -- package.json package-lock.json CHANGELOG.md) && test -z "$s" && echo "fix commit ok"</automated>
  </verify>
  <done>Lint, typecheck, unit tests and build all pass on the patched tree; CHANGELOG.md has the Security entry under `## Unreleased`; HEAD is the `fix(deps):` commit touching exactly CHANGELOG.md, package-lock.json and package.json, ending with the Co-Authored-By trailer; the working tree has no uncommitted change to those files.</done>
</task>

<task type="auto">
  <name>Task 3: Release commit 0.95.3 (version bump as the last commit)</name>
  <files>package.json, package-lock.json, CHANGELOG.md</files>
  <read_first>CHANGELOG.md (lines 1-12)</read_first>
  <action>
Per CLAUDE.md Git Workflow rule 2 (the PR carries its own version bump, as its last commit).

1. Bump the patch version in package.json and in both root version fields of the lockfile with one
   command: `mise exec -- npm version 0.95.3 --no-git-tag-version`. It must not change anything else:
   `git diff package-lock.json` shows only the two `"version"` lines (top-level and
   `packages[""]`), `git diff package.json` only the `"version"` line.

2. In CHANGELOG.md insert `## 0.95.3` plus one blank line directly under the `## Unreleased` line and
   its blank line, so the Task 2 entry now sits under `## 0.95.3` and `## Unreleased` stays as an
   empty section (same shape as the `chore(release): 0.95.2` commit).

3. Commit exactly these three files with the title `chore(release): 0.95.3`, a blank line, and the
   trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` as the last line (no other body,
   matching the 0.95.2 release commit). No lint:fix change is expected here; still run
   `mise exec -- npm run lint:fix` before the commit and confirm it touched nothing. Do not push.
  </action>
  <verify>
    <automated>mise exec -- node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8")),l=JSON.parse(fs.readFileSync("package-lock.json","utf8")),c=fs.readFileSync("CHANGELOG.md","utf8");const ok=p.version==="0.95.3"&&l.version==="0.95.3"&&l.packages[""].version==="0.95.3"&&c.startsWith("# Changelog\n\n## Unreleased\n\n## 0.95.3\n\n### Security\n");console.log(ok?"release files ok":"release files MISMATCH");process.exit(ok?0:1)' && r=$(git rev-parse HEAD) && t=$(git log -1 --format=%s "$r") && test "$t" = 'chore(release): 0.95.3' && pt=$(git log -1 --format=%s "$r^") && echo "$pt" | grep -q '^fix(deps): ' && b=$(git log -1 --format=%B "$r") && echo "$b" | grep -v '^$' | tail -1 | grep -q '^Co-Authored-By: Claude Opus 5.5 ' && f=$(git diff --name-only "$r^" "$r") && test "$(echo "$f" | sort | tr '\n' ' ')" = "CHANGELOG.md package-lock.json package.json " && n=$(git rev-list --count origin/develop..HEAD) && test "$n" = 2 && echo "release commit ok"</automated>
  </verify>
  <done>package.json, the lockfile's top-level version and `packages[""]` all read 0.95.3; CHANGELOG.md starts with an empty `## Unreleased` followed by `## 0.95.3` and its `### Security` entry; the branch is exactly two commits ahead of origin/develop, `fix(deps): ...` then `chore(release): 0.95.3`, both ending with the trailer; nothing pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → package-lock.json / node_modules | Third-party code enters the build, the production image and the dev tool chain |
| internet → production app (`next` request handling) | Untrusted HTTP requests reach the framework that the critical advisories cover |
| app → official HD1 API (`axios` in `src/update/fetch.mjs`) | The poller sends and parses HTTP through the client with 14 open advisories |
| docs pages → browser (`mermaid`, `dompurify`, `katex`) | Diagram definitions render to SVG/HTML in the visitor's browser |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-tlt-01 | Elevation of privilege | `next` 16.3.0 (critical RCE advisories) | critical | mitigate | Task 1 pins `next`, `@next/env`, `@next/mdx`, `@next/eslint-plugin-next` at 16.3.8; the pin check asserts the exact versions and the alert scan asserts no copy remains in any open `next` range |
| T-tlt-02 | Information disclosure | `mysql2` 3.15.3 under `prisma` (credential sent in plaintext after an auth downgrade) | high | mitigate | Task 1 adds the `mysql2` `^3.22.0` override, which reaches the exact pin inside `prisma@7.9.1`; the alert scan checks every nested copy |
| T-tlt-03 | Tampering / Denial of service | `axios`, `undici`, `fast-uri`, `brace-expansion`, `sharp`, `source-map-js`, `nanoid`, `browserslist` | high | mitigate | Exact direct bumps, the raised overrides and the named `npm update` in Task 1; the alert scan reads each alert's own vulnerable range from the GitHub API, so the gate cannot drift from the alert list |
| T-tlt-04 | Tampering (XSS) | `mermaid`, `dompurify`, `katex` in docs diagrams | medium | mitigate | `mermaid` 11.16.1, `dompurify` refreshed inside `^3.3.3`, `katex` override `^0.18.2`; the KaTeX guard grep in Task 1 proves no diagram uses math, so the out-of-range katex major cannot change rendered output |
| T-tlt-05 | Tampering | lockfile drift between local install and CI | medium | mitigate | Task 1 runs `npm ci` from the written lockfile (fails on any package.json/lock mismatch) and `npm ls --all`; Task 2 runs the same four checks as `.github/actions/verify/action.yml` |
| T-tlt-06 | Denial of service | `vitest` / `@vitest/mocker` (dev-only tool chain) | medium | mitigate | Task 1 moves the whole vitest family to 4.1.11 together; dev-only, never in the production image |
| T-tlt-07 | Repudiation | release record | low | mitigate | Task 2 CHANGELOG entry names every package with old and new version and the audit result; Task 3 bumps 0.95.3 so `Check: Version Bump` passes and the release is traceable |
| T-tlt-SC | Tampering | npm installs in Task 1 | high | mitigate | No new package name is chosen: every bumped and overridden package already sits in the base lockfile, and each target version was confirmed on the npm registry at planning time. No RESEARCH.md exists (quick mode); the package-legitimacy gate's trigger (a new package name) does not apply, so no blocking human checkpoint is inserted. Task 1 step 7 lists every package name new to the lockfile (expected only `@rolldown/binding-android-arm-eabi`) and stops on any unexplained name; `npm ci` verifies the sha512 integrity of every tarball |
</threat_model>

<verification>
After Task 3, from the worktree root:

- Re-run both Task 1 `<automated>` checks (pin check, alert scan): "pins and overrides ok" and
  "0 vulnerable lockfile entries", exit 0.
- `git log --oneline origin/develop..HEAD` shows exactly two commits: `fix(deps): ...` then
  `chore(release): 0.95.3` on top.
- `git status --porcelain` shows no tracked-file change (only untracked `.planning/` artifacts).
- The verify chain result from Task 2 (lint, typecheck, test:unit, build) is recorded in the SUMMARY
  with pass/fail per command. The version-only release commit does not change code, so the chain is
  not re-run after Task 3.
</verification>

<success_criteria>
- 0 lockfile entries inside any open Dependabot alert range (alert scan exit 0); `npm audit` and
  `npm audit --omit=dev` results recorded verbatim in the SUMMARY.
- `next` stays on 16.3.x (16.3.8), `prisma` stays on 7.9.1, `mermaid` stays on 11.x, `vitest` stays
  on 4.1.11: no unrequested upgrade entered the tree.
- `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` all pass.
- Version 0.95.3 in package.json and the lockfile root; CHANGELOG `## 0.95.3` Security entry under an
  empty `## Unreleased`.
- Two local commits, release last, trailers present, nothing pushed, no `.planning/` file committed.
</success_criteria>

<output>
Create `.planning/quick/261020-tlt-resolve-all-open-dependabot-security-ale/261020-tlt-SUMMARY.md`
when done. Record: the resolved version of every package named in this plan, the new/removed
lockfile package names, the alert-scan line, both `npm audit` outputs (counts by severity), the
pass/fail of each verify command, both commit hashes, and residual risks for the orchestrator:
Dependabot closes the alerts only after the merge into `develop`; the PR's Visual Regression check
(not part of the local chain) covers the Mermaid/Next patch bumps on rendered pages; the open
Dependabot PRs #551 and #504 are untouched.
</output>
