---
phase: quick-261025-vze
plan: 01
subsystem: admin
tags: [admin, replicas, app_instance, api-keys, prisma]
requires: []
provides:
    - app_instance replica registry written by /api/healthcheck
    - computeReplicas read model (role, state, skew)
    - ApiKey.lastUsedAt stamped by validateApiKey
    - variant H System Overview panel
key-files:
    created:
        - prisma/migrations/20261025220000_app_instance_api_key_last_used/migration.sql
        - src/update/instance.mjs
        - src/shared/utils/admin/computeReplicas.mjs
        - src/__tests__/unit/update/instance.test.mjs
        - src/__tests__/unit/shared/utils/admin/computeReplicas.test.mjs
        - src/__tests__/unit/features/admin/SystemOverview.test.jsx
    modified:
        - prisma/schema.prisma
        - vitest.setup.mjs
        - src/update/lease.mjs
        - src/app/api/healthcheck/route.js
        - src/app/api/h1/update/route.js
        - src/features/admin/actions.mjs
        - src/features/account/actions.mjs
        - src/shared/utils/api/validateApiKey.mjs
        - src/features/admin/SystemOverview.jsx
        - src/features/admin/AdminApiKeys.jsx
        - src/features/account/ApiDashboard.jsx
        - src/app/docs/database/page.mdx
        - src/app/docs/infrastructure/page.mdx
        - src/app/docs/authentication/page.mdx
        - CHANGELOG.md
decisions:
    - LATE wins the card rail colour, even on the poller
    - Umami event name is debug-replicas-gone-toggle
metrics:
    completed: 2026-10-25
status: complete
actuals:
    tasks: 3
    commits: 4
plan_head_before: af24ad0b
plan_head_after: 66e69cd6ba9c3afd6020c0c36537aa8cef483e66
commits: 4
---

# Phase quick-261025-vze Plan 01: Admin System Overview with all replicas Summary

Admin System Overview now lists every running replica from a new `app_instance` table (written by `/api/healthcheck`), marks the lease holder POLLER, shows API key last use, and uses the variant H grouped layout (issue #596).

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | 507fe828 | feat(admin): register app replicas in app_instance from the healthcheck (#596) |
| 2 | 8624344b | feat(admin): derive replica roles and stamp API key last use (#596) |
| 3a | 709ee38f | feat(admin): grouped System Overview with replica cards and Last used columns (#596) |
| 3b | 66e69cd6 | docs: app_instance registry and API key last use (#596) |

## Verify chain (final tree, HEAD 66e69cd6)

- `npm run lint`: exit 0 (0 errors, 321 warnings, same count as before the change)
- `npm run typecheck`: exit 0
- `npm run test:unit`: exit 0 (198 files, 2070 tests)
- `POSTGRES_URL=... UPDATE_KEY=dummy UPDATE_INTERVAL=20 npm run build`: exit 0. The build used the dummy env vars; it needed nothing else.

## Migration check

`prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` prints the same block as the hand-written migration:

```sql
CREATE TABLE "app_instance" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "worker_enabled" BOOLEAN NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "last_seen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_instance_pkey" PRIMARY KEY ("id")
);
```

and `"lastUsedAt" TIMESTAMP(3),` for `ApiKey`. `npx prisma validate` and `npx prisma generate` pass.

## Discretion calls

1. LATE wins the card rail colour (`bg-warning`), even on the poller. The POLLER badge still names the poller.
2. Umami event on the gone fold is `debug-replicas-gone-toggle`, following the `debug-*` naming of the admin components.

## Deviations from Plan

- **TDD order, Task 3:** the SystemOverview component was written before its render test, so that one test never ran red. Tasks 1 and 2 ran red first (healthcheck, instance, computeReplicas, validateApiKey, getSystemStats tests failed before the implementation).
- **Process note:** a first `npx prisma format` reformatted the whole schema (spaces instead of the file's 4-space style). I reverted with `git checkout -- prisma/schema.prisma` and reapplied the edit by hand. The committed schema diff is 18 additions and 3 changed lines.
- No try/catch blocks, no new dependency, no env var, no version bump, no package.json change.

## lint:fix side effects

`npm run lint:fix` changed no file outside `files_modified` at any of the four commits.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model.

## Not checked

- No database was reachable: the migration was not applied and no live replica data was rendered.
- The plan's human check (320 / 768 / 1280 px layout, no horizontal overflow, local POLLER card, staging Swarm cards) was not run. No browser verification of the CSS was done.

## Reminder for the user

Run `npx prisma migrate deploy` against the local database after merging, before the next dev-server restart. The migration is `20261025220000_app_instance_api_key_last_used`.

## Self-Check: PASSED

All four commits are ancestors of HEAD; the created files exist.

## Orchestrator follow-up

- Branch rebased onto `origin/develop` (4 Phase 1.1 docs commits landed meanwhile); commit hashes changed: 652cf506, 3b6ae1be, a4f770ae, 16a95750.
- `f535b865` fix(admin): tighten replica card spacing. A DevTools layout check (rendered panel + built CSS, 320 / 768 / 1280 px) showed 16 px gaps in the cards: the unlayered global `p { @apply mb-4 }` beats plain margin utilities, so the cards use `mb-0!` (the repo's override, as in DashboardClient.jsx). No horizontal overflow at any width; Health spans the row at 768 px; three equal tables at 1280 px; long host names truncate.
- Verify chain re-run by the orchestrator on the rebased tree: lint 0 errors, typecheck 0, test:unit 198 files / 2070 tests, build 0.
