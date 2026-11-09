# Milestone M7: Production is stable on the Hetzner swarm

**Status:** ✅ SHIPPED 2026-10-25
**Phases:** 1–1.1
**Total Plans:** 9 (22 tasks); Phase 1.1 was an operational release without plans
**Versions:** 0.92.0–0.96.4, released to `main` as v0.95.2 (2026-10-14) and v0.96.4 (2026-10-25)

## Overview

**Milestone goal:** The known production bug classes are fixed or tracked, and production runs on the Hetzner swarm, released as v0.96.4.

`milestone complete` archived it on 2026-11-09. The phase detail below is the roadmap as it stood at close. The phase
folders are in `milestones/M7-phases/`.

## Phases

- [x] **Phase 1: Stability Fixes & Release** - The five known production bug classes are fixed at root cause, verified live, and `develop` is released to `main` (completed 2026-10-21)
- [x] **Phase 1.1: Production on the Hetzner Swarm** (INSERTED) - Production runs on the Hetzner swarm, and every release reaches it through `pin-production` (#588) (completed 2026-10-25)

### Phase 1: Stability Fixes & Release

**Goal**: The five known production bug classes are fixed at root cause, verified in production, and `develop` is released to `main`
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: STAB-01, STAB-02, STAB-03, STAB-04, STAB-05, STAB-06, STAB-07
**Success Criteria** (what must be TRUE):

  1. The hydration taxonomy on `/` is swept in a real browser across timezones with every date/locale divergence confirmed guarded and the sweep harness committed; residual #418 mismatches on 0.95.2 are tracked in #496 and #526 (STAB-01, re-scoped 2026-10-21: the planned per-variant fix made no source change and the class measured RESIDUAL)
  2. `/opengraph-image` never 500s — it falls back to a static image on render failure, and null-slot, no-active-event, and homeworld-only map states have render coverage (STAB-02)
  3. The notification toggle resolves to an explicit error state with a visible retry when `serviceWorker.ready` hangs or `getSubscription()` rejects, instead of spinning forever (STAB-03)
  4. `--font-mono` is resolved one way or the other (loaded via `next/font`, or dropped from the token) with before/after measurements of affected elements recorded on the issue (STAB-04)
  5. `getWarOutcome` tolerates a null faction slot instead of throwing, pinned by a regression test (STAB-05)
  6. the #496/#503/#485 classes are re-counted in GlitchTip on the new deployment id over a 48-hour window and dispositioned on the measured numbers (re-scoped 2026-10-21: all three RESIDUAL, tracked in the open issues) after `develop` is tagged and released to `main`, with `main` merged back into `develop` (STAB-06, STAB-07)

**Plans**: 9/9 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Tracer: getWarOutcome null-slot guard + buildPlayerBeats zero-baseline coverage (STAB-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Hydration sweep, per-variant fixes and regression tests on `/` (STAB-01)
- [x] 01-03-PLAN.md — OG static crash fallback served as raw bytes, per-outcome cache headers (STAB-02)
- [x] 01-06-PLAN.md — NotificationToggle error state, 5s timeout, Retry and VAPID surfacing (STAB-03)
- [x] 01-07-PLAN.md — Space Mono via next/font, token repoint, before/after measurements (STAB-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — OG render telemetry, getCampaign failure-mode audit, edge-case map-state coverage (STAB-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Time-boxed sharp-rejection reproduction against the standalone image (STAB-02)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-08-PLAN.md — Symbolication gate, single develop→main release, tag and merge-back (STAB-07)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-09-PLAN.md — 48h GlitchTip re-count on the new deployment id, issue disposition (STAB-06)

**UI hint**: yes

### Phase 1.1: Production on the Hetzner Swarm (INSERTED)

**Goal:** Production runs on the Hetzner swarm, and every release reaches it through `pin-production`
**Issue:** #588
**Requirements**: none (an infrastructure move, tracked by #588)
**Depends on:** Phase 1
**Success Criteria** (what must be TRUE):

  1. Stack `helldiversbot` (`app` ×2, `cloudflared` ×2) runs on the Arcane environment production01, applied by Arcane Git Sync from the CI-owned branch `deploy/production` (`deploy/README.md` § Production)
  2. A release tag `vX.Y.Z` builds both images, and `pin-production` force-pushes `deploy/production` with that tag; no manual image pull happens on the production host
  3. The unreleased `develop` backlog (0.95.9 to 0.96.4) ships as v0.96.4 through this pipeline, and production reports `appVersion` 0.96.4 (v0.96.3 built no app image: its arm64 leg failed under QEMU)

**Impact on Phase 2:** plans 02-01, 02-09, 02-11 and 02-12 assume release v0.95.7 and a manual production pull. Production now runs releases pinned by `pin-production`, so these four plans need a re-plan before Phase 2 executes.

**Plans:** none — an operational release; evidence in `01.1-RELEASE-RECORD.md`

---

## Milestone Summary

**Decimal Phases:**

- Phase 1.1: Production on the Hetzner Swarm (inserted after Phase 1 for #588)

**Key Decisions:** PROJECT.md § Key Decisions holds them: stability before features, STAB-01 and STAB-06 re-scoped
to the measured outcome on 2026-10-21, GlitchTip re-counts filtered on `release:<version>`.

**Issues Deferred:**

- #496, #526, #503, #485, #565, #566 and #567: the residual classes measured on 0.95.2, open in Engineering Health.
- Phase 2 plans 02-01, 02-09, 02-11 and 02-12 assume a manual production pull and need a re-plan.

**Execution metrics** (moved from STATE.md at close):

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 8min | 2 tasks | 3 files |
| Phase 01 P02 | 17min | 3 tasks | 3 files |
| Phase 01 P03 | 15min | 3 tasks | 6 files |
| Phase 01 P06 | 15min | 3 tasks | 3 files |
| Phase 01 P07 | 35min | 3 tasks | 3 files |
| Phase 01 P04 | 12min | 3 tasks | 2 files |
| Phase 01 P05 | 10min | 2 tasks | 1 files |
| Phase 01 P09 | 45min | 3 tasks | 2 files |

**Phase decisions** (moved from STATE.md at close):

- Roadmap: Stability (Phase 1) ships and releases before any other phase, since every later phase re-renders the same dashboard tree
- [Phase 01]: Used optional chaining (f?.status) at both getWarOutcome .every call sites rather than an early bail — smaller diff, symmetric checks, closes STAB-05 at root cause
- [Phase 01]: STAB-01's timezone/date hydration mismatches on / are already resolved on develop; the sweep made zero source edits — All files_modified candidates were already correctly guarded (suppressHydrationWarning at every render-time consumer, or timeZone: 'UTC' already pinned, or provably a Server Component); verified via a validated real-browser Playwright harness across 4 timezones
- [Phase 01]: A real, out-of-scope hydration bug (UserSection.jsx auth-session race) was found and filed as issue #526 rather than fixed inline — Its correct fix is a mounted/hasHydrated gating boolean, explicitly prohibited by this plan's own acceptance criteria, and the bug is structurally different from the date/timezone taxonomy this plan targets
- [Phase 01]: next.config.mjs's catch-all Cache-Control header rule must exclude any route setting its own outcome-dependent Cache-Control — it silently overrides route-level headers in a production build, which is how the /opengraph-image no-store fallback fix was almost defeated
- [Phase 01]: [Phase 01]: NotificationToggle's stale-attempt guard uses a closure-scoped cancelled flag (set in effect cleanup) rather than a ref-based attempt-id counter — Promise.race already discards a timed-out attempt's late settlement, so the guard only needs to cover Retry-supersedes-previous-attempt and unmount
- [Phase 01]: [Phase 01]: subscribeToPush() returns a discriminated {error} result instead of throwing or silently no-op'ing, so enable() can tell 'no push support in this browser' (legitimate no-op) apart from 'VAPID key missing' (misconfiguration) — previously both returned undefined
- [Phase 01]: Kept Space Mono per D-17 and made it load for real via next/font, following the working variable-reference pattern rather than the bare-string pattern --font-display/--font-body still use (separate, out-of-scope bug, flagged for later)
- [Phase 01]: The project's vitest browser-mode visual-regression harness cannot execute next/font (runs under Vite, not Next's build pipeline) — switched the before/after measurement instrument to the real dev server via a temporary, non-committing file revert/restore
- [Phase 01]: [Phase 01]: getCampaign() audited (D-11) — no masking found; the OG route's own null-slot handling in factionStats/allDefeated was the real bug, fixed with the same f?.field pattern as getWarOutcome.mjs (STAB-05)
- [Phase 01]: [Phase 01]: OG route telemetry uses after() (not fire-and-forget) since opengraph-image is documented as a special Route Handler; no separate cache-hit event needed since the route only executes on a real invocation
- [Phase 01]: [Phase 01]: OG sharp rejection (#503) reproduction attempt: NOT REPRODUCED against a locally built linux/arm64 standalone image across three distinct real map states; two of three hypotheses ruled out by inspection, findings posted to #503 which stays open
- [Phase 01]: 01-09: all three STAB-06 classes RESIDUAL on release 0.95.2; #496/#503/#485 stay open; residual issues #565/#566/#567 filed

**Roadmap evolution** (moved from STATE.md at close):

- Phase 01.1 inserted after Phase 1: Production on the Hetzner Swarm (#588): pin-production deploys every release; Phase 2 plans 02-01/02-09/02-11/02-12 assume v0.95.7 and a manual pull (URGENT)

---

_For current project status, see .planning/ROADMAP.md_
