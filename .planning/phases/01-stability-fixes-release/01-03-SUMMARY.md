---
phase: 01-stability-fixes-release
plan: 03
subsystem: infra
tags: [opengraph-image, next-og, playwright, caching, glitchtip, stability]

# Dependency graph
requires:
  - phase: 01-01
    provides: tryCatch/reportError conventions proven end to end
provides:
  - Static, design-time-generated 1200x630 OG crash-fallback PNG served as raw bytes (no Satori/sharp on the fallback path)
  - Outcome-dependent Cache-Control on /opengraph-image (public max-age on success, no-store on fallback)
  - A next.config.mjs exclusion so the route's own Cache-Control is not silently overridden by the site-wide catch-all header rule
  - Production-build evidence (not just mocked unit tests) that the fallback is uncacheable and the route recovers after the underlying failure clears
affects: [05-seo-analytics-foundation]

# Actuals (#2632)
actuals:
  tokens: 5040
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Static-asset fallback branch: read a committed PNG via node:fs/promises readFile instead of constructing a second ImageResponse, so the fallback shares no failure mode with the primary render pipeline"
    - "Outcome-dependent Cache-Control set explicitly per Response instead of a segment-level `revalidate` export, so a single failed render can no longer poison the cache for subsequent callers"
    - "next.config.mjs's catch-all headers() rule must explicitly exclude any route that sets its own outcome-dependent Cache-Control — config-level headers silently override route-level ones in a production build"

key-files:
  created:
    - scripts/generate-og-fallback.mjs
    - public/og-fallback.png
    - .planning/phases/01-stability-fixes-release/01-OG-CACHE-VERIFICATION.md
  modified:
    - src/app/opengraph-image.jsx
    - src/__tests__/unit/app/opengraph-image.test.jsx
    - next.config.mjs

key-decisions:
  - "fallbackImage() reads public/og-fallback.png via fs/promises readFile rather than constructing a second ImageResponse — this is the actual STAB-02 fix: the fallback no longer shares the Satori/sharp pipeline that can fail identically to the live card"
  - "Cache-Control moved from a segment-level `revalidate = 300` export to explicit per-Response headers (`dynamic = 'force-dynamic'` plus success/fallback constants), because segment-level ISR caches whatever the route returns and cannot distinguish a good render from a crashed fallback"
  - "Rasterisation and fallback-read failures are reported via reportError (route: 'opengraph-image', distinguishing stage) instead of a direct Sentry.captureException call, for consistency with the rest of the codebase; this is intentionally layered on top of tryCatch's own automatic warning-level report, matching tryCatch's documented tiebreaker pattern"
  - "[Rule 1 - Bug] next.config.mjs's site-wide catch-all Cache-Control rule was excluding /api/*, /_next/*, asset roots, /sw.js, /workers/*, and /profile/* but not /opengraph-image — it silently overrode the route's own header in both directions, including replacing the fallback's no-store with a cacheable directive. Found only by testing against a real production standalone build (Task 3), not by the mocked unit tests. Fixed by adding /opengraph-image to the exclusion list, the same way /api/* is already excluded"

requirements-completed: [STAB-02]

coverage:
  - id: D1
    description: "A committed, reproducible 1200x630 branded static fallback PNG exists and asserts no game state"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "node scripts/generate-og-fallback.mjs && IHDR check reports w 1200 h 630"
        status: pass
      - kind: other
        ref: "npm run lint on scripts/generate-og-fallback.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A render failure serves the static fallback as raw bytes (no ImageResponse, no Satori, no sharp on the fallback path) with a no-store Cache-Control"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#falls back to the static bytes instead of throwing when the rasteriser rejects"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#serves the uncacheable static fallback without constructing an ImageResponse when getCampaign rejects"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#serves the uncacheable static fallback without constructing an ImageResponse when status is empty"
        status: pass
      - kind: e2e
        ref: ".planning/phases/01-stability-fixes-release/01-OG-CACHE-VERIFICATION.md — requests 3-4 (unreachable DB) against a production standalone build"
        status: pass
    human_judgment: false
  - id: D3
    description: "A successful render still caches (non-zero shared max-age), so the dynamic card stays primary"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#caches a successful render with a non-zero shared max-age"
        status: pass
      - kind: e2e
        ref: ".planning/phases/01-stability-fixes-release/01-OG-CACHE-VERIFICATION.md — requests 1-2 and request 5 (recovery) against a production standalone build"
        status: pass
    human_judgment: false
  - id: D4
    description: "A rasterisation failure is reported to GlitchTip via reportError with the route tag preserved"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#reports the rasterisation failure to GlitchTip with the route tag preserved"
        status: pass
    human_judgment: false
  - id: D5
    description: "The no-store header on the fallback actually defeats Next's route cache in a production build, not only in the unit test's mocked world (backstop must-have)"
    requirement: STAB-02
    verification:
      - kind: e2e
        ref: ".planning/phases/01-stability-fixes-release/01-OG-CACHE-VERIFICATION.md — full 5-request sequence, including the post-recovery request returning the live card, not a frozen fallback"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 3: OG Image Static Crash-Fallback + Outcome-Dependent Cache Summary

**Replaced the OG route's Satori-rendered crash fallback with a committed static PNG served as raw bytes, split Cache-Control by render outcome, and fixed a next.config.mjs header rule that was silently overriding both — a real "frozen fallback" bug caught only by testing against a production standalone build.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-31T07:40:00Z (approx)
- **Completed:** 2026-08-31T07:54:37Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- `scripts/generate-og-fallback.mjs` renders a 1200x630 branded PNG via Playwright chromium from an inline HTML document (no `sharp`, no `next/og`) and writes `public/og-fallback.png`, committed as the reproducible source of truth for the fallback card
- `fallbackImage()` in `src/app/opengraph-image.jsx` no longer constructs an `ImageResponse` — it reads the committed PNG via `fs/promises readFile` and returns it as raw bytes, with a 1x1 transparent PNG as a last-resort if even that read fails, closing STAB-02 (#503) at the actual root cause: the fallback previously shared the same Satori/sharp pipeline that could fail like the live card
- Replaced the segment-level `revalidate = 300` export with `dynamic = 'force-dynamic'` plus explicit per-`Response` `Cache-Control`: `public, s-maxage=300, stale-while-revalidate=60` on success, `no-store` on the fallback — a render failure can no longer freeze a cached fallback in front of subsequent callers
- Extended the unit suite from 2 to 6 cases covering both existing behaviours plus the new fallback-bytes path, cache-header split, error reporting, and the `getCampaign()` reject/empty-status guard paths — all passing
- Task 3's production-build verification against a real `output: 'standalone'` server (not mocks) caught a genuine bug: `next.config.mjs`'s site-wide catch-all `headers()` rule matched `/opengraph-image` and silently overrode the route's own `Cache-Control` in both directions — including replacing the fallback's `no-store` with a cacheable directive, reproducing the exact bug STAB-02 exists to fix. Fixed by excluding `/opengraph-image` from that rule (same pattern already used for `/api/*`), then re-verified: success responses carry `s-maxage=300`, fallback responses carry `no-store`, fallback bytes match the committed PNG exactly, and the post-recovery request returns the live card rather than a frozen fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Design and commit the static fallback card and its generator** - `25557f41` (feat)
2. **Task 2: Serve the static fallback as raw bytes and split cache headers by outcome** - `a9221169` (fix)
3. **Task 3: Prove the cache split against a real production build** - `46d82383` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified
- `scripts/generate-og-fallback.mjs` - Design-time Playwright generator for the static fallback PNG, no sharp/next/og dependency
- `public/og-fallback.png` - Committed 1200x630 branded crash-fallback card, distinguishable composition from the live map+stats card, asserts no game state
- `src/app/opengraph-image.jsx` - Async `fallbackImage()` reads static bytes instead of rendering; `dynamic = 'force-dynamic'` replaces `revalidate = 300`; explicit success/fallback `Cache-Control`; error reporting routed through `reportError`
- `src/__tests__/unit/app/opengraph-image.test.jsx` - Extended from 2 to 6 cases: success caching, fallback bytes/no-store/no-ImageResponse on rasterisation reject, error reporting with route tag, getCampaign-reject and empty-status guard paths
- `next.config.mjs` - Excluded `/opengraph-image` from the catch-all `Cache-Control` header rule so the route's own outcome-dependent header is not silently overridden (Rule 1 fix, found via Task 3's production-build verification)
- `.planning/phases/01-stability-fixes-release/01-OG-CACHE-VERIFICATION.md` - Recorded evidence from 5 requests against a real standalone build: 2 against a healthy DB, 2 against an unreachable DB, 1 after DB recovery, including the found-and-fixed next.config.mjs bug

## Decisions Made
- Static-bytes fallback via `fs/promises readFile` rather than any image-pipeline call, so the fallback branch cannot fail the way the live card can (the actual STAB-02 root-cause fix)
- Segment-level `revalidate` replaced by `dynamic = 'force-dynamic'` plus per-response headers, since ISR caches whatever the route returns and cannot distinguish outcomes
- Error reporting moved from a direct `Sentry.captureException` call to `reportError`, layered on top of `tryCatch`'s own automatic warning-level report — matches the codebase's existing warning/error severity tiebreaker convention rather than introducing a new one
- `next.config.mjs`'s catch-all Cache-Control rule updated to exclude `/opengraph-image`, mirroring the existing `/api/*` exclusion and its stated rationale ("route handlers set their own Cache-Control")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] next.config.mjs silently overrode the route's own Cache-Control**
- **Found during:** Task 3 (production-build verification)
- **Issue:** `next.config.mjs`'s site-wide catch-all `headers()` rule (`Cache-Control: public, s-maxage=30, stale-while-revalidate=60` on everything not already excluded) matched `/opengraph-image` and replaced whatever `Cache-Control` the route set — on the success path it silently downgraded `s-maxage=300` to `s-maxage=30`, and on the fallback path it silently replaced `no-store` with a cacheable directive, reproducing the exact "frozen fallback" bug STAB-02 exists to fix. This was invisible to the Task 2 unit tests, which never touch `next.config.mjs`.
- **Fix:** Added `/opengraph-image` to the catch-all rule's exclusion regex in `next.config.mjs`, following the same pattern and stated rationale already used for `/api/*`.
- **Files modified:** `next.config.mjs`
- **Verification:** Rebuilt and re-ran the full 5-request production-build sequence; all five responses now carry the route's own header (`s-maxage=300` on success, `no-store` on fallback), documented in `01-OG-CACHE-VERIFICATION.md`. Full unit suite (190 files, 1985 tests) and `npm run lint`/`npm run typecheck`/`npm run build` re-run clean after the fix.
- **Committed in:** `46d82383` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** This fix is the difference between the plan's stated success criterion actually holding in production and only appearing to hold against mocks — without it, STAB-02 would have shipped un-fixed despite every unit test passing. No scope creep: the fix is a one-line regex exclusion with the same shape as an existing entry in the same rule.

## Issues Encountered

None beyond the deviation above. The standalone-server verification required starting the server manually (bypassing `scripts/start-standalone.sh`'s `/api/healthcheck` gate) for the broken-DB runs, since the healthcheck endpoint itself depends on the database and would never report healthy against a deliberately unreachable one — this is expected script behavior, not a bug in the script.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/opengraph-image` cannot 500 and cannot get stuck on a stale fallback: the crash path serves a committed branded PNG with no image pipeline involved, that response is never cached, the success path still caches for 5 minutes, and both are proven against a production standalone build
- The next.config.mjs catch-all Cache-Control pattern is now a known gotcha for any future route that sets its own outcome-dependent headers — worth checking against this list before assuming a route-level `Cache-Control` will actually reach the client
- No blockers identified

---
*Phase: 01-stability-fixes-release*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: scripts/generate-og-fallback.mjs
- FOUND: public/og-fallback.png
- FOUND: src/app/opengraph-image.jsx
- FOUND: src/__tests__/unit/app/opengraph-image.test.jsx
- FOUND: next.config.mjs
- FOUND: .planning/phases/01-stability-fixes-release/01-OG-CACHE-VERIFICATION.md
- FOUND: .planning/phases/01-stability-fixes-release/01-03-SUMMARY.md
- FOUND commit: 25557f41
- FOUND commit: a9221169
- FOUND commit: 46d82383
- FOUND commit: 41974a73
