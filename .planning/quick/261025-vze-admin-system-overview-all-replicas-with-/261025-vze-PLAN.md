---
phase: quick-261025-vze
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
    - prisma/schema.prisma
    - prisma/migrations/20261025220000_app_instance_api_key_last_used/migration.sql
    - vitest.setup.mjs
    - src/update/lease.mjs
    - src/update/instance.mjs
    - src/__tests__/unit/update/instance.test.mjs
    - src/app/api/healthcheck/route.js
    - src/__tests__/unit/app/api/healthcheck/route.test.mjs
    - src/app/api/h1/update/route.js
    - src/shared/utils/admin/computeReplicas.mjs
    - src/__tests__/unit/shared/utils/admin/computeReplicas.test.mjs
    - src/features/admin/actions.mjs
    - src/__tests__/unit/features/admin/actions.userAdmin.test.mjs
    - src/features/account/actions.mjs
    - src/shared/utils/api/validateApiKey.mjs
    - src/__tests__/unit/shared/utils/api/validateApiKey.test.mjs
    - src/features/admin/SystemOverview.jsx
    - src/__tests__/unit/features/admin/SystemOverview.test.jsx
    - src/features/admin/AdminApiKeys.jsx
    - src/features/account/ApiDashboard.jsx
    - src/app/docs/database/page.mdx
    - src/app/docs/infrastructure/page.mdx
    - src/app/docs/authentication/page.mdx
    - CHANGELOG.md
autonomous: true
requirements: [QUICK-261025-vze] # GitHub issue #596; no REQUIREMENTS.md ID covers it

estimate:
    tokens: 150000
    raw_tokens: 150000
    tasks: 3
    confidence: low

must_haves:
    truths:
        - "Every running process has exactly one `app_instance` row, keyed by its process-wide HOLDER_ID. `/api/healthcheck` refreshes it in `after()` at most once per 20 s per process, and the admin System Overview refreshes the serving process's row before it reads. The healthcheck test proves GET → after() → `db.app_instance.upsert` with HOLDER_ID."
        - "A failing registration never changes the healthcheck answer: a rejected upsert still returns 200 and the deferred callback resolves; the 503 path schedules no registration."
        - "The lease holder's hourly cleanup deletes `app_instance` rows last seen more than 24 h ago, next to `cleanupRateLimitWindows`, off the response path."
        - "Roles and states are derived on read, never stored: POLLER = row id equals `worker_heartbeat.holder_id` and `lease_until` is in the future; STANDBY = worker enabled; WEB ONLY = `worker_enabled` false. LIVE ≤ 90 s, LATE 90 s – 5 min, GONE > 5 min, hidden after 24 h. Version skew among LIVE replicas is a quiet note, and a warning once the newest version's earliest `started_at` is more than 10 min old. Unit tests cover every boundary."
        - "A valid, enabled API key whose `lastUsedAt` is null or older than 60 s schedules one conditional `updateMany` in `after()`; recent, invalid, disabled and missing keys write nothing, and the key lookup stays one query."
        - "The admin System Overview shows variant H: replica cards (poller first, POLLER badge, `bg-primary` rail; LATE `bg-warning` rail; others dim), the folded gone list, alert rows (version skew, no poller, last error), then the Health / Game data / Community tables in a 1 / md 2+span / lg 3 grid. The Health table says 'Polling since', and the old Uptime card is gone."
        - "The admin API keys table (after User) and the user's own key list (after Name) show a 'Last used' column, 'never' when null."
        - "The hand-written migration matches `prisma migrate diff --from-empty` output for the new table and column; `npm run lint`, `npm run typecheck`, `npm run test:unit` and the dummy-env `npm run build` all exit 0 on the final tree."
    artifacts:
        - path: prisma/migrations/20261025220000_app_instance_api_key_last_used/migration.sql
          provides: app_instance table and ApiKey.lastUsedAt column
          contains: 'CREATE TABLE "app_instance"'
        - path: src/update/instance.mjs
          provides: registerInstance (20 s throttle), listInstances and pruneInstances (24 h retention)
          contains: 'export async function registerInstance'
        - path: src/shared/utils/admin/computeReplicas.mjs
          provides: pure derivation of replicas / gone / liveVersions / skew / hasPoller
          contains: 'export function computeReplicas'
        - path: src/features/admin/SystemOverview.jsx
          provides: variant H layout
          contains: 'Polling since'
        - path: src/__tests__/unit/shared/utils/admin/computeReplicas.test.mjs
          provides: boundary tests for roles, states, skew
          contains: 'computeReplicas'
    key_links:
        - from: src/app/api/healthcheck/route.js
          to: src/update/instance.mjs
          via: "after(async () => tryCatch(registerInstance())) on the 200 path only"
        - from: src/update/instance.mjs
          to: src/update/lease.mjs
          via: "HOLDER_ID (process-wide through globalThis) is the row id, the same value claimLease writes to worker_heartbeat.holder_id, which is what makes the POLLER match work"
        - from: src/features/admin/actions.mjs (getSystemStats)
          to: src/update/instance.mjs + src/shared/utils/admin/computeReplicas.mjs
          via: "registerInstance() after requireAdmin, listInstances() in the Promise.all, ...computeReplicas(instances, heartbeat) spread into data"
        - from: src/app/api/h1/update/route.js
          to: src/update/instance.mjs
          via: "pruneInstances() inside the hourly cleanup after()"
        - from: src/shared/utils/api/validateApiKey.mjs
          to: ApiKey.lastUsedAt
          via: "after() → db.ApiKey.updateMany with the null-or-older-than-cutoff where clause"
        - from: vitest.setup.mjs
          to: every test that reaches db.app_instance
          via: "app_instance: createModelMock() in the @/db/db mock"
---

<objective>
Make the admin System Overview on `/profile` show every running app replica, mark the poller lease holder, show when each API key was last used, and regroup the panel into the approved variant H layout (GitHub issue #596).

Purpose: today the panel can only see the lease holder (`worker_heartbeat` is one row), its "Uptime" is really lease tenure, the poller name wraps mid-word, and API keys carry no usage signal. The design in issue #596 and the user's locked decisions (in the orchestrator's planning context, restated in each task below) are final; do not revisit them.

Output: one migration (new `app_instance` table + `ApiKey.lastUsedAt`), a small registry module written by the healthcheck, a pure read-model function, the rewritten panel, two "Last used" columns, docs and a CHANGELOG entry. Four commits.

Out of scope (do not do): the version bump (the orchestrator adds it as the PR's last commit); pushing or opening the PR; closing the issue; CLAUDE.md edits (Phase 2 DOCS-01 owns them); fixing unrelated stale rows in `/docs/database` (DOCS-02 owns them); a `data-umami-event` on the existing RefreshButton; any change to the healthcheck response body; a stored role column; registration from `/api/h1/update`; a startup `setInterval` reporter.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.claude/CLAUDE.md
@.planning/STATE.md
@/private/tmp/claude-501/-Users-andrei-Developer-helldivers-bot/5e948976-7792-49b5-abb8-cc0a7eddbc27/scratchpad/issue-body.md
@/private/tmp/claude-501/-Users-andrei-Developer-helldivers-bot/5e948976-7792-49b5-abb8-cc0a7eddbc27/scratchpad/mockup-reference.html
@node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md

Source files the tasks touch or mirror:
@prisma/schema.prisma
@prisma/migrations/20260827140000_worker_heartbeat_lease/migration.sql
@vitest.setup.mjs
@src/update/lease.mjs
@src/db/db.js
@src/shared/utils/initializeWorker.mjs
@src/app/api/healthcheck/route.js
@src/app/api/h1/update/route.js
@src/shared/utils/api/validateApiKey.mjs
@src/features/admin/actions.mjs
@src/features/account/actions.mjs
@src/shared/utils/admin/computeWorkerHealth.mjs
@src/features/admin/SystemOverview.jsx
@src/features/admin/AdminApiKeys.jsx
@src/features/account/ApiDashboard.jsx
@src/__tests__/unit/app/api/healthcheck/route.test.mjs
@src/__tests__/unit/shared/utils/api/validateApiKey.test.mjs
@src/__tests__/unit/features/admin/actions.userAdmin.test.mjs
@src/__tests__/unit/shared/components/Header/Header.test.jsx

Environment rules for every task:

- Work only in the lane worktree root (`feature/system-overview-replicas`). Never read or edit the main checkout. Dependencies and the Prisma client are installed; Node v26.12.1 is active.
- No database is reachable. Never read, copy or create any `.env*` file other than `.example.env`: a secret guard blocks it. Do not work around it.
- Prisma and the build take non-secret dummies inline: `POSTGRES_URL='postgresql://user:pass@localhost:5432/db'` for `npx prisma validate|generate|migrate diff`, and `POSTGRES_URL='postgresql://user:pass@localhost:5432/db' UPDATE_KEY=dummy UPDATE_INTERVAL=20 npm run build`. If the build fails for any reason other than these vars, stop and report the output; do not change unrelated code.
- The dev server on :3000 runs from the main checkout. Do not stop or restart it.
- Do not run `npm install`, `npm ci` or `npm update`.
- Use `tryCatch` (src/shared/utils/tryCatch.mjs), never try/catch blocks. Report swallowed failures with `reportError(error, { route, stage, level: 'warning' })`, the same way the hourly cleanup in src/app/api/h1/update/route.js does.
- Keep Prisma's field names (`last_seen`, `started_at`, `worker_enabled`, `lastUsedAt`) in the data passed around; do not remap them to camelCase.
- Before each commit run `npm run lint:fix`, then `git status --short`. If it changed a file outside `files_modified`, restore it with `git checkout -- <file>` and note it in the SUMMARY.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

Gate baselines recorded at HEAD d29da2ab (each deliverable gate below fails at HEAD, so a pass proves the change; counts are `grep -cF`):

- prisma/schema.prisma: `model app_instance` 0, `lastUsedAt` 0. No migration directory name contains `app_instance`.
- vitest.setup.mjs: `app_instance` 0. src/update/lease.mjs: `globalThis` 0.
- src/app/api/healthcheck/route.js: `after(` 0. src/app/api/h1/update/route.js: `pruneInstances` 0. src/shared/utils/api/validateApiKey.mjs: `lastUsedAt` 0.
- src/features/admin/actions.mjs and src/features/account/actions.mjs: `lastUsedAt` 0 each.
- src/features/admin/SystemOverview.jsx: `Polling since` 0, `data-umami-event` 0, and the old uptime card literal `label="Uptime"` 1 (must become 0).
- src/features/admin/AdminApiKeys.jsx and src/features/account/ApiDashboard.jsx: `Last used` 0 each.
- src/app/docs/database/page.mdx: `app_instance` 0, `lastUsedAt` 0. src/app/docs/infrastructure/page.mdx: `app_instance` 0. src/app/docs/authentication/page.mdx: `lastUsedAt` 0.
- CHANGELOG.md: the `## Unreleased` section is empty.
- These files do not exist yet: src/update/instance.mjs, src/shared/utils/admin/computeReplicas.mjs, src/__tests__/unit/features/admin/SystemOverview.test.jsx, src/__tests__/unit/update/instance.test.mjs, src/__tests__/unit/shared/utils/admin/computeReplicas.test.mjs.
- `/docs` .mdx files are not covered by ESLint/Prettier. Do not reformat them; edit only the lines named in Task 3.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Replica registry write path end to end: healthcheck → registry → Prisma → migration</name>
  <files>prisma/schema.prisma, prisma/migrations/20261025220000_app_instance_api_key_last_used/migration.sql, vitest.setup.mjs, src/update/lease.mjs, src/update/instance.mjs, src/__tests__/unit/update/instance.test.mjs, src/app/api/healthcheck/route.js, src/__tests__/unit/app/api/healthcheck/route.test.mjs, src/app/api/h1/update/route.js</files>
  <behavior>
    - Healthcheck (real registry module, db mocked): GET on the 200 path calls `after()` once; running the captured callback calls `db.app_instance.upsert` with `where: { id: HOLDER_ID }`. The response body is unchanged (the existing `toEqual` assertion still passes).
    - Healthcheck: when `db.app_instance.upsert` rejects, GET still returns 200, the captured callback resolves without throwing, and `reportError` is called with `expect.objectContaining({ route: '/api/healthcheck', stage: 'instance-register', level: 'warning' })`.
    - Healthcheck: on the 503 path (`db.$queryRaw` rejects) `after()` is not called.
    - registerInstance(now): the first call upserts `{ where: { id: HOLDER_ID }, create: { id: HOLDER_ID, host, version, worker_enabled, started_at, last_seen: new Date(now) }, update: { host, version, worker_enabled, started_at, last_seen: new Date(now) } }`, where `host` is `HOLDER_ID.split(':')[0]` and `started_at` is a Date. A call at now + 19_999 writes nothing; a call at now + 20_000 writes again.
    - registerInstance with `vi.stubEnv('WORKER_ENABLED', 'false')` writes `worker_enabled: false`.
    - listInstances(now) calls `db.app_instance.findMany({ where: { last_seen: { gte: new Date(now - 86_400_000) } } })` and returns its result.
    - pruneInstances(now) calls `db.app_instance.deleteMany({ where: { last_seen: { lt: new Date(now - 86_400_000) } } })`.
  </behavior>
  <action>
Schema and migration (one migration for both columns, so deploy is one step):
- In prisma/schema.prisma add a new region after `// #region WORKER HEALTH` … `// #endregion`, named `// #region APP INSTANCES`, with a one-line comment (one row per running process, written by /api/healthcheck, roles derived on read — #596) and `model app_instance` with fields: `id String @id` (comment: HOLDER_ID, host:pid:nonce), `host String`, `version String`, `worker_enabled Boolean`, `started_at DateTime`, `last_seen DateTime`. No index: the table holds a handful of rows and is pruned hourly.
- In `model ApiKey` add `lastUsedAt DateTime?` after `enabled` (camelCase, like `createdAt` in that model).
- Create prisma/migrations/20261025220000_app_instance_api_key_last_used/migration.sql by hand, in the style of 20260827140000_worker_heartbeat_lease: a comment line, then `CREATE TABLE "app_instance"` with TEXT/TEXT/TEXT/BOOLEAN/TIMESTAMP(3)/TIMESTAMP(3) NOT NULL columns and `CONSTRAINT "app_instance_pkey" PRIMARY KEY ("id")`, then a comment line and `ALTER TABLE "ApiKey" ADD COLUMN "lastUsedAt" TIMESTAMP(3);`. Cross-check the CREATE TABLE block against the output of `POSTGRES_URL='postgresql://user:pass@localhost:5432/db' npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` (works offline) and make the column lines identical. Then run `npx prisma validate` and `npx prisma generate` with the same dummy POSTGRES_URL so `db.app_instance` exists for typecheck.
- In vitest.setup.mjs add `app_instance: createModelMock(),` to the `@/db/db` mock, under the `worker_heartbeat` entry with an `// App instance registry` comment.

Process-wide HOLDER_ID:
- In src/update/lease.mjs change `HOLDER_ID` to `(globalThis.holderIdGlobal ??= makeHolderId())`, with a one-line why comment: Next.js can load a module more than once per process (one copy per route bundle), the same reason src/db/db.js caches the Prisma client on globalThis; the registry row id must equal the holder id that claimLease writes. `makeHolderId` and its tests stay unchanged.

Registry module src/update/instance.mjs (new, about 50 lines, JSDoc on each export):
- Imports: `db` from '@/db/db', `HOLDER_ID` from '@/update/lease.mjs', `isWorkerEnabled` from '@/shared/utils/initializeWorker.mjs', `performance` from 'node:perf_hooks'.
- Module constants: `REGISTER_INTERVAL_MS = 20_000`, `RETENTION_MS = 24 * 3_600_000`, `STARTED_AT = new Date(performance.timeOrigin)` (Node's process start time), and `let lastRegistered = 0`.
- `export async function registerInstance(now = Date.now())`: return early when `now - lastRegistered < REGISTER_INTERVAL_MS`; set `lastRegistered = now` before the write (a failed write retries on the next window, so concurrent calls never double-write); build one `row` object `{ host: HOLDER_ID.split(':')[0], version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown', worker_enabled: isWorkerEnabled(), started_at: STARTED_AT, last_seen: new Date(now) }` and `await db.app_instance.upsert({ where: { id: HOLDER_ID }, create: { id: HOLDER_ID, ...row }, update: row })`. Use Prisma with JS Dates only, no raw SQL, so every timestamp is UTC by Prisma's own convention (the lease.mjs clock note does not apply).
- `export function listInstances(now = Date.now())`: `findMany` with `last_seen >= now - RETENTION_MS` (this is where GONE rows disappear after 24 h).
- `export function pruneInstances(now = Date.now())`: `deleteMany` with `last_seen < now - RETENTION_MS`.

Healthcheck writer (src/app/api/healthcheck/route.js):
- Import `after` from 'next/server' and `registerInstance` from '@/update/instance.mjs'. Only on the success path, after the DB ping passed and before `return successResponse(...)`, call `after(async () => { ... })` that awaits `tryCatch(registerInstance())` and, on error, calls `reportError(error, { route: '/api/healthcheck', stage: 'instance-register', level: 'warning' })`. The 503 branch stays exactly as it is (the DB is down, a write would only add noise). The response body and status logic do not change. The route is public; the per-process throttle bounds writes, and nothing from the request reaches the write.

Prune (src/app/api/h1/update/route.js):
- Import `pruneInstances` from '@/update/instance.mjs'. Inside the existing hourly `after()` callback, after the `cleanupRateLimitWindows` block, add a second `tryCatch(pruneInstances())` whose error is reported with `stage: 'instance-prune'`, `level: 'warning'`, `route: '/api/h1/update'`. Extend the comment above `lastRateLimitCleanup` by one clause saying the same hourly pass prunes `app_instance`. Keep the variable name (CLAUDE.md cites it).

Tests (tdd: write them first, see them fail, then implement):
- New src/__tests__/unit/update/instance.test.mjs covering the registerInstance/listInstances/pruneInstances behavior. Module state persists inside the file, so pass explicit, strictly increasing `now` values across all tests (for example base `Date.parse('2030-01-01T00:00:00Z')` plus one hour per test). Import `HOLDER_ID` from '@/update/lease.mjs' for the expected id.
- Extend src/__tests__/unit/app/api/healthcheck/route.test.mjs with the three healthcheck cases. Use the real registry (do not mock '@/update/instance.mjs'): capture the callback with `vi.mocked(after).mockImplementation((fn) => { deferred = fn(); })` (the pattern in src/__tests__/unit/app/api/h1/update/route.test.mjs) and await it. Because the 20 s throttle lives in the module, in `beforeEach` advance a fake clock: `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(clock += 60_000)` from a fixed base, with `vi.useRealTimers()` in `afterEach`. Keep the existing tests and their assertions.
  </action>
  <verify>
    <automated>POSTGRES_URL='postgresql://user:pass@localhost:5432/db' npx prisma validate && POSTGRES_URL='postgresql://user:pass@localhost:5432/db' npx prisma generate && POSTGRES_URL='postgresql://user:pass@localhost:5432/db' npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script | grep -A 8 'CREATE TABLE "app_instance"' && grep -F 'CONSTRAINT "app_instance_pkey" PRIMARY KEY ("id")' prisma/migrations/20261025220000_app_instance_api_key_last_used/migration.sql && grep -F 'ADD COLUMN "lastUsedAt" TIMESTAMP(3)' prisma/migrations/20261025220000_app_instance_api_key_last_used/migration.sql && grep -cF 'app_instance' vitest.setup.mjs && grep -cF 'globalThis' src/update/lease.mjs && grep -cF 'after(' src/app/api/healthcheck/route.js && test "$(grep -cF 'pruneInstances' src/app/api/h1/update/route.js)" -ge 2 && npx vitest run src/__tests__/unit/app/api/healthcheck/route.test.mjs src/__tests__/unit/update/instance.test.mjs src/__tests__/unit/update/lease.test.mjs src/__tests__/unit/app/api/h1/update/route.test.mjs && npm run lint && npm run typecheck && npm run test:unit</automated>
  </verify>
  <done>The healthcheck test proves GET → after() → `db.app_instance.upsert(HOLDER_ID)` and that a failed upsert still answers 200; instance tests prove the 20 s throttle, the 24 h list cutoff and the prune; the migration matches `prisma migrate diff`; lint, typecheck and the full unit suite pass. Commit: `feat(admin): register app replicas in app_instance from the healthcheck (#596)`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Read model: derive replica roles, states and skew; serve them and API key last use</name>
  <files>src/shared/utils/admin/computeReplicas.mjs, src/__tests__/unit/shared/utils/admin/computeReplicas.test.mjs, src/features/admin/actions.mjs, src/__tests__/unit/features/admin/actions.userAdmin.test.mjs, src/features/account/actions.mjs, src/shared/utils/api/validateApiKey.mjs, src/__tests__/unit/shared/utils/api/validateApiKey.test.mjs</files>
  <behavior>
    computeReplicas(instances, heartbeat, now), with now = Date.parse('2026-10-25T12:00:00Z'):
    - A row seen 30 s ago whose id equals `heartbeat.holder_id` and `lease_until` = now + 30 s → `role: 'poller'`, `state: 'live'`, first in `replicas`, and `hasPoller` is true.
    - Same row but `lease_until` = now − 1 s → `role: 'standby'`; `hasPoller` false.
    - `worker_enabled: false`, seen 10 s ago → `role: 'web'`.
    - Seen exactly 90 s ago → `state: 'live'`; 90_001 ms → `state: 'late'` (still in `replicas`).
    - Seen exactly 300 s ago → `'late'`; 300_001 ms → in `gone`, not in `replicas`.
    - `gone` is sorted newest `last_seen` first; `replicas` is poller first, then by `host`.
    - Live versions '0.96.4' and '0.97.0' → `liveVersions` equals ['0.96.4', '0.97.0']; `skew.since` is the earliest `started_at` among LIVE '0.97.0' rows; `skew.alert` is false at 9 min, true at 11 min.
    - '0.100.0' sorts after '0.99.9'.
    - A LATE replica on another version does not create skew; a single live version → `skew: null`.
    - `heartbeat` null → every enabled replica is 'standby' and `hasPoller` false.
    - Date objects and ISO strings both work for `last_seen`, `started_at`, `lease_until`.
    validateApiKey:
    - Valid enabled key with `lastUsedAt: null` → `after()` called once; awaiting the callback calls `db.ApiKey.updateMany` with `where: { id: 'key-1', OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: expect.any(Date) } }] }` and `data: { lastUsedAt: expect.any(Date) }`.
    - `lastUsedAt` 61 s ago → `after()` called; 10 s ago → not called.
    - Disabled, unknown, missing and db-error paths → `after()` not called.
    - The lookup `select` is `{ id: true, userId: true, enabled: true, lastUsedAt: true }` and the return value is unchanged.
    getSystemStats:
    - Non-admin → `registerInstance` not called.
    - Admin → `registerInstance` called once; `listInstances` called; `result.data` has `replicas`, `gone`, `liveVersions`, `skew`, `hasPoller` beside the existing fields.
    - Admin with `registerInstance` rejecting → `result.data` is still returned and `reportError` is called at level 'warning'.
  </behavior>
  <action>
Pure read model src/shared/utils/admin/computeReplicas.mjs (new, next to computeWorkerHealth.mjs, no imports, under 80 lines, JSDoc on the export):
- Constants: `LIVE_MS = 90_000` (Docker's 3 × 30 s healthcheck rule), `GONE_MS = 300_000`, `SKEW_ALERT_MS = 600_000`. The 24 h hide is not here: listInstances (Task 1) already drops older rows.
- `export function computeReplicas(instances, heartbeat, now = Date.now())` returns `{ replicas, gone, liveVersions, skew, hasPoller }`.
  - For each row: `age = now - new Date(row.last_seen).getTime()`. When age > GONE_MS, push the row into `gone`. Otherwise push `{ ...row, role, state }`, where `state` is `'live'` when age ≤ LIVE_MS, else `'late'`. `role` is `'poller'` when `row.id === heartbeat?.holder_id` and `heartbeat.lease_until` is set and later than `now`; otherwise `'standby'` when `row.worker_enabled`, else `'web'`. The role is derived on read and never stored, per the locked decision.
  - Sort `replicas` poller first, then `host` with localeCompare. Sort `gone` by `last_seen` descending.
  - `liveVersions` = the distinct `version` values of `state === 'live'` rows, sorted with `a.localeCompare(b, 'en', { numeric: true })`, so the newest is last.
  - `skew` = null when there are fewer than 2 live versions. Otherwise `since` is the earliest `started_at` (as a Date) among live rows on the newest version, and `alert` is `now - since > SKEW_ALERT_MS`.
  - `hasPoller` = some replica has role 'poller'.

getSystemStats (src/features/admin/actions.mjs):
- Import `registerInstance`, `listInstances` from '@/update/instance.mjs', `computeReplicas` from '@/shared/utils/admin/computeReplicas.mjs', and `reportError` from '@/shared/utils/observability.mjs'.
- After the `requireAdmin` check and before the season query, await `tryCatch(registerInstance())`; on error, call `reportError(error, { route: 'admin/system-overview', stage: 'instance-register', level: 'warning' })` and continue. This is the locked "rendering the panel registers the serving process" rule, so local dev (no Docker healthcheck) shows its replica on the first render. It runs only for admins.
- Add `listInstances()` as the last entry of the existing `Promise.all`, destructure it as `instances`, and spread `...computeReplicas(instances, heartbeat)` into the returned `data`. Leave every existing field unchanged.

API key last use (src/shared/utils/api/validateApiKey.mjs):
- Import `after` from 'next/server' and `reportError` from '@/shared/utils/observability.mjs'. Add `LAST_USED_INTERVAL_MS = 60_000`. Add `lastUsedAt: true` to the existing `select`; this adds no extra read. After the disabled check and before the success return: compute `cutoff = new Date(Date.now() - LAST_USED_INTERVAL_MS)`. When `!row.lastUsedAt || row.lastUsedAt < cutoff`, call `after()` with a callback that awaits `tryCatch(db.ApiKey.updateMany({ where: { id: row.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cutoff } }] }, data: { lastUsedAt: new Date() } }))` and reports an error with `route: 'validateApiKey'`, `stage: 'last-used'`, `level: 'warning'`. The conditional where clause keeps writes at ≤ 1 per key per minute, even across replicas. Every caller is a route handler (through requireApiKey), so `after()` runs in request scope. Add one sentence to the JSDoc about the deferred stamp. The return shape does not change.

Fetchers:
- `getAllApiKeys` (src/features/admin/actions.mjs) and `getApiKeysByUserId` (src/features/account/actions.mjs): add `lastUsedAt: true` to each `select`.

Tests (tdd: write first, see red, then implement):
- New src/__tests__/unit/shared/utils/admin/computeReplicas.test.mjs: one test per behavior bullet, with a small `row(overrides)` factory and a fixed `now`.
- src/__tests__/unit/shared/utils/api/validateApiKey.test.mjs: update the existing `select` expectation to include `lastUsedAt: true`, then add the after()/updateMany cases (import `after` from 'next/server'; it is a global vi.fn stub; capture the callback the same way the update route test does).
- src/__tests__/unit/features/admin/actions.userAdmin.test.mjs: add `vi.mock('@/update/instance.mjs', () => ({ registerInstance: vi.fn(async () => {}), listInstances: vi.fn(async () => []), pruneInstances: vi.fn(async () => {}) }))`. The global `vi.resetAllMocks()` restores those implementations. Add the three getSystemStats cases. The existing getAllApiKeys and getSystemStats tests must still pass unchanged.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/unit/shared/utils/admin/computeReplicas.test.mjs src/__tests__/unit/shared/utils/api/validateApiKey.test.mjs src/__tests__/unit/features/admin/actions.userAdmin.test.mjs src/__tests__/unit/features/account/actions.apiKeys.test.mjs && test "$(grep -cF 'lastUsedAt' src/shared/utils/api/validateApiKey.mjs)" -ge 3 && grep -cF 'lastUsedAt: true' src/features/admin/actions.mjs && grep -cF 'lastUsedAt: true' src/features/account/actions.mjs && grep -cF 'computeReplicas(' src/features/admin/actions.mjs && npm run lint && npm run typecheck && npm run test:unit</automated>
  </verify>
  <done>computeReplicas boundary tests pass (90 s, 5 min, lease expiry, skew 10 min, numeric version order); getSystemStats returns the replica view, registers only for admins, and survives a failed registration; validateApiKey stamps `lastUsedAt` at most once a minute in `after()`, only for valid enabled keys; both fetchers select `lastUsedAt`; lint, typecheck and the unit suite pass. Commit: `feat(admin): derive replica roles and stamp API key last use (#596)`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Variant H System Overview, "Last used" columns, docs and CHANGELOG</name>
  <files>src/features/admin/SystemOverview.jsx, src/__tests__/unit/features/admin/SystemOverview.test.jsx, src/features/admin/AdminApiKeys.jsx, src/features/account/ApiDashboard.jsx, src/app/docs/database/page.mdx, src/app/docs/infrastructure/page.mdx, src/app/docs/authentication/page.mdx, CHANGELOG.md</files>
  <behavior>
    - With a poller replica (host 'production01-2') and a late standby: the poller card renders first with the text 'Poller', its host element has `title="production01-2"`, the late card shows 'Late', and the headings 'Health', 'Game data' and 'Community' render. 'Polling since' is a row label, and no element reads 'Uptime'.
    - With two gone rows: a `<summary>` reads 'Gone in the last 24 h (2)' and carries `data-umami-event="debug-replicas-gone-toggle"`. With no gone rows, no `<summary>` renders.
    - With `skew: { since, alert: true }`, `hasPoller: false` and `heartbeat.last_error: 'boom'`: the text 'Version skew', 'No poller' and 'boom' all render. With `skew.alert: false`, the quiet 'Rollout in progress' note renders and 'Version skew' does not.
    - With `replicas: []`: the muted line 'No replica has reported in the last 5 minutes.' renders.
  </behavior>
  <action>
SystemOverview rewrite (src/features/admin/SystemOverview.jsx, server component, under ~220 lines, every function under 100 lines; layout per the locked variant H; implement with Tailwind tokens and the existing admin markup, not the mockup CSS):
- Keep the error branch and the header row (h3 'System Overview' + RefreshButton) as they are. Destructure the existing fields plus `replicas, gone, liveVersions, skew, hasPoller`. Import `format` from 'timeago.js' (the repo's chosen relative-time library) for "seen" and "last poll" values, because sub-minute precision matters there. Keep `formatUptime` and `formatNumber`. Drop the `formatTimeAgo` import if nothing uses it. Delete the local AdminStatCard; ReplicaCard replaces it.
- Order inside the outer `flex flex-col gap-3`: header → replicas label → replica cards → gone fold → alert rows → table grid.
- Replicas label: an h4 `font-mono text-small text-text-muted uppercase` reading `Replicas · {replicas.length}`. When `replicas` is empty, render a muted `text-small text-text-muted` line 'No replica has reported in the last 5 minutes.' instead of the grid.
- Replica cards: grid `grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-3`. A local `ReplicaCard` uses the existing card shell `grid grid-cols-[minmax(0,1fr)_var(--card-accent-width)] border border-ghost bg-surface-1`, with an inner `min-w-0 p-3` and a rail div.
  - Badge line: `font-mono text-small uppercase`. Show the role word ('Poller' in `text-primary`, 'Standby' or 'Web only' in `text-text-muted`), plus ' · Late' in `text-warning` when `state === 'late'`.
  - Host: `truncate font-display text-h3 text-text uppercase` with `title={host}`.
  - Facts: `flex flex-wrap gap-x-3 font-mono text-small text-text-muted`, three spans, each `whitespace-nowrap`: `v{version}`, `up {formatUptime(started_at)}` (process uptime), `seen {format(last_seen)}`.
  - Rail class: `bg-warning` when state is late, else `bg-primary` for the poller, else `bg-ghost`. Discretion call: LATE wins the rail even on the poller, because a stale poller is the warning that matters; the POLLER badge still names it.
- Gone fold (render only when `gone.length > 0`): `<details className="border border-dashed border-ghost">` with `<summary data-umami-event="debug-replicas-gone-toggle" className="cursor-pointer px-3 py-2 font-mono text-small text-text-muted uppercase">Gone in the last 24 h ({gone.length})</summary>`, then a `ul` (`flex flex-col gap-1 px-3 pb-3 font-mono text-small text-text-muted`) with one `li` (`break-words`) per row: `{host} · v{version} · last seen {format(last_seen)}`. The event name follows the admin components' `debug-*` naming (DebugTools uses `debug-trigger-error`).
- Alert rows (each a `border bg-surface-1 p-3` block, in this order):
  - When `skew` is set and `skew.alert` is true: `border-warning text-body text-warning` reading 'Version skew for {formatUptime(skew.since)}: ' plus the versions, each with a 'v' prefix, joined by ', '.
  - When `skew` is set and `skew.alert` is false: a quiet `border-ghost text-small text-text-muted` note 'Rollout in progress: {versions} live.'
  - When `!hasPoller`: `border-warning text-body text-warning` reading 'No poller: no live replica holds the poller lease.'
  - The existing `heartbeat?.last_error` danger block, unchanged.
- Table grid: `grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3` (Tailwind v4 grid-cols-N is already `minmax(0,1fr)`). Three `section`s (`flex min-w-0 flex-col gap-2`), each with an h4 (`font-mono text-small text-text-muted uppercase`) and a local `KvTable`. The Health section adds `md:col-span-2 lg:col-span-1`.
  - KvTable: wrapper `overflow-x-auto border border-ghost bg-surface-1`, a `table w-full`, a `tbody`, and per row `tr className="border-t border-ghost/30 first:border-t-0"`. Each row has `th scope="row"` (`p-3 text-left font-mono text-small font-normal whitespace-nowrap text-text-muted uppercase`) and `td` (`p-3 text-right font-display text-h3 text-primary uppercase`, wrapping allowed, so nothing overflows at 320 px). An optional per-row class overrides the value colour.
  - Health rows: 'Worker status' = `workerHealth.label`, coloured `text-success` / `text-warning` / `text-danger` for healthy / degraded / down (the same mapping the old card used for its rail). 'Last poll' = `format(heartbeat.last_beat)` or '—'. 'Poll duration' = `{ms}ms` or '—'. 'Polling since' = `formatUptime(heartbeat.started_at)` or '—' (lease tenure: the old uptime card renamed per the issue).
  - Game data rows: 'Current season' (`#N` or '—'), 'Active factions', 'Total events' (formatNumber), 'Seasons stored'.
  - Community rows: 'Users', 'API keys', 'Push subscribers'.
- New test src/__tests__/unit/features/admin/SystemOverview.test.jsx (first line `// @vitest-environment jsdom`, the Header.test.jsx pattern): `vi.mock('@/features/admin/actions.mjs', () => ({ getSystemStats: vi.fn() }))`, a `data(overrides)` factory with the full shape, `vi.mocked(getSystemStats).mockResolvedValue({ data: data({...}) })`, and `render(await SystemOverview())`. Cover the behavior bullets. `next/navigation` is already mocked globally for RefreshButton.

"Last used" columns:
- src/features/admin/AdminApiKeys.jsx: insert `<th className="p-3 pb-2">Last used</th>` right after the User header, and the matching `<td className="p-3 text-small text-text-muted">` that shows `timeSince(key.lastUsedAt)`, or 'never' when null, right after the User cell.
- src/features/account/ApiDashboard.jsx: insert `<th scope="col" className="pb-2">Last used</th>` right after Name, and `<td className="py-2 text-text-muted">` with the same expression right after the description cell. timeSince already renders Created in both tables, and its minute resolution matches the 60 s write interval.

Commit the UI (SystemOverview + test + both tables) now: `feat(admin): grouped System Overview with replica cards and Last used columns (#596)`.

Docs and CHANGELOG (second commit `docs: app_instance registry and API key last use (#596)`; edit only these spots; do not fix other stale content):
- src/app/docs/database/page.mdx:
  - In the ER diagram, add `DateTime lastUsedAt "nullable"` to the `ApiKey` entity, and an `app_instance` entity (id PK, host, version, worker_enabled, started_at, last_seen) after `worker_heartbeat`.
  - In the `### ApiKey` field table, add a `lastUsedAt` row: `DateTime?`, `TIMESTAMP(3)`, "Nullable. Last successful authentication. `validateApiKey` writes it in `after()`, at most once a minute per key".
  - In section 8, add `### app_instance` after the worker_heartbeat block. Give it a one-paragraph purpose (one row per running process; written by `/api/healthcheck` at most once per 20 s and by the admin panel; roles POLLER/STANDBY/WEB ONLY derived on read against `worker_heartbeat.holder_id` + `lease_until`; LIVE ≤ 90 s, LATE ≤ 5 min, GONE after that, pruned after 24 h by the lease holder's hourly cleanup), a field table with the six columns (`TIMESTAMP(3)` for the timestamps) and a "Used by" line (`src/update/instance.mjs`, `src/shared/utils/admin/computeReplicas.mjs`).
  - In section 9, add a row `app_instance | @id | id | One row per running process (HOLDER_ID)`.
- src/app/docs/infrastructure/page.mdx line 103 (the Dockerfile-level healthcheck bullet): append that each call also refreshes the replica's `app_instance` row after the response (at most once per 20 s per process) and that a failed write never changes the 200/503 answer.
- src/app/docs/authentication/page.mdx, in the numbered validateApiKey steps (around lines 252-255): add step 5, which says a valid, enabled key gets `lastUsedAt` stamped in `after()` at most once a minute, shown as "Last used" in the profile and admin key tables.
- CHANGELOG.md, under `## Unreleased`: add an `### Added` section with Simplified-Technical-English bullets in the style of the 0.96.x entries. Bullet 1: the admin System Overview lists every running replica from the new `app_instance` table, which `/api/healthcheck` refreshes; the lease holder is marked POLLER; LATE/GONE states; a version-skew alert; the grouped Health / Game data / Community tables; "Uptime" renamed "Polling since". Bullet 2: API keys record `lastUsedAt`, shown as "Last used" in both key tables. Bullet 3: the migration `20261025220000_app_instance_api_key_last_used` must be deployed (`npx prisma migrate deploy`). Do not add a version section and do not touch package.json.
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/unit/features/admin/SystemOverview.test.jsx && test "$(grep -cF 'label="Uptime"' src/features/admin/SystemOverview.jsx)" -eq 0 && grep -cF 'Polling since' src/features/admin/SystemOverview.jsx && grep -cF 'debug-replicas-gone-toggle' src/features/admin/SystemOverview.jsx && grep -cF 'Last used' src/features/admin/AdminApiKeys.jsx && grep -cF 'Last used' src/features/account/ApiDashboard.jsx && grep -cF 'app_instance' src/app/docs/database/page.mdx && grep -cF 'lastUsedAt' src/app/docs/database/page.mdx && grep -cF 'app_instance' src/app/docs/infrastructure/page.mdx && grep -cF 'lastUsedAt' src/app/docs/authentication/page.mdx && awk '/^## Unreleased/{f=1;next}/^## [0-9]/{f=0}f' CHANGELOG.md | grep -cF 'app_instance' && npm run lint && npm run typecheck && npm run test:unit && POSTGRES_URL='postgresql://user:pass@localhost:5432/db' UPDATE_KEY=dummy UPDATE_INTERVAL=20 npm run build</automated>
    <human-check>After merge and `npx prisma migrate deploy` against the local DB, open /profile as an admin with the dev server on :3000. At 320 px, 768 px and 1280 px wide: the local replica card shows with the POLLER badge (when the worker holds the lease), `document.documentElement.scrollWidth <= window.innerWidth` holds (no horizontal overflow), Health spans the row at 768 px, three equal tables sit side by side at 1280 px, and the API keys table shows "Last used". On staging, after the deploy: one card per Swarm replica, the poller first.</human-check>
  </verify>
  <done>The panel renders variant H from the derived data, and the render test covers cards, badges, title attribute, gone fold, alerts and the empty state. Both key tables show "Last used" ("never" when null). Docs describe `app_instance`, the healthcheck registration and `lastUsedAt`. `## Unreleased` carries the entry. Lint, typecheck, the unit suite and the dummy-env build all exit 0. Two commits.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Internet → `/api/healthcheck` | Public, unauthenticated GET; now schedules a DB write |
| API consumer → v1 / rebroadcast routes | Bearer API key; a valid key now triggers a deferred write |
| Admin browser → `getSystemStats` server action | Session-gated by `requireAdmin`; now writes the serving process's row and returns host names and versions |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261025-vze-01 | Denial of service | `/api/healthcheck` → `app_instance` upsert | low | mitigate | The per-process 20 s throttle in `registerInstance` (Task 1) bounds writes to ≤ 3/min per process, whatever the request rate. The row id and values come from the process (HOLDER_ID, env, `performance.timeOrigin`), never from the request. The write runs in `after()` only on the 200 path |
| T-261025-vze-02 | Information disclosure | replica host names, versions, process ids | medium | mitigate | The healthcheck response body is unchanged (the existing `toEqual` test pins it). Replica data leaves the server only through `getSystemStats`, after `requireAdmin` (Task 2); a non-admin test asserts neither registration nor data |
| T-261025-vze-03 | Denial of service | `validateApiKey` → `ApiKey.updateMany` | low | mitigate | Only valid, enabled keys schedule a write, and the conditional `where` (null or older than the 60 s cutoff) keeps it at ≤ 1 per key per minute across replicas (Task 2). Invalid, disabled and missing keys write nothing (tested) |
| T-261025-vze-04 | Denial of service | healthcheck availability | medium | mitigate | A registry failure cannot turn the healthcheck into a 503 and restart a healthy container: the write is deferred with `after()`, wrapped in `tryCatch`, and reported at warning level (Task 1 test: rejected upsert → 200) |
| T-261025-vze-05 | Elevation of privilege | admin-render registration | low | accept | `registerInstance` writes only the serving process's own row, and only after `requireAdmin`. A non-admin cannot reach it through the server action |
| T-261025-vze-SC | Tampering | npm installs | low | accept | No install runs in this plan; the executor must not run `npm install`, `npm ci` or `npm update` |
</threat_model>

<verification>
- `npm run lint`, `npm run typecheck`, `npm run test:unit` and `POSTGRES_URL='postgresql://user:pass@localhost:5432/db' UPDATE_KEY=dummy UPDATE_INTERVAL=20 npm run build` all exit 0 on the final tree; Tasks 1 and 2 also pass lint, typecheck and unit on their own commits.
- `POSTGRES_URL='postgresql://user:pass@localhost:5432/db' npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` shows the same `app_instance` columns and `"lastUsedAt" TIMESTAMP(3)` as the hand-written migration.
- Every gate baseline listed in `<context>` has flipped (positive gates ≥ 1, `label="Uptime"` = 0, the five new files exist).
- `git log --oneline origin/develop..HEAD` shows the four commits from this plan (plus any planning-docs commits from the orchestrator), and none of them touches package.json or adds a version section.
</verification>

<success_criteria>
- Each acceptance item of issue #596 has code and a test or gate: replica cards with POLLER, LATE → GONE fold → hidden after 24 h, a healthcheck that never 503s on a registry failure, "Last used" in both key tables, no 320 px overflow (layout classes + human check), a migration under prisma/migrations, mirrored unit tests, and updated `/docs`.
- Every locked decision in the planning context is implemented as stated, with the two discretion calls recorded in the SUMMARY: LATE wins the rail colour, and `debug-replicas-gone-toggle` is the Umami event name.
- No try/catch blocks, no new dependency, no new env var, no version bump.
</success_criteria>

<output>
Create `.planning/quick/261025-vze-admin-system-overview-all-replicas-with-/261025-vze-SUMMARY.md` when done. Include: the four commit hashes; whether the build needed the dummy env vars; the `prisma migrate diff` excerpt for `app_instance`; any file `lint:fix` touched that had to be restored; the two discretion calls; and the reminder that the user must run `npx prisma migrate deploy` against the local database after merging, before the next dev-server restart.
</output>
