---
phase: "02"
slug: "docs-accuracy-operational-housekeeping"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

Repeatable checks run in CI `Test & Build` (`npm run test:unit` and the build in the verify action). One-time evidence rows are under Manual-Only. Develop at audit: 74b69088 (PR #685).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-02-T1, 02-02-T3 | 02-02 | 5 | DOCS-01 | — | 403 guard on `/api/h1/update` kept | unit | `npx vitest run src/__tests__/unit/app/api/h1/update/route.test.mjs` (403 when `WORKER_ENABLED=false`, standby 200) | ✅ | ✅ green |
| 02-05..02-08 T3 | 02-05..02-08 | 6–9 | DOCS-02 | — | N/A | build | `npm run build` (compiles the MDX; ESLint does not cover `.mdx`) | ✅ | ✅ green |
| 02-06-T1 | 02-06 | 7 | DOCS-02 | — | N/A | unit (child process) | `npx vitest run src/__tests__/unit/_meta/mermaidFences.test.mjs` (runs `scripts/check-mermaid-fences.mjs`, exit 0) | ✅ | ✅ green |
| 02-05-T1 | 02-05 | 6 | DOCS-02 | — | N/A | contract (jsdom) | `npx vitest run src/__tests__/unit/app/docs/diagrams.contract.test.mjs` (5 diagrams × LR/TD parse, config node keys present) | ✅ | ✅ green |
| 02-11-T2 | 02-11 | 10 | DOCS-02 | — | N/A | unit (sweep) | `npx vitest run src/__tests__/unit/_meta/docsRetiredStrings.test.mjs` (Final check regexes, 02-DOCS-PAGE-CHECK.md) | ✅ | ✅ green |
| 02-10-T1, 02-11-T2 | 02-10, 02-11 | 4, 10 | HOUSE-03 | T-02-SC | Browser maps uploaded then deleted; a failed upload fails the build (#679) | unit (mocked wrapper) | `npx vitest run src/__tests__/unit/_meta/nextConfigSentry.test.mjs` | ✅ | ✅ green |
| 02-03-T2, 02-03-T3 | 02-03 | 6 | HOUSE-05 | — | N/A | file | `test ! -e docs/roadmap.md` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/check-mermaid-fences.mjs` — DOCS-02 fence parse (D-23); added in 02-06 (PR #666), in CI through `mermaidFences.test.mjs` (PR #685)
- [x] Lane `npm ci` + `npx prisma generate` — done in every code lane
- [x] Decision on the D-15 (1) event source: staging gets the production DSN (CONTEXT.md D-30, 2026-11-14)
- [x] `SENTRY_DSN` live on staging before D-15 step (1) (D-30) — 02-14, PR #659

Existing checks to keep green: `src/__tests__/unit/_meta/mirrorTree.test.mjs`, `src/__tests__/unit/_meta/exampleEnv.test.mjs`, `src/__tests__/unit/app/docs/_diagram.test.mjs`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Evidence |
|----------|-------------|------------|----------|
| AGENTS.md lease facts and merge line; four code comments; codebase maps describe the lease | DOCS-01 | Doc text, checked by review (D-12) | 02-DOCS-PAGE-CHECK.md (AGENTS.md and codebase-map sections, CHECKED) |
| The 5 rendered diagrams render (SVG count, node elements) | DOCS-02 | Needs a browser | 02-MERMAID-RENDER.md `Verdict: RENDERED`; staging PASS lines on `0.99.0-dev.709126d` |
| Each docs page matches the code | DOCS-02 | Review against the code (D-12) | 02-DOCS-PAGE-CHECK.md: nine CHECKED lines, `Final check: PASS` on develop 709126df |
| Upload line on both release legs | HOUSE-03 | Per-release CI log read | 02-RELEASE-RECORD.md § Release 2 (amd64 1, arm64 1, errors 0) |
| Static `.map` files gone from the image | HOUSE-03 | Needs a Docker export of the pulled image | 02-SOURCEMAP-MEASUREMENT.md `Verdict: STRIPPED` (142 → 0, server 48) |
| Production `.map` answers 404 | HOUSE-03 | Needs the live release | 02-PRODUCTION-CHECK.md § D-15 (3) |
| Symbolicated GlitchTip events (staging and production) | HOUSE-03 | Needs a real event and GlitchTip | 02-SYMBOLICATION-PROOF.md `Verdict: SYMBOLICATED` (HELLDIVERSBOT-7D); 02-PRODUCTION-CHECK.md `Verdict: PRODUCTION SYMBOLICATED` (HELLDIVERSBOT-6C); #502 closed |
| Staging DSN live | HOUSE-03 | One-time staging probe | 02-14-SUMMARY.md (tunnel probe 400, was 503) |
| #642 merged, #501 closed with the run recorded | HOUSE-04 | GitHub state | #642 MERGED, #501 CLOSED, gaps issue #658 (02-04-SUMMARY.md) |
| Staging seeds season 161 | HOUSE-04 | Staging log after the pin moves | 02-RELEASE-RECORD.md § Seed refresh (`[migrate] seed data changed, seeding`); mechanism under unit test (`update/migrateOnStart.test.mjs`, `_meta/seedSkip.test.mjs`) |
| Human checkpoints 02-04-T2, 02-05-T2, 02-09-T2, 02-11-T1, 02-12-T2, 02-15-T2 | — | Need a human, a browser or GlitchTip | The records named above |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (33 of 39 tasks automated; the 6 others are human checkpoints)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 300s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-15 (validate-phase: 4 gaps filled by PR #685; the rest Manual-Only by Andrei's choice)

## Validation Audit 2026-11-15

| Metric | Count |
|---|---|
| Gaps found | 4 |
| Resolved | 4 |
| Escalated | 0 |
