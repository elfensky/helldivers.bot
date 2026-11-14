---
phase: "02"
slug: "docs-accuracy-operational-housekeeping"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-14"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `02-RESEARCH.md` § Validation Architecture (develop 0.98.0).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.1.0 (unit, smoke, visual configs); Playwright container for visual baselines |
| **Config file** | `vitest.config.mjs` (unit), `vitest.smoke.config.mjs`, `vitest.visual.config.mjs` |
| **Quick run command** | `npx vitest run src/__tests__/unit/_meta` |
| **Full suite command** | `npm run lint && npm run typecheck && npm run test:unit && npm run build` (CI order; the build needs stub `POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL=20`) |
| **Estimated runtime** | ~300 seconds (full chain incl. build) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/unit/_meta` plus the task's grep guard
- **After every plan wave:** Run `npm run lint && npm run typecheck && npm run test:unit && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green, both stale-string sweeps at 0, `node scripts/check-mermaid-fences.mjs` exit 0, browser check recorded, D-15 numbers on #502
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

Task IDs are filled by the planner. The rows below are the per-requirement checks every plan maps to.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DOCS-01 | — | N/A | grep guard | `grep -c WORKER_ENABLED AGENTS.md` ≥ 1; `grep -c -- '--delete-branch' AGENTS.md` = 0 | ✅ | ⬜ pending |
| TBD | TBD | TBD | DOCS-01 | — | 403 guard on `/api/h1/update` kept | grep + unit | `grep -n '~15s' src/app/api/h1/update/route.js` empty; `grep -n "errorResponse(403" src/app/api/h1/update/route.js` 1 hit; `npm run lint && npm run test:unit` | ✅ | ⬜ pending |
| TBD | TBD | TBD | DOCS-01 | — | N/A | grep | `grep -n 'dedicated 1-replica worker\|runs 3 app replicas\|must 403 rather' .planning/codebase/*.md` empty | ✅ | ⬜ pending |
| TBD | TBD | TBD | DOCS-02 | — | N/A | build | `npm run build` (ESLint does not cover `.mdx`) | ✅ | ⬜ pending |
| TBD | TBD | TBD | DOCS-02 | — | N/A | grep sweep | `02-RESEARCH.md` § Code Examples 3 (baselines 46 and 11 lines at 0.98.0; target 0) | ✅ | ⬜ pending |
| TBD | TBD | TBD | DOCS-02 | — | N/A | script | `node scripts/check-mermaid-fences.mjs` exit 0 | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | HOUSE-03 | — | Browser source maps not served from production | grep | `grep -n productionBrowserSourceMaps next.config.mjs` empty; `grep -n deleteSourcemapsAfterUpload next.config.mjs` 1 hit | ✅ | ⬜ pending |
| TBD | TBD | TBD | HOUSE-03 | — | N/A | CI log | `gh run view <id> --log \| grep -c 'Successfully uploaded source maps to Sentry'` = 2 | after merge | ⬜ pending |
| TBD | TBD | TBD | HOUSE-05 | — | N/A | file | `test ! -e docs/roadmap.md` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-mermaid-fences.mjs` — DOCS-02 fence parse (D-23); tested script in `02-RESEARCH.md` § Code Examples 1
- [ ] Lane `npm ci` + `npx prisma generate` — typecheck, unit tests and build need the generated client
- [ ] Decision on the D-15 (1) event source (`02-RESEARCH.md` Open Question 1)

Existing checks to keep green: `src/__tests__/unit/_meta/mirrorTree.test.mjs`, `src/__tests__/unit/_meta/exampleEnv.test.mjs`, `src/__tests__/unit/app/docs/_diagram.test.mjs`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The 5 rendered diagrams render | DOCS-02 | Needs a browser | `02-RESEARCH.md` § Code Examples 2; record the result in the PR |
| Each docs page matches the code | DOCS-02 | Review against the code (D-12) | Page-by-page check recorded in the phase verification |
| Static `.map` files gone from the image | HOUSE-03 | Needs Docker export of the pulled image | `02-RESEARCH.md` § HOUSE-03 export commands: `static` `.map` = 0, `server` = 48 |
| Production `.map` answers 404 | HOUSE-03 | Needs release 2 live | `02-RESEARCH.md` § HOUSE-03 D-15 (3) |
| Symbolicated GlitchTip events | HOUSE-03 | Needs the GlitchTip connector (not authorized at planning) | D-15 (1) and (4) |
| #642 merged, #501 closed with the run recorded | HOUSE-04 | GitHub state after a human approval | `gh pr view 642 --json state` = `MERGED`; `gh issue view 501 --json state,comments` |
| Staging seeds season 161 | HOUSE-04 | Staging log after the pin moves | `[migrate] seed data changed, seeding` in the staging app log |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
