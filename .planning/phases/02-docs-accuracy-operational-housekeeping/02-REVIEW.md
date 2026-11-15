---
phase: 02-docs-accuracy-operational-housekeeping
reviewed: 2026-11-15T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - deploy/staging/compose.yaml
  - next.config.mjs
  - public/workers/cron.js
  - scripts/check-mermaid-fences.mjs
  - src/app/api/h1/update/route.js
  - src/app/docs/architecture/dataFlowConfig.mjs
  - src/app/docs/architecture/dataFlowDefinition.mjs
  - src/app/docs/architecture/page.mdx
  - src/app/docs/data-flow/page.mdx
  - src/app/docs/database/page.mdx
  - src/app/docs/infrastructure/page.mdx
  - src/app/docs/notifications/notificationFlowConfig.mjs
  - src/app/docs/notifications/page.mdx
  - src/app/docs/notifications/pushFlowConfig.mjs
  - src/app/docs/overviewConfig.mjs
  - src/app/docs/overviewDefinition.mjs
  - src/app/docs/page.mdx
  - src/app/docs/testing/page.mdx
  - src/shared/utils/initializeWorker.mjs
  - src/__tests__/unit/_meta/nextConfigSentry.test.mjs
  - src/__tests__/unit/_meta/mermaidFences.test.mjs
  - src/__tests__/unit/app/docs/diagrams.contract.test.mjs
  - src/__tests__/unit/_meta/docsRetiredStrings.test.mjs
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
  necessity: 0
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-11-15
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Source of truth was the read-only checkout at origin/develop (74b69088). Scope: the Sentry wrapper
options, the staging compose, the fence-check script, the comment-only edits, the docs and diagram
configs, and the four new tests.

What holds up:

- The comment-only edits in `route.js`, `cron.js` and `initializeWorker.mjs` change no behavior. The
  new text matches `src/instrumentation.node.js` (the worker starts after `migrateOrWait()`), `src/update/lease.mjs`
  and both compose files (`UPDATE_INTERVAL: '20'` on both stacks).
- `deploy/staging/compose.yaml` adds no secret. `SENTRY_DSN` is the public ingest key already present in
  the production compose and the client bundle. The comment about `src/instrumentation.js` reading it
  before the `*_FILE` values load is correct. The `environment` tag comes from the build-time
  `NEXT_PUBLIC_DEPLOY_ENV=staging` build arg, so the compose needs no `DEPLOY_ENV`.
- `errorHandler: (err) => { throw err; }` does propagate. `handleRecoverableError` in
  `@sentry/bundler-plugins` rethrows whatever the handler throws, from `createRelease`, `uploadSourcemaps`
  and `injectDebugIds`. The Sentry SDK `handleRunAfterProductionCompile` awaits these calls, so a thrown
  step error fails `next build`.
- The fence script has correct exit codes (1 on any failed fence or zero fences), and an unreadable file
  throws. The data-flow, infrastructure, testing and notifications pages match the code on every claim
  I traced (lease TTL, backoff, healthcheck, workflows, bucket default, npm scripts).

Concerns: the fail-closed claim of #661 is narrower than the docs state (WR-01). Several diagram detail
panels still misstate the schema and the worker (WR-02 to WR-04). The fence check covers fewer pages than
it claims (WR-05).

Known items, not re-reported: notification diagrams label the update route `POST` (DOCS-03, D-07);
`architecture/page.mdx:74` says new service workers wait for approval while `src/sw.js` sets
skipWaiting/clientsClaim; `X-Worker-Startup` is sent but not read.

## Warnings

### WR-01: "Fail closed" covers thrown errors only; a missing or partial Sentry configuration ships a build without maps

**File:** `next.config.mjs:213-231`, `src/app/docs/infrastructure/page.mdx:502`
**Issue:** The docs state that a failed upload fails the build and that `Pin Production` "cannot pin a
build without its maps (#661)". That holds only for errors the plugin throws. The plugin logs a warning
and returns, with no `errorHandler` call, in these cases (`@sentry/bundler-plugins`
`build-plugin-manager.js`: `canUploadSourceMaps` lines 530-558, `createRelease` from line 245, and the
"No source maps found" branch):

- `SENTRY_AUTH_TOKEN` is empty or unset. `Dockerfile.app` mounts the secret with `env=`, and the
  workflows pass `${{ secrets.SENTRY_AUTH_TOKEN }}`. A deleted, renamed or expired-and-blanked secret
  gives an empty value, `next.config.mjs:213` takes the no-wrapper branch, and the build succeeds with no maps.
- The token is set but `SENTRY_ORG` or `SENTRY_PROJECT` is empty. The plugin warns `Will not upload source maps`, returns, and
  `deleteArtifacts` then removes the maps. The build is green.
- The token is set and zero maps are found. The plugin warns and returns.

`Dockerfile.app` states the same intent: "if not passed, the env var is simply unset and the Sentry
plugin skips sourcemap upload gracefully". That contradicts the #661 goal for release and staging builds.
The result is a silent return of the exact failure #661 was meant to close (GlitchTip frames stay minified).
**Fix:** Add a guard in `build-release.yml` and `build-staging.yml` that fails when the four values are
empty (a `test -n` step before the image build). Or add an assertion in `next.config.mjs` for CI builds only:
```js
if (process.env.CI && !process.env.SENTRY_AUTH_TOKEN) {
    throw new Error('SENTRY_AUTH_TOKEN is required for CI image builds (#661)');
}
```
Then narrow the docs sentence to "A failed upload fails the build; missing credentials do not".

### WR-02: `dataFlowConfig.mjs` detail panels contradict the Prisma schema

**File:** `src/app/docs/architecture/dataFlowConfig.mjs:200, 210, 240-243, 273, 338-340`
**Issue:** The data-flow diagram panels are the first thing a reader opens. Against `prisma/schema.prisma:117-220` and the
`database/page.mdx` ERD, they state:

- `h1_season.season_duration` as `Int[]` and in the text as `season_duration[]`. The schema has `season_duration Int @default(0)`, a scalar.
- `h1_status.bucket` as `DateTime`. The schema has `bucket Int` (a unix-second window start). The same error is on `h1_statistic.bucket` (line 273) and `h1_event_progress.bucket` (line 338).
- `h1_status` has rows `points / points_max` and `players`. `h1_status` has `points`, `points_taken`, `time` and `status`. `points_max` lives on `h1_season`, and `players` lives on `h1_statistic`.
- `h1_event_progress` has a `points_max` row. The schema comment says `points_max` is constant and lives on `h1_event`. The key is `(type, event_id, bucket)`, not `(event_id, bucket)` (lines 321, 327).
- `h1_event` is described as "upsert by event_id". The unique key is `(type, event_id)`.

`database/page.mdx` has these right (`Int bucket`, `Int season_duration`), so the two pages disagree.
**Fix:** Change `['season_duration', 'Int[]']` to `'Int'` and drop `[]` in the text on line 200. Use `'Int (unix s)'` for every `bucket`. In
`h1_status` use `points, points_taken`, `time`, `status` and remove `players`. Remove `points_max` from `h1_event_progress`, and
use `(type, event_id, bucket)` and `upsert by (type, event_id)`.

### WR-03: Worker panel in the notification diagram says the worker polls the HD1 API on a default 20 s interval

**File:** `src/app/docs/notifications/notificationFlowConfig.mjs:37, 43`; `notificationFlowDefinition.mjs:5`
**Issue:** Three statements are wrong against the code:

- Line 37: "Dedicated Worker Thread that polls the official Helldivers 1 API every ~20 seconds". `public/workers/cronLogic.js:25-31` only
  fetches `http://localhost:<port>/api/h1/update`. Only the lease holder's update route calls HD1
  (`src/update/fetch.mjs`). The phase fixed this sentence on the other pages (`overviewConfig.mjs:114`,
  `dataFlowConfig.mjs:134`) but not here.
- Line 43: `UPDATE_INTERVAL env (default 20s)`. There is no default. `src/config/server.mjs:37` makes it required and
  `src/shared/utils/initializeWorker.mjs:30-33` and `initializeEnv.mjs:38` throw when it is unset. 20 is the value
  in the compose files and `.example.env`.
- `~20s` in the node label (`notificationFlowDefinition.mjs:5`, also `inAppFlowDefinition.mjs:6`) states a fixed interval for a
  configurable value. The retired-claim sweep 2 in `docsRetiredStrings.test.mjs` matches only `~15 ?s|every ~15`, so `~20s` passes it.

**Fix:** Use "calls the update route every `UPDATE_INTERVAL` seconds (required, 20 in both stacks); only the lease holder polls the
official API". Use `UPDATE_INTERVAL env (required)`. Change the node labels to `calls every UPDATE_INTERVAL s`. Widen sweep 2
to `/~\d+ ?s\b/`, then check that the remaining matches are real.

### WR-04: Overview diagram and panels misstate the code (file path, auth providers, worker edge)

**File:** `src/app/docs/overviewConfig.mjs:21, 103`; `src/app/docs/overviewDefinition.mjs:28`; `src/app/docs/database/page.mdx:431, 463, 483`
**Issue:**

- `overviewConfig.mjs:21` gives the Dashboard subtitle `src/app/(app)/page.jsx`. No `(app)` route group exists; the file is `src/app/page.jsx`.
- `overviewConfig.mjs:103` and `database/page.mdx:431,463,483` say OAuth is Discord and GitHub. `src/auth.js:39-52` configures Discord, GitHub and Google,
  and `src/app/sign-in/page.jsx:5,61` has a Google button. The Google client ids and secrets are in the production secret list in `deploy/README.md`.
- `overviewDefinition.mjs:28` draws `worker --> hd1`. The worker thread never contacts HD1. The edge that exists is `api_update` to HD1 through `updateStatus()`/`updateSeason()`
  (and only on the lease holder). The panel text for the same node says the worker calls the update route.

**Fix:** Change the subtitle to `src/app/page.jsx`. Name Discord, GitHub and Google in all four places. Replace `worker --> hd1` with `api_update --> hd1`.

### WR-05: The fence check covers 5 pages, but mermaid fences exist in 4 more, and the test says "every fence in the default docs pages"

**File:** `scripts/check-mermaid-fences.mjs:28-34`, `src/__tests__/unit/_meta/mermaidFences.test.mjs:10`
**Issue:** `DEFAULT_FILES` lists architecture, data-flow, infrastructure, database and testing. Fence counts in `src/app/docs/**/page.mdx`:
architecture 1, data-flow 2, infrastructure 3, database 2, and also `authentication` 2, `hd1-api` 2, `utilities` 1, `predict/defend` 1. Six fences in four pages are never parsed.
`testing/page.mdx` is on the list and has zero fences. These pages render fences as raw `<pre>` text (see script header), so no browser reports a broken fence,
and this check is the only guard. The zero-fence guard is global, so it cannot catch a page that silently drops out (for example a fence that someone indents or retitles).
**Fix:** Discover the pages instead of listing them (`readdirSync` recursive for `page.mdx` under `src/app/docs`). Drop `testing` if it stays empty.
Optionally print `0 fences` per file and fail when a page that had fences now has none.

## Info

### IN-01: `isWorkerEnabled` doc comment understates the accepted values

**File:** `src/shared/utils/initializeWorker.mjs:2`
**Issue:** The new comment starts "True unless WORKER_ENABLED is explicitly \"false\"". The code (line 11-12) also treats `0`, `no` and `off` as disabled, as `data-flow/page.mdx:138`
correctly says. No behavior change; the comment is imprecise.
**Fix:** "True unless WORKER_ENABLED is false, 0, no or off (case-insensitive)."

### IN-02: Fence parser edge cases pass silently

**File:** `scripts/check-mermaid-fences.mjs:43-49`
**Issue:** An opening fence with an info string (```` ```mermaid title=x ````) or an indented fence is skipped, not failed. A fence that never closes is read to end of file and parsed as one block, with no "unterminated fence" error.
Low risk today (all 13 current fences are plain), but the guard cannot see these forms.
**Fix:** Fail with `FAIL ... unterminated fence` when the inner loop reaches `lines.length`, and match `^\s*```mermaid` so an indented fence is checked or reported.

### IN-03: Sentry config test does not cover the fail-open path or the empty-token case

**File:** `src/__tests__/unit/_meta/nextConfigSentry.test.mjs:35-57`
**Issue:** The test does fail on the regressions it names (remove `deleteSourcemapsAfterUpload`, remove `errorHandler`, add `silent`, reintroduce `productionBrowserSourceMaps`). Its env handling is clean
(`stubEnv` plus `unstubAllEnvs`, `vi.resetModules` per load). Gaps: the `result toEqual { wrapped: true, config: wrappedConfig }` line is true by construction of the mock, and nothing exercises
`SENTRY_AUTH_TOKEN=''`, the real production no-token shape (see WR-01).
**Fix:** Add `vi.stubEnv('SENTRY_AUTH_TOKEN', '')` as a third case that asserts the wrapper is skipped, so the behavior is documented and a later guard (WR-01) has a place to change.

### IN-04: Contract test checks one direction only

**File:** `src/__tests__/unit/app/docs/diagrams.contract.test.mjs:43-53`
**Issue:** The test proves every `details` key is declared in the Mermaid source. It does not check that every `flows` entry is a `details` key, or that a diagram node has a panel. A flow list naming a node that no longer exists
passes. The `LR`/`TD` second tuple element is unused in both `it.each` blocks. jsdom is scoped to the file by the `@vitest-environment` comment, so there is no global leak.
**Fix:** Add `Object.values(config.flows).flat()` to the `missing` check against `Object.keys(config.details)`. Drop the unused tuple element.

---

_Reviewed: 2026-11-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
