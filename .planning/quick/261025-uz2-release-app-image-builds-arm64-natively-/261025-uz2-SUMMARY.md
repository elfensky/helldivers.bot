---
phase: quick-261025-uz2
plan: 01
subsystem: ci
tags: [github-actions, docker, arm64, release]
requires: []
provides: [per-arch native build-app matrix, merge-app manifest job]
affects: [.github/workflows/build-release.yml]
key-files:
    modified:
        - .github/workflows/build-release.yml
decisions:
    - "Release app image builds one leg per arch on a native runner, as build-migrate does; merge-app joins the legs"
metrics:
    tasks: 2
    files: 1
completed: 2026-10-25
status: complete
commits: 1
plan_head_before: b527dd07
plan_head_after: db35a4afe6464c1240554a7fe34dd1337f419052
actuals:
    tokens: 2500
    tasks: 2
    commits: 1
---

# Quick 261025-uz2: Release app image builds arm64 natively Summary

`build-release.yml` now builds the app image per arch on native runners (amd64 on ubuntu-latest, arm64 on ubuntu-24.04-arm) and joins the legs with a new `merge-app` job.

## What changed

- `build-app`: matrix of two legs, `platforms: linux/${{ matrix.arch }}`, one tag `:<tag>-<arch>`. The stale QEMU timeout comment is removed. A new comment names run 40233672280 and v0.96.3.
- `merge-app` ("Publish App Manifest"): copy of `merge-migrate` with a different name, `needs` and `IMAGE`. It writes `:<tag>`, `:production`, `:latest` and fails when linux/amd64 or linux/arm64 is missing.
- `github-release` and `pin-production` need `[merge-app, merge-migrate]`. `pin-production` keeps `!cancelled()` and the dispatch branch, so a rollback still works when every build job is skipped.

## Gates

| Gate | Result |
| ---- | ------ |
| `yaml valid` on the workflow | exit 0 |
| Task 1 structural check (deep-equal against b527dd07) | "build-release.yml structure OK" |
| Docs guard (QEMU only in deploy/README.md, no `linux/amd64,linux/arm64`) | exit 0, no doc edits |
| `npm run lint` | exit 0, 0 errors, 321 warnings (baseline 321) |
| `npm run typecheck` | exit 0 |
| `npm run test:unit` | exit 0, 195 files passed, 2032 tests passed |
| `npm run build` (dummy env) | exit 0 |
| Commit gate (one commit, only the workflow, subject, run id, Co-Authored-By, CHANGELOG and package.json untouched) | exit 0 |

Commit: `db35a4af`. Not pushed.

## Deviations from Plan

None. One Edit missed on the first try because of an indentation typo in my `old_string`. I retried and the file content is as planned.

## Open proof

The workflow is proven only by the next tag build (the orchestrator's 0.96.4 release). Expected: `Build App Image (amd64)` and `(arm64)` succeed, `Publish App Manifest` lists both platforms, `Pin Production` runs. This proof is still open.

## Follow-ups (not done, out of scope)

- `src/app/docs/infrastructure/page.mdx` Production section is stale. The app-image fact "linux/amd64,linux/arm64 in one job" in `.planning/phases/02-docs-accuracy-operational-housekeeping/02-08-PLAN.md` is now stale too. Both are DOCS-02 inputs.
- The "Set up QEMU" step in `.github/actions/docker-publish/action.yml` has no caller that needs it. Follow-up candidate.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- `.github/workflows/build-release.yml` exists and holds `merge-app:`.
- Commit `db35a4af` is an ancestor of HEAD.
