---
phase: 02-docs-accuracy-operational-housekeeping
plan: 14
subsystem: infra
tags: [glitchtip, sentry, staging, deploy, compose]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Plan 02-04: develop head 6812b2b3 with staging on 0.98.1-dev.6812b2b"
provides:
  - "Staging compose carries the plain SENTRY_DSN (same value as production); staging errors reach GlitchTip with environment: staging"
  - "deploy/README.md staging section says where staging errors go"
  - "Proof that the DSN is live on staging: tunnel relays GlitchTip's answer (400, empty body)"
affects: []

status: complete
actuals:
  tokens: 6000
  tasks: 2
  commits: 1
plan_head_before: 6812b2b3
plan_head_after: 5a9f7559

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - deploy/staging/compose.yaml
    - deploy/README.md
    - CHANGELOG.md

key-decisions:
  - "The README change is one two-line sentence with the wording 'Sentry reports to the production GlitchTip with environment: staging', so the diff stays at 4 changed lines (the plan's verify caps it at 4); the plain-SENTRY_DSN detail sits in the compose comment and the CHANGELOG note."

requirements-completed: [HOUSE-03]

coverage:
  - id: D1
    description: "deploy/staging/compose.yaml sets SENTRY_DSN as a plain environment value equal to production, with the production comment, directly after SENTRY_SERVER_NAME; no SENTRY_DSN_FILE"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "node yaml parse: staging SENTRY_DSN equals production SENTRY_DSN, no SENTRY_DSN_FILE; git diff adds 2 lines, removes none"
        status: pass
    human_judgment: false
  - id: D2
    description: "deploy/README.md names environment: staging for Sentry; only the one sentence changed (4 changed lines)"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "plan Task 1 second automated check (grep in lines 30-40, diff cap 4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PR #659 rebase-merged; origin/deploy/staging carries the DSN and pins sha-5a9f7559; staging reports 0.98.1-dev.5a9f755; the tunnel relays GlitchTip's answer"
    requirement: HOUSE-03
    verification:
      - kind: other
        ref: "gh pr list --state merged --head chore/staging-sentry-dsn (1); git show origin/deploy/staging:deploy/staging/compose.yaml has SENTRY_DSN; probe '400 0' at 2026-11-15T01:33Z"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-11-15
---

# Phase 2 Plan 14: Staging reports to GlitchTip Summary

**Staging now carries the production GlitchTip DSN as a plain environment value (D-30), and an empty-body POST to the staging tunnel returns `400` with an empty body, which only GlitchTip's relayed answer gives.**

## Performance

- **Duration:** 21 min (01:13Z to 01:34Z; most of it waiting on checks and the staging roll)
- **Tasks:** 2 of 2
- **Files modified on develop:** 3 (`deploy/staging/compose.yaml`, `deploy/README.md`, `CHANGELOG.md`)

## Accomplishments

- Task 1 (tracer): the lane `chore/staging-sentry-dsn` got `SENTRY_DSN` plus the production comment line directly after `SENTRY_SERVER_NAME` (2 lines added, none removed), the one-sentence README rewrite and the `### Changed` note under `## Unreleased`. Lane commit `f402bf1b`.
- Task 2: lint, typecheck, test:unit and the stub-env build exited 0. PR #659 passed `Test & Build`, `Visual Regression` and `Review Dependencies` and was rebase-merged. The merge commit on develop is **M = `5a9f7559`** (`5a9f755966eadb526b9c32053728ba2ea8960d4b`). The branch was deleted after `MERGED`, and the lane worktree and local branch were removed.
- `Build: Staging` run **43662646143** (headSha M) succeeded and pushed `a1881c50` to `deploy/staging`, pinning `sha-5a9f755966ea`. That compose has the DSN.
- Staging `/api/h1/live` first reported `0.98.1-dev.5a9f755` at 01:28:20Z (V1 = 0.98.1).
- Tunnel probe: `POST /api/glitchtip?probe=<epoch>` with an empty body returned status **400**, size **0**, at about 01:33Z. The route's own errors (503, 500, 502) carry a text body, so this is the relayed GlitchTip answer. Before this plan the answer was `503 21`. The probe creates no event.

## Task Commits

| Task | Commit | Notes |
|------|--------|-------|
| 1 | develop: 5a9f7559 (lane commit f402bf1b, rebased on merge) | the compose, README and CHANGELOG change, in PR #659 |
| 2 | none | PR, merge, staging checks; no file edits |

## Deviations from Plan

None - plan executed exactly as written. One wording choice: the README sentence was shortened so the diff fits the plan's 4-line cap.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The DSN is a public ingest key (T-02-35, accepted). It is not printed in the PR body, commit message or this SUMMARY. T-02-36 is mitigated by the `environment: staging` tag.

## Verification

- Staging compose DSN equals production's, plain value, valid YAML, no `SENTRY_DSN_FILE`: pass.
- PR #659 MERGED; `origin/deploy/staging` compose has `SENTRY_DSN: 'https://`: pass.
- Probe `400 0`: not 000, 500, 502 or 503, empty body: pass.
- `deploy/README.md` lines `:11`, `:124` and `:167` are not in the diff.

## What is not covered

No real browser error was sent from staging. D-15 step (1) still needs one real staging error to appear in GlitchTip with `environment: staging`. The plan forbids a synthetic event.

## Next

Ready for the next plan of phase 2.

## Self-Check: PASSED

Found: the SUMMARY; develop commit 5a9f7559 (ancestor of origin/develop); PR #659 MERGED; run 43662646143 success; staging version 0.98.1-dev.5a9f755.
