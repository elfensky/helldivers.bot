---
phase: "02"
slug: "docs-accuracy-operational-housekeeping"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-23"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 (`package.json`) |
| **Config file** | `vitest.config.mjs` (unit), `vitest.smoke.config.mjs`, `vitest.visual.config.mjs` |
| **Quick run command** | `npx vitest run src/__tests__/unit/_meta` |
| **Full suite command** | `npm run lint && npm run typecheck && npm run test:unit && npm run build` |
| **Estimated runtime** | ~300 seconds (full chain incl. build) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/unit/_meta` plus the task's grep guard
- **After every plan wave:** Run `npm run lint && npm run typecheck && npm run test:unit && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

All commands run with the plan's lane worktree as cwd (repo-root-relative paths). "Build" = `POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' UPDATE_KEY='ci-stub-key' UPDATE_INTERVAL='20' npm run build`. "Land" = `gh pr list --repo elfensky/helldivers.bot --state merged --head <branch> --json number --jq length` equals 1.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | HOUSE-03 | T-02-01, T-02-02, T-02-03, T-02-04 | PR-only release, annotated tag on the main tip, upload lines >= 2, no secret values in the record | git / gh | `git tag --points-at origin/main` = v0.95.7; `gh run list --workflow build-release.yml --branch v0.95.7` success; `grep '^Upload-line count: ' 02-RELEASE-RECORD.md` >= 2 | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | HOUSE-03 | T-02-03 | merge-back, never delete main | git | `git merge-base --is-ancestor origin/main origin/develop`; Land | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | DOCS-01 | T-02-05, T-02-06 | comment-only code edits, 403 guard kept, no private IPs | grep + unit | retired-statement sweep on AGENTS.md = 0; required-terms loop; `grep "errorResponse(403" route.js`; `npm run test:unit -- src/__tests__/unit/_meta` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | DOCS-01 | — | N/A | grep | map-error loop = 0; ARCHITECTURE step 7 negation; `Vitest 4` = 0 in PROJECT.md; `AGENTS.md: CHECKED` | ✅ | ⬜ pending |
| 02-02-03 | 02 | 2 | DOCS-01 | T-02-SC | lockfile-pinned install only | lint/type/unit/build | `npm run lint`; `npm run typecheck`; `npm run test:unit`; Build; Land | ✅ | ⬜ pending |
| 02-03-01 | 03 | 3 | HOUSE-05 | — | N/A | grep | ARCH-11 line and row; footer 80/80; Phase 11 Requirements + criterion 5 | ✅ | ⬜ pending |
| 02-03-02 | 03 | 3 | HOUSE-05 | T-02-07 | retired content reachable by permalink | grep + gh api | pointer <= 8 lines with both links; `git merge-base --is-ancestor bb01517d... origin/develop`; contents API size > 0 | ✅ | ⬜ pending |
| 02-03-03 | 03 | 3 | HOUSE-05 | T-02-SC | lockfile-pinned install only | lint/type/unit/build | verify chain; Land | ✅ | ⬜ pending |
| 02-04-01 | 04 | 4 | HOUSE-04 | T-02-08 | no exploit steps, tokens or private hosts in public issues | gh | ledger rows >= 3; each issue in Engineering Health; WR-07/WR-08 rows `deferred (#N)` | ✅ | ⬜ pending |
| 02-04-02 | 04 | 4 | HOUSE-04 | T-02-09 | closing comment states the criterion-4 reading per D-17 (PR-creation path verified; "PR already open" path and the missing CI/bump on #531 not exercised) | gh | #501 comment names run, PR, merge commit, `PR-creation path` and `PR already open`; #501 state CLOSED; ledger `#501 outcome: closed (D-17: …)`; Land | ✅ | ⬜ pending |
| 02-05-01 | 05 | 4 | DOCS-02 | T-02-10, T-02-11 | lane server on 127.0.0.1 only; node, details and flows in sync | grep + unit + browser record | lease node/details present; snapshot flow corrected; architecture sweep = 0; `npm run test:unit -- src/__tests__/unit/app/docs`; render PASS lines >= 2 | ✅ | ⬜ pending |
| 02-05-02 | 05 | 4 | DOCS-02 | T-02-10 | N/A | grep + browser record | overview/notifications sweep = 0; dev PASS lines >= 4 and `Verdict: RENDERED`; prod lines >= 3; page-check CHECKED x3 | ✅ | ⬜ pending |
| 02-05-03 | 05 | 4 | DOCS-02 | T-02-SC | lockfile-pinned install only | lint/type/unit/build | verify chain; Land | ✅ | ⬜ pending |
| 02-06-01 | 06 | 5 | DOCS-02 | T-02-12 | placeholders only in code samples | script + grep | `node scripts/check-mermaid-fences.mjs src/app/docs/data-flow/page.mdx`; fail-first on database page; data-flow sweeps | ❌ W0 (script created in this task) | ⬜ pending |
| 02-06-02 | 06 | 5 | DOCS-02 | — | N/A | script + grep | fence check on data-flow; retired-statement sweep = 0; caller/cadence terms; `Page data-flow: CHECKED` | ✅ | ⬜ pending |
| 02-06-03 | 06 | 5 | DOCS-02 | T-02-SC | lockfile-pinned install only | lint/type/unit/build | verify chain; Land | ✅ | ⬜ pending |
| 02-07-01 | 07 | 6 | DOCS-02 | T-02-13 | N/A | script + grep | `node scripts/check-mermaid-fences.mjs src/app/docs/database/page.mdx`; timestamp/dropped-model sweep = 0; lease and rate-limit terms | ✅ | ⬜ pending |
| 02-07-02 | 07 | 6 | DOCS-02 | — | N/A | grep + script | testing sweep = 0; no mermaid fence on testing; AGENTS.md link; smoke/script terms; fence check on 3 pages; CHECKED x2 | ✅ | ⬜ pending |
| 02-07-03 | 07 | 6 | DOCS-02 | T-02-SC | lockfile-pinned install only | lint/type/unit/build | verify chain; Land | ✅ | ⬜ pending |
| 02-08-01 | 08 | 7 | DOCS-02 | T-02-14 | no non-loopback IPv4 or secret names on the public page | script + grep | fence check; topology/image terms; old-start sweep = 0; IPv4 gate = 0 | ✅ | ⬜ pending |
| 02-08-02 | 08 | 7 | DOCS-02 | T-02-15 | env table checked against code | script + grep | fence check; 10 workflow names present; retired-name sweep = 0; env terms; `Page infrastructure: CHECKED` | ✅ | ⬜ pending |
| 02-08-03 | 08 | 7 | DOCS-02 | T-02-SC | lockfile-pinned install only | lint/type/unit/build | verify chain; Land | ✅ | ⬜ pending |
| 02-09-01 | 09 | 7 | HOUSE-03 | T-02-16 | no user data on #502; production pull gated by the task precondition: if the check fails, STOP this plan at a blocking-human stop: do not retry, do not skip, do not auto-approve; post the pull instructions (01-RELEASE-RECORD § Production deployment) and wait for the resume signal `deployed`; re-run the check after the signal and continue only on success | curl + gh | precondition and verify: `/api/h1/live` appVersion 0.95.7; #502 comment with HELLDIVERSBOT-6C and event id; `.js.map status` 200 row | ✅ | ⬜ pending |
| 02-09-02 | 09 | 7 | HOUSE-03 | T-02-17 | correct filter, browser frames only | checkpoint:human-verify | — (GlitchTip read by Andrei or orchestrator) | n/a | ⬜ pending |
| 02-09-03 | 09 | 7 | HOUSE-03 | T-02-16 | N/A | grep + gh | `^Verdict: (NOT )?SYMBOLICATED$`; #502 comment with the 0.95.7 verdict; Land | ✅ | ⬜ pending |
| 02-10-01 | 10 | 8 | HOUSE-03, DOCS-02 | T-02-18 | silent stays unset; D-24 precondition | git + grep + build | first: `git fetch -q origin`, then `git show origin/develop:.planning/phases/02-docs-accuracy-operational-housekeeping/02-SYMBOLICATION-PROOF.md` captured and checked with `grep -qx 'Verdict: SYMBOLICATED'` (fails closed); config key gone (comment-filtered) and delete option present; no `silent:`; Build; `find .next/static -name '*.map'` = 0; docs Sentry block | ✅ | ⬜ pending |
| 02-10-02 | 10 | 8 | HOUSE-03 | T-02-SC | lockfile-pinned install only | lint/type/unit/build | verify chain; Land | ✅ | ⬜ pending |
| 02-10-03 | 10 | 8 | HOUSE-03 | T-02-19, T-02-20, T-02-21 | nothing executed from the exported image; token never echoed | docker + gh | `^Verdict: (NOT )?STRIPPED`; static-map-count row (v0.95.2 above 0, new image 0); #502 check-1 comment; Land | ✅ | ⬜ pending |
| 02-11-01 | 11 | 9 | HOUSE-03, DOCS-02 | T-02-22, T-02-23, T-02-24, T-02-25 | release gated on STRIPPED; pull withheld without 2+ upload lines | git / gh | new tag on the origin/main tip equals main's version, annotated; Build: Release success; Release 2 upload-line count >= 2 | ✅ | ⬜ pending |
| 02-11-02 | 11 | 9 | HOUSE-03 | T-02-25 | merge-back, never delete main | git | `git merge-base --is-ancestor origin/main origin/develop`; Land | ✅ | ⬜ pending |
| 02-11-03 | 11 | 9 | HOUSE-03 | — | human production pull | checkpoint:human-action | — (re-checked by 02-12-01) | n/a | ⬜ pending |
| 02-12-01 | 12 | 10 | HOUSE-03, DOCS-02 | — | read-only probes | curl + grep | live chunk `.map` = 404; `Check 2 verdict: PASS`; `Docs live: PASS`; infrastructure page serves `Deployment topology` | ✅ | ⬜ pending |
| 02-12-02 | 12 | 10 | HOUSE-03 | T-02-26 | correct filter, browser frames only | checkpoint:human-verify | — (GlitchTip read) | n/a | ⬜ pending |
| 02-12-03 | 12 | 10 | HOUSE-03, DOCS-01 | T-02-26, T-02-27, T-02-28 | main checkout clean; #502 closed only on three passes | grep + gh + git | `Check 3 verdict:` line; #502 state matches verdict; regenerated `.claude/CLAUDE.md` non-empty with no stale statements; main checkout `git status --porcelain` empty | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Lane prerequisite, every code plan: `node --version` prints `v24.`, `npm ci`, then `POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' npx prisma generate` (typecheck, test:unit and build fail without the client). Never copy `.env*` files.
- [ ] `scripts/check-mermaid-fences.mjs` — created in 02-06 Task 1 with its fail-first run (database ER fence FAIL, all others OK); used by 02-06, 02-07 and 02-08.
- [ ] Docker daemon running for 02-10 Task 3 (it was down at research time); the v0.95.2 baseline is measured there against the pinned `:v0.95.2` tag.
- [ ] GlitchTip access for 02-09 Task 2 and 02-12 Task 2: Andrei in the GlitchTip UI, or the orchestrator through the re-authenticated GlitchTip MCP (the executor has no GlitchTip tools).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production pull of v0.95.7 and of the phase-end release | HOUSE-03 | `build-release.yml` has no deploy step; Andrei pulls on the production host | v0.95.7: 02-09 Task 1 precondition (blocking-human stop if production does not serve 0.95.7; plan 02-01 only hands the pull over); phase-end release: 02-11 Task 3; re-checked by `/api/h1/live` appVersion in 02-09 Task 1 and 02-12 Task 1 |
| Sentry-11 symbolication on a 0.95.7 production browser event (D-24) | HOUSE-03 | GlitchTip is not reachable by executor tools | 02-09 Task 2: filter `release:0.95.7 environment:production`, a `/_next/static/` frame resolved with a context line |
| Symbolicated production stack trace on the stripped release (D-15 check 3) | HOUSE-03 | same | 02-12 Task 2: filter `release:V environment:production` |
| Rendered Mermaid diagrams (D-23 as amended: the 5 `<MermaidDiagram>` diagrams; text fences are parse-checked by `scripts/check-mermaid-fences.mjs` instead) | DOCS-02 | client-only render; `next build` does not run mermaid | 02-05 Tasks 1-2 via chrome-devtools MCP (or a scratchpad Playwright script); evidence lines in `02-MERMAID-RENDER.md`, gated by `Verdict: RENDERED` |
| Page-by-page match with the live code (D-12) | DOCS-01, DOCS-02 | stale claims phrased unlike the sweep regexes escape grep | per-item rows in `02-DOCS-PAGE-CHECK.md`, re-read by the phase verifier |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (checkpoint tasks are listed under Manual-Only)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (only `scripts/check-mermaid-fences.mjs`)
- [x] No watch-mode flags
- [x] Feedback latency < 300s per task (the stub-env build is the slowest step)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
