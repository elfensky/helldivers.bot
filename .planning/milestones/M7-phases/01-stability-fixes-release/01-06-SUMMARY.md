---
phase: 01-stability-fixes-release
plan: 06
subsystem: notifications
tags: [react, state-machine, promise-race, observability, docker, vapid, push]

# Dependency graph
requires:
  - phase: 01-01
    provides: proven fix -> test -> verify -> commit loop for this phase
provides:
  - "NotificationToggle escapes 'loading' via a distinct 'error' state reached within 5s (STAB-03)"
  - "A missing NEXT_PUBLIC_VAPID_PUBLIC_KEY surfaces as an error instead of a false 'Notifications on'"
  - "Evidence that NEXT_PUBLIC_VAPID_PUBLIC_KEY is currently ABSENT from the release image, flagged for plan 01-08"
affects: [01-08]

# Actuals (#2632)
actuals:
  tokens: 7150
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Promise.race(readinessPromise, timerPromise) with a Symbol sentinel to detect a hung browser API without an explicit cancel token"
    - "Effect-scoped `cancelled` closure flag as a stale-attempt guard, set in the cleanup function, checked before every setState in the effect"
    - "subscribeToPush() returns a discriminated { error } result instead of throwing or silently no-op'ing, so the caller can distinguish 'unsupported browser' from 'misconfigured deploy'"

key-files:
  created:
    - .planning/phases/01-stability-fixes-release/01-VAPID-IMAGE-CHECK.md
  modified:
    - src/features/notifications/NotificationToggle.jsx
    - src/__tests__/unit/features/notifications/NotificationToggle.test.jsx

key-decisions:
  - "Used a closure-scoped `cancelled` boolean (set in effect cleanup) instead of a ref-based attempt counter — Promise.race already discards the loser's later settlement, so the only real guard needed is against a superseded Retry attempt, and cleanup-time cancellation covers unmount for free"
  - "subscribeToPush() returns a discriminated { error: Error | null } result rather than throwing — keeps the no-try/catch rule (CLAUDE.md) intact and lets enable() distinguish the legitimate no-push-support no-op from the VAPID-misconfiguration case, both of which previously returned identically (undefined)"
  - "Did not reset state to 'loading' on Retry click — kept the error branch (with Retry) visible while the new attempt is in flight, avoiding a flash-to-nothing during the mount effect's null-render for 'loading'"
  - "Verified the VAPID-image-absence finding with a real `docker build` using an explicit canary build-arg, not just Dockerfile source reading — proves the negative directly since an ARG that isn't declared silently discards whatever value is passed"

requirements-completed: [STAB-03]

coverage:
  - id: D1
    description: "A hung navigator.serviceWorker.ready resolves to a distinct 'error' state within 5s, with a Retry control that recovers"
    requirement: STAB-03
    verification:
      - kind: unit
        ref: "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx#serviceWorker.ready never resolves -> after 5s renders error copy + Retry"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx#clicking Retry re-runs init against a now-healthy environment and reaches a terminal state"
        status: pass
    human_judgment: false
  - id: D2
    description: "A rejected getSubscription() reaches the same 'error' state immediately, without waiting for the timeout"
    requirement: STAB-03
    verification:
      - kind: unit
        ref: "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx#getSubscription() rejects -> renders error copy + Retry without waiting for the timeout"
        status: pass
    human_judgment: false
  - id: D3
    description: "A late serviceWorker.ready resolution after the 5s timeout does not overwrite the error state; double-click Retry leaves exactly one terminal state"
    requirement: STAB-03
    verification:
      - kind: unit
        ref: "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx#timeout fires, then a late serviceWorker.ready resolution does not overwrite the error state"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx#clicking Retry twice in quick succession leaves exactly one terminal state"
        status: pass
    human_judgment: false
  - id: D4
    description: "A missing NEXT_PUBLIC_VAPID_PUBLIC_KEY surfaces as the error state instead of a false 'Notifications on', while the legitimate no-push-support browser case still degrades quietly"
    requirement: STAB-03
    verification:
      - kind: unit
        ref: "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx#clicking Enable with NEXT_PUBLIC_VAPID_PUBLIC_KEY unset leaves the component in the error state"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx#with the key unset, the component does not claim to be enabled"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/features/notifications/NotificationToggle.test.jsx#with the key set, the existing enable flow still reaches enabled and still POSTs the subscription"
        status: pass
    human_judgment: false
  - id: D5
    description: "Documented evidence of whether NEXT_PUBLIC_VAPID_PUBLIC_KEY survives into the shipped release image"
    verification:
      - kind: other
        ref: "docker build -f Dockerfile.app --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=<canary> . && node-based grep of .next/static (see 01-VAPID-IMAGE-CHECK.md)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 6: NotificationToggle Error State + VAPID Surfacing + Release-Image Verification Summary

**Added a fifth `'error'` state to `NotificationToggle`'s state machine reached via a `Promise.race` against a 5s timer plus rejection handling, gave it a working Retry that re-runs a single extracted `init()`, made `subscribeToPush()` return a discriminated `{error}` result so a missing VAPID key surfaces instead of faking success, and confirmed by a real `docker build` that the VAPID public key is currently ABSENT from the release image.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-31T07:57:00Z (approx)
- **Completed:** 2026-08-31T08:08:53Z
- **Tasks:** 3
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- Closed STAB-03 (#485) at root cause: every path out of `NotificationToggle`'s `'loading'` state now terminates. A hung `navigator.serviceWorker.ready` reaches a distinct `'error'` state within 5 seconds (`Promise.race` against a timer), and a rejected `getSubscription()` reaches it immediately via a rejection handler on the same chain
- Extracted the mount effect's inline logic into a single `init()` function invoked both by the mount effect and by a new Retry button's click handler — no duplicated state-transition logic
- Added a per-attempt stale-guard (`cancelled` closure flag, set in the effect's cleanup) so a resolution from a superseded attempt (a second Retry click, or unmount) cannot overwrite state the user is currently looking at; a `Promise.race` loser's late settlement is inert by construction, requiring no extra handling for the timeout-then-late-resolution case
- Error copy ("Notifications unavailable" + a "Retry" button) never attributes the failure to the visitor's browser settings, satisfying the plan's transparency prohibition; entering the error state and clicking Retry both report `category-action` tracking events in the existing `notification` category, and the underlying failure is reported via `reportError()` for GlitchTip visibility
- `subscribeToPush()` now returns `{ error: Error | null }` instead of silently returning `undefined` for two previously-indistinguishable cases: "browser has no push support" (still a legitimate no-op) and "push is supported but the deploy has no VAPID key" (a misconfiguration). `enable()` routes the second case into the error state instead of unconditionally claiming `'enabled'`
- Verified with a real `docker build` (using an explicit canary build-arg) plus a distroless-safe `node`-based grep of `.next/static`, backed by source inspection of `Dockerfile.app` and both release/staging GitHub workflows, that `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is currently **ABSENT** from the shipped bundle — flagged as a release-gate item for plan 01-08
- Extended the `NotificationToggle.test.jsx` suite from 10 to 18 passing tests, pinning all four failure paths (hung readiness, rejected subscription lookup, late-resolution-after-timeout, missing VAPID key) plus the Retry recovery and double-click-idempotency paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the error state, the 5s readiness timeout, and a Retry that re-runs init** - `2253a3a9` (fix)
2. **Task 2: Surface a missing VAPID key instead of silently bailing** - `84f253ac` (fix)
3. **Task 3: Verify the VAPID public key is baked into the built image** - `c66dd38a` (docs)

**Plan metadata:** (this commit)

_Both Task 1 and Task 2 modify the same component file; they were implemented in tandem and then deliberately split into two atomic commits (Task 1's `subscribeToPush()`/`enable()` portions were temporarily reverted, tested, and committed separately from Task 2's VAPID-surfacing changes) so each commit's diff matches only its own task's acceptance criteria._

## Files Created/Modified

- `src/features/notifications/NotificationToggle.jsx` - Fifth `'error'` state, extracted `init()`, 5s readiness race with stale-attempt guard, error render branch with Retry, `subscribeToPush()`'s discriminated `{error}` return, `enable()`'s VAPID-misconfiguration routing into the error state
- `src/__tests__/unit/features/notifications/NotificationToggle.test.jsx` - 8 new test cases (5 for the error/timeout/retry mechanics, 3 for VAPID surfacing), `installBrowserAPIs` extended with `getSubscriptionRejection` and `withVapidKey` options (10 -> 18 passing)
- `.planning/phases/01-stability-fixes-release/01-VAPID-IMAGE-CHECK.md` - Reproducible evidence (Dockerfile source inspection, workflow inspection, real `docker build` + bundle grep) that the VAPID public key does not currently reach the release image; verdict ABSENT, flagged for plan 01-08

## Decisions Made

- Used a closure-scoped `cancelled` boolean set in the effect's cleanup instead of a ref-based attempt-id counter for the stale-attempt guard — simpler, and `Promise.race`'s own semantics already make the timeout's loser inert, so the guard only needs to cover the Retry-supersedes-previous-attempt case and unmount, both of which cleanup-time cancellation covers directly
- `subscribeToPush()` returns a discriminated `{ error }` result rather than throwing, keeping the codebase's no-try/catch rule intact while letting `enable()` tell the legitimate "no push support" no-op apart from the VAPID-misconfiguration case — previously both silently returned `undefined`
- Did not reset `state` to `'loading'` when Retry is clicked; the error branch (with its Retry button) stays visible while the new attempt is in flight rather than briefly rendering `null`
- Verified the VAPID-image finding with an actual `docker build` passing an explicit canary build-arg, not only by reading `Dockerfile.app` — since an undeclared `ARG` silently discards any value passed to it, running the real build is what proves the negative rather than just asserting it from source

## Deviations from Plan

None - plan executed exactly as written. The VAPID-image verdict came back `ABSENT`, which the plan itself anticipated as a possible outcome and specified exactly how to record it (flagged as a release-gate item for plan 01-08, not fixed inline in this plan).

## Issues Encountered

None. `npm run build` required sourcing `.env.development` into the shell first (same pre-existing local-environment condition already logged by plan 01-01 — `next build` runs in production mode and does not auto-load `.env.development`), not a regression from this plan.

## User Setup Required

None - no external service configuration required by this plan itself. Plan 01-08 (the release-gate item this plan's Task 3 flags) will need to add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` as a Docker build-arg to `Dockerfile.app` and both `build-release.yml`/`build-staging.yml` before this phase's fixes are meaningful in production — see `01-VAPID-IMAGE-CHECK.md`'s Finding section for the exact change needed.

## Next Phase Readiness

- STAB-03 is closed at root cause: `NotificationToggle` has no remaining silent-failure path out of `'loading'`
- Plan 01-08's release gate has a concrete, evidenced action item: add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` as a build-arg in `Dockerfile.app` (mirroring the existing `NEXT_PUBLIC_SENTRY_DSN` pattern) and in both GitHub Actions build workflows, or Task 2's fix will put every push-capable production visitor into the new error state
- No blockers identified for subsequent Phase 1 plans

---
*Phase: 01-stability-fixes-release*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: src/features/notifications/NotificationToggle.jsx
- FOUND: src/__tests__/unit/features/notifications/NotificationToggle.test.jsx
- FOUND: .planning/phases/01-stability-fixes-release/01-VAPID-IMAGE-CHECK.md
- FOUND: .planning/phases/01-stability-fixes-release/01-06-SUMMARY.md
- FOUND commit: 2253a3a9
- FOUND commit: 84f253ac
- FOUND commit: c66dd38a
- Re-ran `npm run test:unit -- src/__tests__/unit/features/notifications/NotificationToggle.test.jsx`: 18 passed, 0 failed
- Re-ran `grep -Eq 'Verdict: (PRESENT|ABSENT)' 01-VAPID-IMAGE-CHECK.md`: PASS
