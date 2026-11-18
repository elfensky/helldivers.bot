---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "\"Fail closed\" covers thrown errors only; a missing or partial Sentry configuration ships a build without maps"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "`dataFlowConfig.mjs` detail panels contradict the Prisma schema"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Worker panel in the notification diagram says the worker polls the HD1 API on a default 20 s interval"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Overview diagram and panels misstate the code (file path, auth providers, worker edge)"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The fence check covers 5 pages, but mermaid fences exist in 4 more, and the test says \"every fence in the default docs pages\""
  - id: IN-01
    severity: info
    disposition: fixed
    title: "`isWorkerEnabled` doc comment understates the accepted values"
  - id: IN-02
    severity: info
    disposition: skipped
    title: "Fence parser edge cases pass silently"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "Sentry config test does not cover the fail-open path or the empty-token case"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "Contract test checks one direction only"
open: 0
total: 9
recorded: 2026-11-15T14:16:38.166Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | PR #687 (docs sentence: a skipped upload passes the build and ships without uploaded maps); CI guard tracked in issue #686 (D-32, D-33 keep the workflows unchanged) |
| WR-02 | warning | fixed | PR #687 |
| WR-03 | warning | fixed | PR #687 (the `~20s` node labels stay: plan 02-05 judgment and D-07) |
| WR-04 | warning | fixed | PR #687 |
| WR-05 | warning | fixed | PR #687 (the fence check discovers every docs page) |
| IN-01 | info | fixed | PR #687 |
| IN-02 | info | skipped | Not a one-line fix. An unterminated fence makes mermaid parse the rest of the page, which fails, so the check already fails in practice. The guard stays blind to an indented fence and to a fence with an info string after `mermaid` (such a fence is not checked). All 14 current openers match `^```mermaid\s*$` (the plan 02-23 discovery run lists them). |
| IN-03 | info | fixed | PR #687 |
| IN-04 | info | fixed | Partly fixed: every `flows` entry is checked against the declared nodes and against the `details` keys (the review's Fix, PR #687). The node-to-panel direction is not checked, because some nodes have no panel today (data-flow diagram: `intro_order` and `points_max`; in-app flow: `computeMapState`; list in 02-23-SUMMARY.md), so that check needs new panel text, not a test line. The unused tuple element stays (cosmetic). |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
