---
phase: 01-stability-fixes-release
verified: 2026-10-21T00:00:00Z
status: passed
score: 6/6 must-haves verified (1 override)
covered_files:
  - ".planning/phases/01-stability-fixes-release/01-01-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-01-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-02-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-02-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-03-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-03-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-04-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-04-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-05-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-05-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-06-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-06-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-07-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-07-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-08-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-08-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-09-PLAN.md"
  - ".planning/phases/01-stability-fixes-release/01-09-SUMMARY.md"
  - ".planning/phases/01-stability-fixes-release/01-GLITCHTIP-RECOUNT.md"
  - ".planning/phases/01-stability-fixes-release/01-RELEASE-RECORD.md"
  - "public/og-fallback.png"
  - "src/__tests__/unit/app/opengraph-image.test.jsx"
  - "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx"
  - "src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs"
  - "src/app/layout.css"
  - "src/app/layout.jsx"
  - "src/app/opengraph-image.jsx"
  - "src/features/notifications/NotificationToggle.jsx"
  - "src/shared/utils/game/getWarOutcome.mjs"
covered_digest: "v3:sha256:adc156aa47fca7cee269bb712597167d0a101938e79fb72923da02444b82382a"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Loading / in any timezone produces no React #418 hydration warning, with the SSR/client divergence identified per variant (not masked with a mounted-flag) and a regression test per divergent value (STAB-01)"
    reason: "Developer decision 2026-10-21 (same treatment as STAB-06): plan 01-02 delivered the real-browser timezone sweep and harness and found the date/locale divergences already guarded; the residual #418 class on 0.95.2 (UserSection auth-session race #526, text divergence on /) is tracked in open issues #496 and #526 rather than closed in Phase 1. STAB-01 and success criterion 1 were re-worded accordingly in REQUIREMENTS.md and ROADMAP.md."
    accepted_by: "Andrei Lavrenov"
    accepted_at: "2026-10-21T00:30:00Z"
gaps: []
---

# Phase 1: Stability Fixes & Release Verification Report

**Phase Goal:** The five known production bug classes are fixed at root cause, verified in production, and `develop` is released to `main`
**Verified:** 2026-10-21
**Status:** gaps_found
**Re-verification:** No (initial verification)

## Summary

The release half of the goal is achieved. The code half is achieved for four of the five bug classes as the roadmap words them. Two points need a decision from the developer:

1. **STAB-01 / success criterion 1 fails.** React #418 still fires on `/` in production on 0.95.2. The phase added no fix for it. Issue #496 and the new-found #526 are open.
2. **STAB-06 original criterion ("zero new events") was not met.** All three classes (#496, #503, #485) were RESIDUAL on 0.95.2. On 2026-10-21 the developer re-scoped STAB-06 and success criterion 6 to "re-counted and dispositioned on the measured numbers; residual classes filed" (commit `5c24fd7b`). This report judges STAB-06 against the current wording. It does not hide that the original criterion was not met.

Context for reading the verdict: no npm script was run (dependencies are not installed in this worktree). Source claims were checked by reading files and git history. Test claims were checked by reading the test files, plus the CI result of release PR #547 (Test & Build, Visual Regression, Docker Compose Smoke Test all pass). Two production probes were made with `curl` on 2026-10-21.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
|---|-----------------------------------|--------|----------|
| 1 | `/` in any timezone produces no React #418; divergence identified per variant; regression test per divergent value (STAB-01) | PASSED (override) | Override: residual #418 class accepted and tracked in #496/#526 — accepted by Andrei Lavrenov on 2026-10-21. Original finding: See Gaps. Production 0.95.2 emits #418 on `/`. Plan 01-02 shipped no source change and no test. #526 open. |
| 2 | `/opengraph-image` never 500s; falls back to a static image on render failure; null-slot, no-active-event, homeworld-only states have render coverage (STAB-02) | VERIFIED (with warning) | `src/app/opengraph-image.jsx`: `renderOrFallback` awaits `response.arrayBuffer()` inside `tryCatch`, reports the error, returns `fallbackImage('rasterisation')`. Data-fetch failure and empty status also return `fallbackImage`. `fallbackImage` reads `public/og-fallback.png` as raw bytes (no ImageResponse), with a 1x1 PNG last resort, and sets a no-store cache policy. Success sets a shared max-age. Tests in `opengraph-image.test.jsx` cover rasteriser rejection, getCampaign rejection, empty status, telemetry exclusivity, and the three edge states (null slot, no active events, homeworld-only) plus a guard-fails-by-construction control. Production probe: 4 of 4 requests returned 200 `image/png`, `cache-control: no-store`. Warning below. |
| 3 | Notification toggle resolves to an explicit error state with a visible Retry when `serviceWorker.ready` hangs or `getSubscription()` rejects (STAB-03) | VERIFIED | `NotificationToggle.jsx`: `Promise.race` against a 5000 ms timeout, `.catch` and timeout both call `enterError` (reportError, track, state `error`); `error` state renders "Notifications unavailable" plus a Retry button that bumps `retryToken` and re-runs the effect; a `cancelled` guard stops a late `ready` resolution from overwriting the error. Tests at lines 337-455 exercise: ready never resolves (5 s), getSubscription rejects, Retry reaches a terminal state, late resolution after timeout does not overwrite, double Retry leaves one terminal state, missing VAPID key. Release PR CI passed. |
| 4 | `--font-mono` resolved one way or the other with before/after measurements recorded on the issue (STAB-04) | VERIFIED | `layout.jsx` imports `Space_Mono` from `next/font/google` and adds `spaceMono.variable` to the root class list. `layout.css` lines 49 and 101 set `--font-mono: var(--font-space-mono), monospace`. Production HTML contains the `space_mono_..._variable` class. Issue #476 carries a before/after table (comment of 2026-08-31, full record in `01-FONT-MEASUREMENTS.md`). |
| 5 | `getWarOutcome` tolerates a null faction slot, pinned by a regression test (STAB-05) | VERIFIED | `getWarOutcome.mjs` uses `f?.status` in both the live and snapshot `.every` checks. Tests at lines 154 and 165 of `getWarOutcome.test.mjs` cover a null live slot and a null snapshot slot (no throw, no victory). Same file shipped in tag `v0.95.2`. |
| 6 | #496/#503/#485 re-counted in GlitchTip on the new deployment id over 48 h and dispositioned on the measured numbers (re-scoped 2026-10-21: all three RESIDUAL, tracked in open issues), after `develop` is tagged and released to `main`, with `main` merged back (STAB-06, STAB-07) | VERIFIED against the re-scoped wording | STAB-07 (git, checked independently): tag `v0.95.2` peels to `11864900...` = `origin/main` tip = merge commit of PR #547 (parents `2b415eac` and develop `5b539144`); `package.json` on main is `0.95.2`; merge-back PR #548 merged (`53b75a52`, parents include the main merge commit); `origin/main` is an ancestor of `origin/develop` and of this worktree's HEAD. Current gap: develop is 0.95.4 against main 0.95.2, 2 versions, inside the "about 5" bound. The tag build `38547055304` succeeded and uploaded sourcemaps. Production reports `appVersion` 0.95.2 and `dpl=0-95-2` today. STAB-06: `01-GLITCHTIP-RECOUNT.md` records the method, per-class tables and verdicts. Status comments exist on #496, #503, #485. New issues #565, #566, #567 exist and are open. The original "zero events" criterion was NOT met. See the STAB-06 section. |

**Score:** 6/6 truths verified (1 override, 0 present-but-behavior-unverified).

## STAB-06: original criterion not met, re-scoped

- Original wording: the three classes show zero new events on the new deployment id over 48 h.
- Measured: all three RESIDUAL on 0.95.2. #496 has 7 groupings still firing (2 variants). #503 sharp rejection still occurs (4L, lifetime 515, last 2026-10-20). #485 has the new signature 6C at 148 events (about 23 per day).
- Decision: on 2026-10-21 the developer re-worded STAB-06 and success criterion 6 to the measured outcome (`5c24fd7b`). I read the current text in REQUIREMENTS.md and ROADMAP.md and confirmed the re-scope is recorded there.
- Against the current wording, the work is done: re-count recorded, each issue dispositioned (all three left open), residual classes filed (#565, #566, #567; R4 and R5 listed and not filed by decision).
- Measurement limits recorded in the recount document and kept here: the GlitchTip MCP gives lifetime counts, not per-window counts, for groupings that pre-date the release. The Umami `api-og-rendered` / `api-og-fallback` events for #503 were not read (INCONCLUSIVE). The GlitchTip filter was `release:0.95.2` because `dpl` is not an indexed tag.
- Honest framing: the re-scope turns STAB-06 from an outcome ("classes are gone") into a process ("classes were measured"). The classes are not gone. That is the reason truth 1 above is graded on its own wording and not folded into STAB-06.

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/utils/game/getWarOutcome.mjs` | Null-slot safe | VERIFIED | Optional chaining on both `.every` checks; wired (used by archives and OG route paths) |
| `src/app/opengraph-image.jsx` | Fallback, no-store, telemetry | VERIFIED | Substantive; wired as the Next metadata route; same content in tag |
| `public/og-fallback.png` | Committed 1200x630 static card | VERIFIED | Present, 21,337 bytes, in tag `v0.95.2` |
| `src/features/notifications/NotificationToggle.jsx` | Error state, timeout, Retry | VERIFIED | 247 lines, behavior as above |
| `src/app/layout.jsx` / `layout.css` | Space Mono via next/font, token repointed | VERIFIED | Both `--font-mono` declarations repointed |
| Tests for the above | Regression coverage | VERIFIED by reading | Not executed here; release PR #547 CI green |
| `scripts/hydration-sweep.mjs` | Reproduction harness | EXISTS | Diagnostic only; not part of the shipped fix |
| STAB-01 source fix | Hydration fix with test per divergent value | MISSING | None shipped by this phase |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Image()` in `opengraph-image.jsx` | `fallbackImage` | `tryCatch(getCampaign())`, `renderOrFallback` | WIRED | Three entry points to the fallback |
| `fallbackImage` | `public/og-fallback.png` | `readFile(join(process.cwd(), 'public', ...))` | WIRED | Production serves these exact bytes (see warning) |
| `NotificationToggle` | `reportError` / `useTrack` | `enterError` | WIRED | Telemetry reaches GlitchTip: HELLDIVERSBOT-6C |
| `layout.jsx` Space Mono | `--font-mono` token | `--font-space-mono` variable | WIRED | Class present in production HTML |
| Tag `v0.95.2` | `origin/main` | PR #547 merge commit | WIRED | Verified with git |
| `main` | `develop` | PR #548 | WIRED | Verified with git |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|----------|---------------|--------|--------------------|--------|
| `opengraph-image.jsx` | `data` from `getCampaign()` | Postgres `h1_*` tables | Yes in tests and in the Aug repro; in production every sampled response is the fallback (see warning) | FLOWING in code, DEGRADED in production |
| `NotificationToggle.jsx` | `state` | Browser APIs | Yes | FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production runs 0.95.2 | `curl https://helldivers.bot/api/h1/live` | `"appVersion":"0.95.2"` | PASS |
| Page carries the deployment id | `curl https://helldivers.bot/` | `dpl=0-95-2` (326 matches) | PASS |
| Space Mono variable class present | `curl https://helldivers.bot/` | `space_mono_..._variable` | PASS |
| OG route does not 500 | `curl -w` x4 on `/opengraph-image` | 200, `image/png`, 21,337 bytes, `no-store` each time | PASS |
| OG route serves the live card | `cmp` of body against `public/og-fallback.png` | IDENTICAL on the first request; same size and header on three more | WARNING |
| Tag/merge/merge-back topology | `git rev-parse`, `git merge-base --is-ancestor` | As in truth 6 | PASS |
| Release PR checks | `gh pr checks 547` | Test & Build, Visual Regression, Smoke Test, Version Bump pass | PASS |
| Unit tests | not run (no dependencies in worktree) | SKIPPED | SKIPPED |

## Probe Execution

SKIPPED: no probe scripts are declared by the phase plans.

## Requirements Coverage

| Requirement | Source plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STAB-01 | 01-02 | #496 hydration mismatch fixed at root | BLOCKED | Still firing in production; no fix or test shipped; #526 open |
| STAB-02 | 01-03, 01-04, 01-05 | #503 OG never 500s; root-cause; fallback; edge coverage | PARTIAL | Fallback and coverage SATISFIED. "Root-caused" NOT met: plan 01-05 ended NOT REPRODUCED (permitted by D-10), #503 open. Roadmap success criterion 2 does not require the root cause, so truth 2 passes. |
| STAB-03 | 01-06 | #485 toggle error state and Retry | SATISFIED | Code and tests as above |
| STAB-04 | 01-07 | #476 font resolved, measurements on issue | SATISFIED | Code, production HTML, issue comment |
| STAB-05 | 01-01 | #459 null-slot tolerance and test | SATISFIED | Code and tests |
| STAB-06 | 01-09 | Re-count and disposition (re-scoped wording) | SATISFIED against the current wording; original wording not met | `01-GLITCHTIP-RECOUNT.md`, issue comments, #565-#567 |
| STAB-07 | 01-08 | develop released to main, tag, merge-back, gap bound | SATISFIED | Git evidence in truth 6 |

All seven IDs are claimed by a plan frontmatter (01-01 STAB-05, 01-02 STAB-01, 01-03/04/05 STAB-02, 01-06 STAB-03, 01-07 STAB-04, 01-08 STAB-07, 01-09 STAB-06). REQUIREMENTS.md maps exactly these seven to Phase 1. No orphaned requirements.

REQUIREMENTS.md marks STAB-01 and STAB-02 `[x]` / Complete. Both marks are stronger than the evidence.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/opengraph-image.jsx` | 66-72 | Fallback served for every sampled production request | Warning | The social card is permanently the generic fallback; the route is stable but the feature is degraded |
| `01-02-SUMMARY.md` | n/a | Plan completed with zero source edits while its class still fires in production | Warning | "Complete" status does not mean the class is fixed |

No TBD/FIXME/XXX markers were checked outside the files read; the debt-marker scan was not run over the whole phase file set.

## Warnings

1. **Production OG image is the fallback.** Four of four `curl` requests on 2026-10-21 returned the committed fallback bytes (byte-identical on the first request) with `no-store`. GlitchTip shows the sharp rejection (4L, lifetime 515) still active. Truth 2 is met literally (never a 500), and the original 2026-08-07 finding in #503 (a permanently stale fallback card) now has a safer shape. The live card is still not rendering. Plan 01-05 reproduced on `linux/arm64` only. The GlitchTip event is tagged server `hetzner-production`; I did not confirm that host's CPU architecture. If it is amd64, the repro did not test the production platform. Note this in #503.
2. **#485 volume.** The error state is reached about 23 times per day (HELLDIVERSBOT-6C, 148 events). The UI behaves as designed. The count says `serviceWorker.ready` times out often on real browsers. That is a separate question for #485.
3. **STAB-06 measurement quality.** Per-window counts were not available for old groupings, and Umami was not read. The dispositions rest on lifetime counts and last-seen timestamps.
4. **Issue state.** #459, #476, #485, #496, #503 are all still open. No success criterion requires closure. The scope decision in REQUIREMENTS.md ("every open issue reaches a terminal state") still applies at milestone level.

## Gaps Summary

**Resolved by override, 2026-10-21.** The developer accepted the STAB-01 deviation and re-scoped STAB-01 and success criterion 1 to the delivered sweep; the residual hydration class stays tracked in #496 and #526. The original finding is kept below for the record.

One blocker: **STAB-01 / success criterion 1.** Plan 01-02 proved the harness works and found the timezone and date formatters already guarded, but it changed no source and added no test. Production on the released build keeps emitting #418 on `/` (text and HTML variants), so the class is not fixed and the roadmap truth "no React #418 hydration warning" is falsified by production data. The one reproducible divergence the plan found, `UserSection.jsx`, is unfixed (#526).

Options for the developer, any of which closes the gap:

- Plan a closure phase (`/gsd-plan-phase --gaps`) to root-cause the remaining variants against real production samples and fix them, with a test per divergent value.
- Re-scope STAB-01 and success criterion 1 to the measured outcome with a recorded decision, as was done for STAB-06 (this is a deliberate deviation, not an implementation alternative, so no `overrides:` entry is suggested unless the developer states it as accepted).

No deferred items: phases 2 to 18 do not cover hydration or OG root-causing (Phase 2 to 18 goals concern docs, tests, dependencies, SEO, loadout, analytics, accessibility, staging, SSE). A later "Engineering Health" milestone bucket holds #496, #503, #485 by label, but no roadmap phase owns them.

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier)_
