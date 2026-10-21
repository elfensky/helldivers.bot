---
phase: quick-261021-epu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
    - package.json
    - package-lock.json
    - next.config.mjs
    - sentry.server.config.js
    - src/instrumentation-client.js
    - vitest.visual.config.mjs
    - .github/dependabot.yml
    - src/shared/components/MermaidDiagram/MermaidDiagram.jsx # comment update, or selector fix only if Mermaid 12 changed the SVG structure
    - src/app/docs/infrastructure/page.mdx
    - .planning/codebase/STACK.md
    - .planning/codebase/INTEGRATIONS.md
    - CHANGELOG.md
autonomous: true
requirements: [DEPS-02]

estimate:
    tokens: 90000
    raw_tokens: 90000
    tasks: 3
    confidence: low

must_haves:
    truths:
        - npm run build loads next.config.mjs under @sentry/nextjs 11, because withSentryConfig is imported from @sentry/nextjs/config
        - The server Sentry init sends no local variable values and no database query data, and sends HTTP bodies only for incoming requests; the browser Sentry init sends no HTTP bodies; user info, cookies, headers and query parameters stay on (the v10 scope)
        - npm run lint, npm run typecheck, npm run test:unit and npm run build all exit 0 under Node 24 (mise) on the final tree; the test:coverage exit code is recorded in the SUMMARY
        - Dependabot puts vitest and @vitest/* updates in one group, listed before minor-and-patch, with no update-types limit; the two existing ignore entries are unchanged
        - Visual regression diff PNGs still land in .vitest-attachments/, the path CI uploads and .gitignore ignores
        - The Mermaid 12 SVG on /docs/architecture has the node ids, .flowchart-link data-id values and .edgeLabel elements MermaidDiagram parses, or the SUMMARY states this check is UNVERIFIED and why
        - CHANGELOG.md records the updates under the existing Unreleased heading; package.json version stays 0.95.6; no version section exists; nothing is pushed
    artifacts:
        - path: next.config.mjs
          provides: Sentry 11 build wrapper import
          contains: "from '@sentry/nextjs/config'"
        - path: sentry.server.config.js
          provides: server data collection scope
          contains: 'dataCollection'
        - path: src/instrumentation-client.js
          provides: browser data collection scope
          contains: 'dataCollection'
        - path: vitest.visual.config.mjs
          provides: visual diff folder that CI uploads
          contains: "attachmentsDir: '.vitest-attachments'"
        - path: .github/dependabot.yml
          provides: vitest group PR
          contains: "'@vitest/*'"
        - path: CHANGELOG.md
          provides: Unreleased entries for the nine Dependabot PRs
          contains: '#556'
    key_links:
        - from: next.config.mjs
          to: node_modules/@sentry/nextjs/build/cjs/config/index.js
          via: import of withSentryConfig from the @sentry/nextjs/config export
          pattern: "import \\{ withSentryConfig \\} from '@sentry/nextjs/config'"
        - from: src/instrumentation.js
          to: sentry.server.config.js
          via: dynamic import when SENTRY_DSN is set
          pattern: "import\\('../sentry.server.config'\\)"
        - from: vitest.visual.config.mjs
          to: .github/workflows/check-ci.yml
          via: attachmentsDir matches the upload-artifact path
          pattern: '\.vitest-attachments'
---

<objective>
Land the nine open Dependabot PRs #556 to #564 as one commit set on `chore/deps-majors` (DEPS-02). The
dependency install is already in the working tree (uncommitted `package.json` and `package-lock.json`,
`node_modules` installed). This plan makes that tree build and pass, keeps the Sentry data scope of
v10, fixes the two Vitest 5 and Sentry 11 behaviour changes, groups the vitest packages for Dependabot,
and records the change.

Purpose: one PR and one CI cycle replace nine bot PRs, four of which cannot pass alone (ERESOLVE).
Output: 4 to 6 small commits on the branch, all buildable; no push, no version bump.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

Environment rules for every task:

- Run every node, npm and npx command as `mise exec -- <command>`. Bare `node` is v26; the repo pins 24.
- The gitignored env files are absent and must not be copied. Pass the stub env inline:
  `POSTGRES_URL=postgresql://x:y@localhost:5432/ci UPDATE_KEY=ci-smoke-stub-key UPDATE_INTERVAL=3600`.
- Do NOT run `npm install`, `npm ci` or `npm update`, and do not change any version in `package.json`
  or `package-lock.json`. The installed tree is the one to land.
- Run `eslint --fix` only on the files you changed, never repo-wide.
- Commit trailer on every commit: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push, do not open a PR, do not bump the version, do not create a version section.
- A fix that needs more than ~5 files, or a design choice, stops and reports to the orchestrator.

Facts already measured on this tree (orchestrator and planner):

- `npm run lint` exit 0 (323 warnings, same as develop). `npm run test:unit` exit 0 (194 files, 2028 tests).
- `npm run typecheck` fails twice: `sentry.server.config.js` line 24 and `src/instrumentation-client.js`
  line 19, because Sentry 11 removed the boolean PII option.
- `npm run build` fails: `next.config.mjs` line 1 imports `withSentryConfig` from the `@sentry/nextjs`
  root, which no longer exports it. Sentry 11 exports it from the `./config` subpath. A named ESM import
  from `@sentry/nextjs/config` loads (checked under mise Node 24).
- The `withSentryConfig` options in use (`authToken`, `org`, `project`, `sentryUrl`) still exist in
  Sentry 11 (`node_modules/@sentry/core/build/types/build-time-plugins/buildTimeOptionsBase.d.ts`).
- Sentry 11 option shape: `node_modules/@sentry/core/build/types/types/datacollection.d.ts`. Keys used
  here: `httpBodies` (array of `'incomingRequest' | 'outgoingRequest' | 'incomingResponse' |
  'outgoingResponse'`), `databaseQueryData` (boolean), `stackFrameVariables` (boolean).
- Sentry is initialised in two places only: `sentry.server.config.js` (loaded by `src/instrumentation.js`
  when `SENTRY_DSN` is set) and `src/instrumentation-client.js`. There is no edge config.
- Vitest 5 changed the default `test.attachmentsDir` from `.vitest-attachments` to `.vitest/attachments`
  (`node_modules/vitest/dist/chunks/plugin.d.C8mmycim.d.ts`, `@default '.vitest/attachments'`).
  Screenshot diffs are written under `attachmentsDir`. `.gitignore` line 77, the CI upload step
  (`.github/workflows/check-ci.yml` line 56), `src/app/docs/testing/page.mdx` and
  `.planning/codebase/TESTING.md` all name `.vitest-attachments/`.
- No unit or visual test renders Mermaid. The CI Visual Regression job covers only `DashboardClient`,
  `EventCard` and `StatGrid`, so it does NOT check Mermaid 12. `MermaidDiagram.jsx` parses the Mermaid 11
  SVG: `.node` elements whose id matches `/flowchart-(.+)-\d+$/` (fallback: `data-id`),
  `.flowchart-link` paths with `data-id` starting `L_`, `.edgeLabel` and `.cluster` groups.
- The dev server on :3000 runs the main checkout (develop, Mermaid 11). It cannot show Mermaid 12.
</context>

<tasks>

<task type="tracer">
  <name>Task 1: Make the dependency tree build under Sentry 11 and commit it with the bump</name>
  <files>next.config.mjs, sentry.server.config.js, src/instrumentation-client.js, package.json, package-lock.json</files>
  <read_first>next.config.mjs (line 1 and lines 211-223), sentry.server.config.js, src/instrumentation-client.js</read_first>
  <action>
This is the end-to-end path: installed dependencies, then the Sentry config the server and the browser
load, then the Next build that loads `next.config.mjs`.

1. In `next.config.mjs` line 1, import `withSentryConfig` as a named import from `@sentry/nextjs/config`
   instead of the package root. Change nothing else in the file. The call at the bottom keeps its
   options and its existing comment.
2. In `sentry.server.config.js`, replace the line `sendDefaultPii: true,` with a `dataCollection` option:
   `httpBodies` set to an array with only `'incomingRequest'`, `databaseQueryData` set to false,
   `stackFrameVariables` set to false. All other `dataCollection` keys stay at their defaults (user info,
   cookies, headers and query parameters stay on, the same as v10). Put a one-line comment above it in the
   file's existing `//` style, worded like: "Sentry 11's defaults collect more than v10 did (local
   variables, DB query data, every HTTP body); keep the v10 scope." Do not name the removed option in the
   comment. Why: the default `localVariablesIntegration` would capture local values on the server, and
   those can hold a raw API key before hashing in `src/features/account/actions.mjs`.
3. In `src/instrumentation-client.js`, replace the line `sendDefaultPii: true,` with a `dataCollection`
   option whose `httpBodies` is an empty array, plus a one-line comment in the same style ("keep the v10
   scope: the browser SDK sent no HTTP bodies"). Do not name the removed option in the comment.
4. Run `mise exec -- npx eslint --fix next.config.mjs sentry.server.config.js src/instrumentation-client.js`
   (Prettier will wrap the server object over several lines; that is expected).
5. Run the stub-env chain: `npx prisma generate`, `npm run lint`, `npm run typecheck`, `npm run test:unit`,
   `npm run build`, each via `mise exec --`. All must exit 0. Also run the one-line `withSentryConfig`
   call from the verify block below: release builds set `SENTRY_AUTH_TOKEN` and take that branch, which a
   local build without a token never executes. Warnings are fine; a non-zero exit is not.
6. Fix any failure at its root cause. No `@ts-ignore`, no rule disabling, no test skipping, no version
   pinning back.
7. Commit `package.json`, `package-lock.json`, `next.config.mjs`, `sentry.server.config.js` and
   `src/instrumentation-client.js` together (the bump alone does not build, so it must not be a separate
   commit). Message subject: `chore(deps): land Dependabot PRs #556-#564 (vitest 5, Sentry 11, mermaid 12)`.
   Body: one line per package with old and new range (from `git diff package.json`), then one line for
   each Sentry fix (config import path, data-collection scope). Add the trailer.
  </action>
  <verify>
    <automated>export POSTGRES_URL=postgresql://x:y@localhost:5432/ci UPDATE_KEY=ci-smoke-stub-key UPDATE_INTERVAL=3600 && mise exec -- npx prisma generate && mise exec -- npm run typecheck && mise exec -- node --input-type=module -e "import { withSentryConfig } from '@sentry/nextjs/config'; const c = withSentryConfig({}, { authToken: 'x', org: 'o', project: 'p', sentryUrl: 'https://sentry.invalid' }); if (!c) process.exit(1); console.log('withSentryConfig ok', typeof c);" && mise exec -- npm run build && grep -c "dataCollection" sentry.server.config.js src/instrumentation-client.js && grep -n "from '@sentry/nextjs/config'" next.config.mjs</automated>
  </verify>
  <done>typecheck has 0 errors; `npm run build` exits 0; lint and test:unit exit 0; the `withSentryConfig` call with the release options returns a config; both Sentry inits use `dataCollection` with the scope above; one commit holds the bump and the Sentry fixes.</done>
</task>

<task type="auto">
  <name>Task 2: Keep visual diffs where CI uploads them, prove the Vitest 5 configs and coverage, group vitest for Dependabot</name>
  <files>vitest.visual.config.mjs, .github/dependabot.yml</files>
  <read_first>vitest.visual.config.mjs, .github/dependabot.yml</read_first>
  <action>
1. In `vitest.visual.config.mjs`, inside the `test` block, set `attachmentsDir` to `'.vitest-attachments'`
   with a one-line comment: Vitest 5 moved the default to `.vitest/attachments`, and the CI upload step,
   `.gitignore` and `/docs/testing` name this folder. This one line keeps all three correct; do not move
   the folder name in those files. Run `mise exec -- npx eslint --fix vitest.visual.config.mjs`.
2. Load each Vitest config under Vitest 5 without a browser or server:
   `mise exec -- npx vitest list --config vitest.config.mjs` and
   `SMOKE_ALLOW_SKIP=1 mise exec -- npx vitest list --config vitest.smoke.config.mjs`. Both must exit 0.
   Then try `mise exec -- npx vitest list --config vitest.visual.config.mjs`. It launches Chromium through
   Playwright. If it fails only because no local Playwright browser exists, do not install one: record in
   the SUMMARY that the visual config was not loaded locally and the CI Visual Regression job checks it
   (Docker is not running on this machine, so `scripts/visual-tests.sh` cannot run either).
3. Run `mise exec -- npm run test:coverage` once (stub env) to prove the `@vitest/coverage-v8` 5 provider
   works. Record its exit code and the summary line in the SUMMARY. A threshold failure unrelated to this
   change is a report item, not a fix target. A provider or config load error is a fix target.
4. After the test runs, `git status --porcelain` must show no new untracked path (for example a `.vitest/`
   folder). If one appears, find which run created it, and add it to `.gitignore` in the commit of step 1.
5. Commit step 1 alone: `fix(test): keep visual diff PNGs in .vitest-attachments under Vitest 5`.
6. In `.github/dependabot.yml`, npm ecosystem, `groups:` block: add a `vitest` group BEFORE
   `minor-and-patch` (Dependabot assigns a dependency to the first group that matches). Patterns `'vitest'`
   and `'@vitest/*'`, no `update-types` key. One-line comment above it: the vitest packages pin each other
   exactly, so a lone bump fails `npm ci` (#558, #561-#563). Keep the 4-space YAML indentation, single
   quotes, the `minor-and-patch` group and both `ignore` entries unchanged.
7. Commit: `chore(dependabot): group the vitest packages into one PR`.
  </action>
  <verify>
    <automated>export POSTGRES_URL=postgresql://x:y@localhost:5432/ci UPDATE_KEY=ci-smoke-stub-key UPDATE_INTERVAL=3600 && mise exec -- npx vitest list --config vitest.config.mjs > /dev/null && SMOKE_ALLOW_SKIP=1 mise exec -- npx vitest list --config vitest.smoke.config.mjs > /dev/null && grep -n "attachmentsDir: '.vitest-attachments'" vitest.visual.config.mjs && mise exec -- node -e "const d=require('yaml').parse(require('fs').readFileSync('.github/dependabot.yml','utf8'));const n=d.updates.find(u=>u['package-ecosystem']==='npm');const k=Object.keys(n.groups);const v=n.groups.vitest;if(k[0]!=='vitest'||!k.includes('minor-and-patch')||v['update-types']||!v.patterns.includes('vitest')||!v.patterns.includes('@vitest/*')||n.ignore.length!==2)process.exit(1);console.log('dependabot groups ok',k)"</automated>
  </verify>
  <done>The unit and smoke configs list under Vitest 5; the visual config load result is recorded; the test:coverage exit code is recorded; `attachmentsDir` keeps `.vitest-attachments`; the Dependabot `vitest` group is first and the ignores are unchanged; two commits exist.</done>
</task>

<task type="auto">
  <name>Task 3: Check Mermaid 12 rendering, update docs and CHANGELOG, run the final verify chain</name>
  <files>src/shared/components/MermaidDiagram/MermaidDiagram.jsx, src/app/docs/infrastructure/page.mdx, .planning/codebase/STACK.md, .planning/codebase/INTEGRATIONS.md, CHANGELOG.md</files>
  <read_first>src/shared/components/MermaidDiagram/MermaidDiagram.jsx (lines 1-100), src/app/docs/infrastructure/page.mdx (lines 295-312 and 369-380), CHANGELOG.md (lines 1-35)</read_first>
  <action>
A. Mermaid 12 runtime check, time-boxed to about 10 minutes. CLAUDE.md requires DevTools verification for
   rendering changes, and no automated test covers Mermaid.
   1. Start a dev server from this worktree on a free port, in the background:
      stub env plus `WORKER_ENABLED=false`, then `mise exec -- npx next dev -p 3100`. Do not touch the
      :3000 server; it runs develop.
   2. Wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/docs/architecture` gives 200.
   3. With the chrome-devtools MCP tools (no login needed), open `http://localhost:3100/docs/architecture`,
      wait for the diagram, and use `evaluate_script` to count inside the diagram container: `svg .node`;
      the `.node` elements whose id matches `/flowchart-(.+)-\d+$/` or that carry `data-id`;
      `.flowchart-link` elements whose `data-id` starts with `L_`; `.edgeLabel`. Click one node and confirm
      the detail panel opens. Trigger one flow filter and confirm some `.node` elements gain the dim class
      that `applyFlowFilter` sets. Read the console for errors.
   4. Stop the dev server. If `git status` shows files that `next dev` rewrote (for example the agent block
      in CLAUDE.md), restore them with `git checkout -- <file>`.
   5. Outcomes:
      - All counts are non-zero and both interactions work: change the three "Mermaid v11" comment mentions
        in `MermaidDiagram.jsx` to "Mermaid v12" (the DOM was verified against 12). Record the counts in the
        SUMMARY.
      - Counts are zero or interactions fail because Mermaid 12 changed ids, classes or `data-id`: adapt
        the selectors or the regex in `MermaidDiagram.jsx` at root cause, update its comments, re-run the
        check, and commit it alone as `fix(diagrams): match the Mermaid 12 SVG structure`. If the fix needs
        more than `MermaidDiagram.jsx`, or the new SVG lacks the node or edge information, stop and report
        to the orchestrator with sample ids, classes and `data-id` values.
      - The page does not render under the stub env, or the DevTools tools are not available: leave
        `MermaidDiagram.jsx` unchanged and record "Mermaid 12 rendering UNVERIFIED" with the exact blocker
        in the SUMMARY. Do not claim CI covers it.
B. Docs that describe the current setup:
   1. `src/app/docs/infrastructure/page.mdx`, "Shared SDK settings" snippet (line 305): replace the PII
      boolean line with the server `dataCollection` value from Task 1 and a short trailing comment ("keeps
      the v10 scope"). In the "Client-only additions" sentence below the snippet, add the client
      `dataCollection` value (no HTTP bodies). In the sentence "The `withSentryConfig` wrapper controls
      build-time behavior" (line 371), add that it is imported from `@sentry/nextjs/config`. Change nothing
      else on the page.
   2. `.planning/codebase/STACK.md`: Vitest 4.1.10 to 5.0.5 (line 31), `@sentry/nextjs` 10.68.0 to 11.8.0
      (line 52), `dotenv` 17.4.2 to 18.0.8 (line 53), `mermaid` 11.16.0 to 12.2.0 (line 56).
   3. `.planning/codebase/INTEGRATIONS.md` line 51: `@sentry/nextjs` 10.68.0 to 11.8.0.
   4. Leave historical records unchanged: `docs/superpowers/plans/**`, `.planning/quick/**`,
      `.planning/phases/**`, the advisory list in `.planning/codebase/CONCERNS.md`, and old CHANGELOG
      sections.
   5. Run `mise exec -- npx eslint --fix` on `MermaidDiagram.jsx` if it changed. Commit B (and a
      comment-only `MermaidDiagram.jsx` change) as
      `docs: describe the Sentry 11 data-collection scope and the bumped versions`.
C. `CHANGELOG.md`, under the existing empty `## Unreleased` heading. Style of the 0.95.6 section: `### Changed`
   and `### Fixed`, short plain sentences, end state only, wrapped near 78 columns.
   - Changed: Dependabot PRs #556 to #564 land together, with each package and its old and new range
     (`vitest`, `@vitest/browser`, `@vitest/browser-playwright` and `@vitest/coverage-v8` 4.1.11 to 5.0.5;
     `@sentry/nextjs` 10.68.0 to 11.8.0; `mermaid` 11.16.1 to 12.2.0; `dotenv` 17.4.2 to 18.0.8;
     `eslint-plugin-jsdoc` 63.3.2 to 65.3.11; `@types/node` 24.13.3 to 24.19.2).
   - Changed: Sentry keeps the data scope it had before Sentry 11. User info, cookies, headers and query
     parameters are sent. The server sends request bodies of incoming requests only, and no local variable
     values or database query data. The browser sends no HTTP bodies.
   - Changed: Dependabot opens one PR for `vitest` and `@vitest/*`, because the four packages pin each
     other exactly and a lone bump fails `npm ci`.
   - Fixed: `npm run build` works with `@sentry/nextjs` 11; `withSentryConfig` comes from
     `@sentry/nextjs/config`.
   - Fixed: visual regression diff PNGs stay in `.vitest-attachments/`, where CI uploads them on failure.
   - Fixed (only if step A needed a selector fix): the architecture diagrams filter and open node details
     with Mermaid 12.
   Do not add a version section and do not change the `package.json` version. Commit:
   `docs(changelog): record Dependabot PRs #556-#564`.
D. Final verify chain on the final tree (stub env): `npm run lint`, `npm run typecheck`,
   `npm run test:unit`, `npm run build`, each via `mise exec --`. All four must exit 0. Then
   `git status --porcelain -- . ':!.planning/quick'` must be empty (the orchestrator commits the quick-task
   PLAN and SUMMARY) and `git log --oneline origin/develop..HEAD` lists this plan's
   commits.
E. SUMMARY report items, in addition to the results above: the test:coverage exit code; the visual
   config load result; the Mermaid 12 result; that the `SENTRY_AUTH_TOKEN` build branch (sourcemap
   upload) first runs for real in the staging or release build; and these stale lines on
   `src/app/docs/infrastructure/page.mdx` that were left unchanged because they predate this change: the
   snippet's `tracesSampleRate: 1.0` for both runtimes, `autoSessionTracking: false` in the client, and
   `silent: true` in the `withSentryConfig` snippet.
  </action>
  <verify>
    <automated>export POSTGRES_URL=postgresql://x:y@localhost:5432/ci UPDATE_KEY=ci-smoke-stub-key UPDATE_INTERVAL=3600 && mise exec -- npm run lint && mise exec -- npm run typecheck && mise exec -- npm run test:unit && mise exec -- npm run build && grep -n "dataCollection" src/app/docs/infrastructure/page.mdx && grep -n "@sentry/nextjs/config" src/app/docs/infrastructure/page.mdx && grep -n "Vitest 5.0.5" .planning/codebase/STACK.md && grep -n "11.8.0" .planning/codebase/INTEGRATIONS.md && test "$(grep -m2 '^## ' CHANGELOG.md | tr '\n' '|')" = '## Unreleased|## 0.95.6|' && grep -n "#556" CHANGELOG.md && test "$(mise exec -- node -p "require('./package.json').version")" = 0.95.6 && test -z "$(git status --porcelain -- . ':!.planning/quick')"</automated>
  </verify>
  <done>The Mermaid 12 check has a recorded result (verified with counts, fixed, or UNVERIFIED with its blocker); the infrastructure docs page, STACK.md and INTEGRATIONS.md describe Sentry 11 and the new versions; CHANGELOG Unreleased has the Changed and Fixed bullets; lint, typecheck, test:unit and build exit 0; the tree is clean; version is 0.95.6; nothing is pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app server → GlitchTip | Server error events leave the host with request data and stack frames |
| browser → /api/glitchtip → GlitchTip | Client error events leave the visitor's browser through the tunnel |
| npm registry → node_modules | Third-party code enters the build and the runtime |
| CI build with SENTRY_AUTH_TOKEN → GlitchTip | Release builds upload sourcemaps with a secret token |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261021-01 | Information disclosure | `sentry.server.config.js` Sentry 11 defaults | high | mitigate | `stackFrameVariables: false` stops local values (for example a raw API key before hashing in `src/features/account/actions.mjs`) from reaching GlitchTip; `databaseQueryData: false`; `httpBodies` limited to `'incomingRequest'` (Task 1) |
| T-261021-02 | Information disclosure | `src/instrumentation-client.js` Sentry 11 defaults | medium | mitigate | `httpBodies: []`, so the browser sends no request or response bodies (Task 1) |
| T-261021-03 | Tampering | `withSentryConfig` release-build branch | medium | mitigate | The option names are checked against the Sentry 11 types and the call with the release option set runs in Task 1 verify; the real upload first runs in the staging or release build and is listed in the SUMMARY |
| T-261021-04 | Denial of service | Mermaid 12 rendering on `/docs/*` | low | accept | Diagram definitions are developer-authored config, not user input; Task 3 checks the rendered SVG |
| T-261021-SC | Tampering | npm installs | high | mitigate | No install runs in this plan. The installed versions are the ones Dependabot proposed from the npm registry, and the lockfile integrity hashes are committed unchanged. The executor must not run `npm install`, `npm ci` or `npm update` |
</threat_model>

<verification>
- Task 1 verify: typecheck 0 errors, build exit 0, `withSentryConfig` release-option call returns a config.
- Task 2 verify: unit and smoke configs list under Vitest 5; Dependabot `vitest` group first; `attachmentsDir` set.
- Task 3 verify: lint, typecheck, test:unit, build all exit 0 on the final tree; docs and CHANGELOG checks pass;
  version 0.95.6; clean tree.
- SUMMARY records: test:coverage exit code, visual config load result, Mermaid 12 result, untested
  sourcemap-upload branch, the stale infrastructure-docs lines.
</verification>

<success_criteria>
- Every commit on the branch builds; the dependency bump and the Sentry fixes share one commit.
- Sentry data collection matches the v10 scope on server and client.
- Vitest 5 configs load; coverage provider runs; visual diffs still go to `.vitest-attachments/`.
- Dependabot groups the four vitest packages.
- CHANGELOG Unreleased and the current-setup docs describe the end state.
- Nothing pushed; no version bump; no version section.
</success_criteria>

<output>
Create `.planning/quick/261021-epu-fold-dependabot-prs-556-564-vitest-5-sen/261021-epu-SUMMARY.md` when done.
</output>
