---
phase: 02-docs-accuracy-operational-housekeeping
verified: 2026-11-15T15:30:00Z
status: gaps_found
score: 4/5 must-haves verified
covered_files:
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-01-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-02-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-02-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-03-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-03-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-04-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-04-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-05-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-05-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-06-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-06-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-07-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-07-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-08-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-08-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-09-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-09-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-10-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-10-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-11-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-11-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-12-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-12-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-13-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-13-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-14-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-14-SUMMARY.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-15-PLAN.md
  - .planning/phases/02-docs-accuracy-operational-housekeeping/02-15-SUMMARY.md
  - AGENTS.md
  - next.config.mjs
  - src/app/docs/architecture/dataFlowConfig.mjs
  - src/app/docs/architecture/page.mdx
  - src/app/docs/data-flow/page.mdx
  - src/app/docs/database/page.mdx
  - src/app/docs/infrastructure/page.mdx
  - src/app/docs/notifications/notificationFlowConfig.mjs
  - src/app/docs/overviewConfig.mjs
  - src/app/docs/overviewDefinition.mjs
  - src/app/docs/testing/page.mdx
covered_digest: "v4:sha256:92a44ba3fa60e754be5d29717d4ef19bb73c61aae010d707df37ef2c23135470"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Each public /docs page (architecture, data-flow, infrastructure, database, testing) matches the code when checked page-by-page against .planning/codebase/ (DOCS-02)"
    status: partial
    reason: "The lease, replica, workflow-name, test-layout and schema-table drift items are fixed and live. Several statements that contradict the code remain on in-scope pages and on production (v0.99.0, identical to origin/develop for these files). The page-by-page check recorded 'CHECKED' for pages that still carry them."
    artifacts:
      - path: "src/app/docs/architecture/page.mdx"
        issue: "Line 74: 'new SWs wait for explicit client approval before activating'. src/sw.js:6-7 sets skipWaiting: true and clientsClaim: true. Confirmed live on production. The same sentence links to /docs/notifications#pwa--offline, an anchor the rendered page does not have."
      - path: "src/app/docs/architecture/dataFlowConfig.mjs"
        issue: "Lines 200 and 210 (h1_season detail panel on the architecture diagram): 'plus season_duration[]' and ['season_duration', 'Int[]']. prisma/schema.prisma:128 has 'season_duration Int @default(0)'. database/page.mdx:278 states it correctly, so the two pages disagree (WR-02)."
      - path: "src/app/docs/notifications/notificationFlowConfig.mjs"
        issue: "Line 37: worker panel says the worker 'polls the official Helldivers 1 API every ~20 seconds'. The worker thread only calls the update route (public/workers/cronLogic.js:30); only the lease holder polls HD1 (WR-03)."
      - path: "src/app/docs/overviewDefinition.mjs"
        issue: "Line 28 draws 'worker --> hd1'. The worker never contacts HD1; the edge is api_update to HD1, on the lease holder only (WR-04)."
      - path: "src/app/docs/overviewConfig.mjs"
        issue: "Line 21 subtitle 'src/app/(app)/page.jsx' (no (app) group; file is src/app/page.jsx). Line 103 names Discord and GitHub OAuth only; src/auth.js:39-52 also configures Google (WR-04)."
      - path: "src/app/docs/database/page.mdx"
        issue: "Lines 431, 463, 483 say 'OAuth-only (Discord and GitHub providers)'. src/auth.js configures Discord, GitHub and Google (WR-04)."
      - path: "src/app/docs/infrastructure/page.mdx"
        issue: "Line 502: 'Pin Production cannot pin a build without its maps (#661)'. The errorHandler rethrow covers thrown plugin errors only; an empty SENTRY_AUTH_TOKEN skips the wrapper (next.config.mjs:213 and the doc's own line 499), and an empty SENTRY_ORG/SENTRY_PROJECT or zero maps found makes the plugin warn and return. The claim is stronger than the code (WR-01)."
    missing:
      - "architecture/page.mdx:74: replace the 'wait for explicit client approval' sentence with the immediate-activation behavior (skipWaiting + clientsClaim); drop or fix the #pwa--offline fragment"
      - "dataFlowConfig.mjs:200,210: season_duration is an Int scalar, not Int[]"
      - "notificationFlowConfig.mjs:37: the worker thread calls the update route; the lease holder polls HD1"
      - "overviewDefinition.mjs:28: replace 'worker --> hd1' with 'api_update --> hd1'"
      - "overviewConfig.mjs:21,103 and database/page.mdx:431,463,483: src/app/page.jsx; Discord, GitHub and Google"
      - "infrastructure/page.mdx:502: scope the fail-closed claim to thrown plugin errors, or add the token/org/project/zero-map guard in build-release.yml and build-staging.yml"
      - "Re-run the D-23 browser render check for the notification and overview diagrams after the config edits"
deferred:
  - truth: "Notification diagrams label the update route 'POST /api/h1/update' while the worker sends GET (public/workers/cronLogic.js:30; src/app/api/h1/update/route.js answers POST with 405)"
    addressed_in: "Phase 18 (DOCS-03), by Andrei's decision D-07"
    evidence: "02-05-SUMMARY.md and 02-REVIEW.md record the label as deferred to DOCS-03 (REQUIREMENTS.md: DOCS-03, Phase 18, Pending). DOCS-03's text covers new features, not this correction, so this deferral rests on the decision, not on the roadmap wording."
human_verification: []
---

# Phase 2: Docs Accuracy and Operational Housekeeping Verification Report

**Phase Goal:** Documentation matches deployed reality and the small outstanding operational verification chores close out
**Verified:** 2026-11-15T15:30:00Z
**Status:** gaps_found
**Re-verification:** No, initial verification

Code was read from `origin/develop` (74b69088) and the released tag `v0.99.0`. The docs and config files in scope are byte-identical between the two (the only diff is 5 test files). Production was probed live (`/usr/bin/curl`, cache-busting query).

## Verdict on the phase goal

The operational half of the goal is met. The documentation half is partially met: the lease model, replica topology, workflow names and test layout now match the code, but the page-by-page claim of SC2 does not hold. At least six statements that contradict the code remain on in-scope pages, and one of them (the service-worker sentence) is live on production. The five advisory review warnings do not leave the goal met:

| Review item | Judgement | Why |
|---|---|---|
| WR-02, WR-03, WR-04 | Real gaps | Each misstates the code on a page in scope (confirmed by reading the code, see the table below) |
| UI review: `architecture/page.mdx:74` | Real gap | Confirmed against `src/sw.js:6-7` and the live page |
| WR-01 | Real gap in a doc claim (latent code risk) | `infrastructure/page.mdx:502` overstates; the build config itself is correct for thrown errors |
| WR-05 | Not a gap against these criteria | Coverage scope of the fence-parse guard; four other pages hold fences but are outside the five-page criterion. Recorded as a warning |
| IN-01..IN-04 | Info only | No effect on the criteria |

## Goal Achievement

### Observable Truths (ROADMAP Phase 2 success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AGENTS.md Architecture invariants describe the lease/`worker_heartbeat` model, `WORKER_ENABLED`, and the multi-replica web tier, with poller state in the lease row (DOCS-01) | VERIFIED | `origin/develop:AGENTS.md` "Exactly one poller across replicas" names `worker_heartbeat`, `src/update/lease.mjs`, `prevEvents`/`lastSeasonObserved` in the lease row, `LEASE_TTL_S` 60 s, the `200 {role:'standby'}` answer, `WORKER_ENABLED=false` as an optional opt-out, and 2 app replicas on both stacks. Matches the code facts in `02-DOCS-PAGE-CHECK.md` (lease.mjs, route.js, instrumentation.node.js, both compose files). |
| 2 | Each public `/docs` page (architecture, data-flow, infrastructure, database, testing) matches the code, checked page-by-page against `.planning/codebase/` (DOCS-02) | FAILED (partial) | Fixed and live on production: `Poller lease`/`worker_heartbeat` on data-flow and architecture; `api_rate_limit` and no `TIMESTAMPTZ` on database; `mirrorTree.test.mjs` and no `euraika` on testing; all workflow files named on infrastructure exist at v0.99.0. Still wrong: see `gaps` above (service-worker sentence, `season_duration[]`, worker-polls-HD1 panel and edge, `(app)` path, OAuth provider lists, fail-closed overclaim). The `02-DOCS-PAGE-CHECK.md` sections record "CHECKED" for pages that carry these statements. |
| 3 | Sourcemaps upload at build time and are stripped from the shipped image once symbolication is proven on at least one release, verified by image size and a symbolicated production stack trace (HOUSE-03) | VERIFIED | `v0.99.0:next.config.mjs` has `sourcemaps: { deleteSourcemapsAfterUpload: true }`, `errorHandler` rethrow, no `silent`. Live probe now: three production chunks answer 200, their `.map` answers 404, 0 `sourceMappingURL=` lines; `appVersion` 0.99.0. Image measurement (`02-SOURCEMAP-MEASUREMENT.md`): static maps 142 to 0, 31,057,870 bytes removed, `sourceMappingURL` 131 to 0, debug IDs kept at 131. Symbolication: staging event HELLDIVERSBOT-7D resolves to `AnalyticsOptOut.jsx:18`; production 0.99.0 event HELLDIVERSBOT-6C resolves to `NotificationToggle.jsx:118` (`02-SYMBOLICATION-PROOF.md`, `02-PRODUCTION-CHECK.md`). #502 is CLOSED with all four D-15 steps recorded. I did not re-read GlitchTip; the event records are the recorded evidence. |
| 4 | The seed-refresh workflow's PR path is verified end-to-end, with the run recorded on #501 (HOUSE-04) | VERIFIED | #501 CLOSED 2026-11-15T01:11Z. Its final comment records the real run (#642, run 42603725952), the `action_required` finding, the rebase-merge as 6812b2b3, the staging pin, and the follow-up gaps filed as #658 (OPEN). `02-RELEASE-RECORD.md` holds the staging `[migrate]` lines (seed applied by the first task on the pin). Those log lines came from the orchestrator's Arcane session and were not independently re-read. |
| 5 | `docs/roadmap.md` is deleted and its live items carried into `.planning/`, leaving `.planning/ROADMAP.md` as the one roadmap file (HOUSE-05) | VERIFIED | `docs/roadmap.md` is absent on `origin/develop` and `v0.99.0` (`git show` fails; `docs/` holds `reports`, `superpowers`, `website-standard.md`). `.planning/ROADMAP.md` exists; ARCH-11 (#469) is in REQUIREMENTS.md. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | `POST /api/h1/update` label on the notification diagrams (route is GET) | Phase 18 (DOCS-03), by Andrei's decision D-07 | Recorded in `02-05-SUMMARY.md`, `02-REVIEW.md`, `02-UI-REVIEW.md`. Honored as a decision. Note: DOCS-03's wording does not name this correction, so it should be named there when Phase 18 is planned. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `AGENTS.md` | Lease-model invariants | VERIFIED | Present on `origin/develop`, matches the code |
| `next.config.mjs` | Strip + fail-closed config | VERIFIED | `deleteSourcemapsAfterUpload`, `errorHandler`, no `silent`; ships in v0.99.0 |
| `src/app/docs/{architecture,data-flow,infrastructure,database,testing}/page.mdx` | Pages that match the code | PARTIAL | data-flow, testing correct on traced claims; architecture, database, infrastructure carry the defects above |
| `scripts/check-mermaid-fences.mjs` + `mermaidFences.test.mjs` | Fence parse guard | VERIFIED | "checked 8 fences in 5 files", all OK |
| `02-*.md` records (release, sourcemap, symbolication, production, mermaid, docs check) | Evidence | VERIFIED | Present; figures agree with live probes |
| `docs/roadmap.md` | Deleted | VERIFIED | Absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| release 2 tag v0.99.0 | production | Build: Release, Pin Production | WIRED | Production reports `appVersion` 0.99.0; `.map` answers 404 |
| `errorHandler` rethrow | failed `next build` | `withSentryConfig` | WIRED for thrown errors | Not wired for empty token/org/project or zero maps (WR-01) |
| architecture page SW paragraph | `/docs/notifications#pwa--offline` | link fragment | NOT_WIRED | Rendered page has no such anchor (UI review) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase unit tests on `origin/develop` | `vitest run src/__tests__/unit/_meta src/__tests__/unit/app/docs` (extracted copy, shared `node_modules`) | 16 files / 88 tests pass; `seedSkip.test.mjs` cannot load the generated Prisma client in the extract (environment, not a defect) | PASS |
| Mermaid fences parse | `node scripts/check-mermaid-fences.mjs` | 8 fences in 5 files, all OK | PASS |
| Production strips maps | 3 chunk URLs, `.map` + `sourceMappingURL` count | 404 / 0 for all three | PASS |
| Production version | `/api/h1/live` `appVersion` | 0.99.0 | PASS |
| SW sentence live | `/docs/architecture` text | "wait for explicit client approval" present | FAIL (confirms gap) |

### Probe Execution

Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh`; the phase declares none).

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| DOCS-01 | 02-02, 02-12 | AGENTS.md lease model | SATISFIED | SC1 |
| DOCS-02 | 02-05, 02-06, 02-07, 02-08, 02-10, 02-11, 02-12, 02-15 | Public docs match the code | PARTIAL | SC2; REQUIREMENTS.md marks it `[x]` / Complete, which the evidence does not support |
| HOUSE-03 | 02-09, 02-10, 02-11, 02-12, 02-13, 02-14 (02-01 superseded by 02-13) | Sourcemap upload + strip | SATISFIED | SC3 |
| HOUSE-04 | 02-04, 02-13 | Seed-refresh PR path verified | SATISFIED | SC4 |
| HOUSE-05 | 02-03 | `docs/roadmap.md` deleted | SATISFIED | SC5 |

All five phase IDs appear in plan frontmatter and in REQUIREMENTS.md. No orphaned requirement: REQUIREMENTS.md maps no other ID to Phase 2 (DOCS-03 is Phase 18, HOUSE-01 Phase 3, HOUSE-02 Phase 5).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/docs/{architecture,data-flow,database,infrastructure}/page.mdx` | arch:46; data-flow:19,104; database:87,243; infra:13,214,307 | 8 raw ` ```mermaid ` fences render as source text (`mdx-components.jsx` renders `pre` as plain text); D-23 knew this, the parse guard only proves the source parses | Warning | A reader sees diagram source, not a diagram, on the pages the criterion names. Not a factual error; a presentation defect |
| `scripts/check-mermaid-fences.mjs` | 28-34 | Guard lists 5 pages, 4 other pages hold 6 fences; `testing` has none (WR-05) | Warning | Coverage scope |
| Debt markers (`TBD`/`FIXME`/`XXX`) in changed files | n/a | None found in the verified files | n/a | n/a |

### Human Verification Required

None added. The remaining gaps are decidable from the code.

### Gaps Summary

One gap, one root cause: the page-by-page accuracy pass fixed the drift it inventoried (lease, replicas, CI/CD names, test layout, schema tables) but left statements it did not inventory, and recorded "CHECKED" for the pages. The operational criteria (SC3 to SC5) and AGENTS.md (SC1) hold on live evidence. A closure plan should edit the seven sites listed under `gaps.missing`, re-run the D-23 browser render check for the changed diagrams, and either convert or accept the eight raw fences. The WR-01 code-side guard (empty token, org, project, or zero maps) is optional hardening; the minimum fix is to make the doc sentence match the code. After the edits, the dispositions in `02-REVIEW-DISPOSITION.md` (all `open`) should be set to `fixed`, `skipped` or `deferred`.

An override is not suggested: none of these looks like an intentional alternative implementation. The `POST` label is already carried as a decided deferral.

---

_Verified: 2026-11-15T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
