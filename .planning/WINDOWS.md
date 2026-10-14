---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-31T07:40:52.750Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | src/shared/components/Navigation/UserSection.jsx |  | Auth-session hydration race found via STAB-01 sweep, out of plan scope, filed as issue #526 | open |  | 2026-08-31T07:40:52.645Z |  |
| 2 | 01 | lint-warning | src/__tests__/unit/features/archives/buildWarNarrative.test.mjs | 616 | Pre-existing Prettier violation from plan 01-01, blocks repo-wide npm run lint, unrelated to 01-02 | open |  | 2026-08-31T07:40:52.750Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "src/shared/components/Navigation/UserSection.jsx",
    "line": null,
    "description": "Auth-session hydration race found via STAB-01 sweep, out of plan scope, filed as issue #526",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T07:40:52.645Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "lint-warning",
    "phase": "01",
    "file": "src/__tests__/unit/features/archives/buildWarNarrative.test.mjs",
    "line": 616,
    "description": "Pre-existing Prettier violation from plan 01-01, blocks repo-wide npm run lint, unrelated to 01-02",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T07:40:52.750Z",
    "resolved_at": null
  }
]
````
