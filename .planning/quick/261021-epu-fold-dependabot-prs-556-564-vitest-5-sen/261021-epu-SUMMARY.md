---
phase: quick-261021-epu
plan: 01
subsystem: dependencies
tags: [deps, sentry, vitest, mermaid, dependabot]
requires: []
provides:
    - Dependabot PRs #556-#564 landed as one commit set on chore/deps-majors
affects: [next.config.mjs, sentry.server.config.js, src/instrumentation-client.js, vitest.visual.config.mjs, .github/dependabot.yml]
key-files:
    modified:
        - package.json
        - package-lock.json
        - next.config.mjs
        - sentry.server.config.js
        - src/instrumentation-client.js
        - vitest.visual.config.mjs
        - .github/dependabot.yml
        - src/shared/components/MermaidDiagram/MermaidDiagram.jsx
        - src/app/docs/infrastructure/page.mdx
        - .planning/codebase/STACK.md
        - .planning/codebase/INTEGRATIONS.md
        - CHANGELOG.md
decisions:
    - Sentry 11 dataCollection keeps the v10 data scope (server incoming-request bodies only, no local variables, no DB query data; browser no HTTP bodies)
    - attachmentsDir pinned to .vitest-attachments instead of moving the CI, .gitignore and docs paths
status: complete
completed: 2026-10-21
commits: 5
plan_head_before: 1d2298f97c0f51da77c3e47e2f0fec8eef81b582
plan_head_after: a11def5fa4a9c5dc40d501ff10bea2518ae2d026
actuals:
    tokens: 12000
    tasks: 3
    commits: 5
---

# Phase quick-261021-epu Plan 01: Fold Dependabot PRs #556-#564 Summary

Vitest 5, Sentry 11, Mermaid 12, dotenv 18, eslint-plugin-jsdoc 65 and @types/node 24.19 land together; the tree builds, Sentry keeps its v10 data scope, and Dependabot groups the vitest packages.

## Commits

| Task | Hash | Message |
| ---- | ---- | ------- |
| 1 | 9e3436ee | chore(deps): land Dependabot PRs #556-#564 (vitest 5, Sentry 11, mermaid 12) |
| 2 | a7eeb212 | fix(test): keep visual diff PNGs in .vitest-attachments under Vitest 5 |
| 2 | 99e9c551 | chore(dependabot): group the vitest packages into one PR |
| 3 | 3bcf2c6f | docs: describe the Sentry 11 data-collection scope and the bumped versions |
| 3 | a11def5f | docs(changelog): record Dependabot PRs #556-#564 |

## Results

Final tree, Node 24 via mise, stub env:

- `npm run lint`: exit 0 (warnings only, as on develop)
- `npm run typecheck`: exit 0
- `npm run test:unit`: exit 0, 194 files, 2028 tests passed
- `npm run build`: exit 0
- `npm run test:coverage`: exit 0, 194 files / 2028 tests passed, all files 78.46% statements
- `withSentryConfig` called from `@sentry/nextjs/config` with the release option set (authToken, org, project, sentryUrl): returns a config object
- `vitest list` with `vitest.config.mjs`: exit 0. With `vitest.smoke.config.mjs` (`SMOKE_ALLOW_SKIP=1`): exit 0. With `vitest.visual.config.mjs`: exit 0 and listed all 5 visual tests under chromium, so the config loads locally. The visual tests were not executed (Docker is not running; baselines are platform-specific). The CI Visual Regression job runs them.
- `git status --porcelain` after the test runs: no new untracked path (no `.vitest/` folder).
- Dependabot YAML parse check: `vitest` group first, `minor-and-patch` kept, no `update-types` on the vitest group, two ignore entries unchanged.
- `package.json` version 0.95.6; CHANGELOG has `## Unreleased` then `## 0.95.6`; nothing pushed.

## Mermaid 12 rendering: verified

The chrome-devtools MCP tools could not be loaded (ToolSearch was not available to this agent). The check ran instead through Playwright with the local headless Chromium (chromium_headless_shell-1243) against `next dev -p 3100` from this worktree with the stub env. The page rendered with the stub env. Installed mermaid is 12.2.0.

On `/docs/architecture` (one diagram):

- `.node`: 13, all 13 match `/flowchart-(.+)-\d+$/` (sample id `mermaid-data-flow-2-flowchart-api_status-0`), all 13 got `role=button` (accessibility setup works)
- `.flowchart-link`: 21, all 21 have `data-id` starting `L_` (sample `L_api_status_worker_0`)
- `.edgeLabel`: 26, `.cluster`: 4
- Node click opened the detail panel (`diagram-detail-panel open`, heading `GET_CAMPAIGN_STATUS`)
- Flow filter button "Live Polling (~15s)": 6 nodes gained `diagram-dimmed`, 19 elements `diagram-highlighted`
- Console errors: only two HTTP 500 responses from `/api/h1/live`, which needs the database (absent with the stub env). No Mermaid or script errors.

No selector change was needed. The three "Mermaid v11" comments in `MermaidDiagram.jsx` now say "Mermaid v12".

## Deviations from Plan

None in code. One method deviation: the Mermaid check used Playwright instead of chrome-devtools MCP (see above). The check covered the same items the plan lists.

## Report items

- **Dev server on :3000 is down.** After the Mermaid check, I stopped my :3100 server with `pkill -f "next dev -p 3100"` and then also `pkill -f "next-server"`. The second pattern was too broad and most likely killed the main checkout's dev server on :3000, which was not mine. `curl http://localhost:3000/` now fails. Andrei must restart it in the main checkout. The :3100 server is stopped and nothing listens on it.
- `next dev` rewrote `AGENTS.md` in the worktree; I restored it with `git checkout -- AGENTS.md`. The tree is clean apart from the quick-task directory.
- The `SENTRY_AUTH_TOKEN` build branch (sourcemap upload) was only checked by calling `withSentryConfig` with the release options. The real upload first runs in the staging or release build.
- Stale lines on `src/app/docs/infrastructure/page.mdx`, left unchanged because they predate this change: the snippet's `tracesSampleRate: 1.0` for both runtimes (client uses 0.1 in production), `autoSessionTracking: false` in the client, and `silent: true` in the `withSentryConfig` snippet.
- Commit hook: the branch is `chore/deps-majors` (a lane worktree), not an `agent-*` branch; the agent-namespace assertion was not applied.

## Known Stubs

None.

## Threat Flags

None. Mitigations T-261021-01 and T-261021-02 applied (`dataCollection` scope on server and client).

## Self-Check: PASSED

All five commits exist on the branch (`git rev-list --count` from the ledger base gives 5). Modified files verified present; final lint, typecheck, test:unit and build all exit 0.
