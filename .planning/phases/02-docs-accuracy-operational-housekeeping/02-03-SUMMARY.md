---
phase: 02-docs-accuracy-operational-housekeeping
plan: 03
subsystem: planning-docs
tags: [roadmap, house-05, keijiban]

requires: []
provides:
  - ARCH-11 (#469) scheduled in Phase 11
  - .planning/ROADMAP.md as the one roadmap file
affects: [02-01, 02-02, 02-09, 02-11, 02-12]

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/PROJECT.md
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-CONTEXT.md
    - AGENTS.md
    - CHANGELOG.md
    - package.json
    - package-lock.json
  deleted:
    - docs/roadmap.md

key-decisions:
  - "docs/roadmap.md is deleted, not retired to a pointer (supersedes D-19/D-20): the keijiban publish gate refuses a repo with two roadmap files"
  - "Live items not held elsewhere moved into ROADMAP.md § Carried over from docs/ROADMAP.md (2026-11-02): per-issue prediction gates, the feature-reach table, the prep ladder, three Phase 11 notes; the bb01517d permalink to the last full version sits there"

requirements-completed: [HOUSE-05]
---

# Plan 02-03 Summary

Run outside `/gsd-execute-phase`, by the 2026-11-02 keijiban-standard session on branch
`night/gsd-standard`, ahead of 02-01 and 02-02.

## Done

- ARCH-11 (#469) is in REQUIREMENTS.md (line, traceability row, coverage 80/80) and in Phase 11
  (Requirements line, success criterion 5) — D-18 as planned.
- `docs/roadmap.md` is deleted. AGENTS.md § Task Tracking and PROJECT.md lines 43, 49, 51, 65 and 93
  point at `.planning/ROADMAP.md`, ARCH-11 and SSE-01.
- Phase 2 success criterion 5 and HOUSE-05 describe the deletion.

## Deviations

- **Delete instead of pointer** (supersedes D-19, D-20). A pointer file is a second roadmap file under
  the one-roadmap standard (Andrei, 2026-11-01). The content stays one click away through the
  bb01517d permalink in ROADMAP.md § Carried over.
- **Live items migrated** (supersedes D-20's "not migrated"): only what no phase, requirement or
  PROJECT.md line held.
- **Historical references kept:** CHANGELOG entries, `.planning/research/*.md`, 02-CONTEXT,
  02-RESEARCH, 02-PATTERNS and 02-DISCUSSION-LOG still name `docs/roadmap.md`. They are dated records;
  their links now resolve only through git history.
- **Not merged by this plan:** the work lands through a draft PR for Andrei's review, not by
  `gh pr merge` as Task 3 planned.
