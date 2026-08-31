---
phase: 01-stability-fixes-release
plan: 04
subsystem: infra
tags: [opengraph-image, umami, telemetry, glitchtip, getCampaign, observability]

# Dependency graph
requires:
  - phase: 01-03
    provides: Static crash-fallback PNG served as raw bytes, outcome-dependent Cache-Control, next.config.mjs exclusion for /opengraph-image
provides:
  - One outcome-labelled Umami event (api-og-rendered / api-og-fallback) per real /opengraph-image invocation, fired via after()
  - A fallback event data.stage field distinguishing rasterisation, query-failure, and empty-data causes
  - A split OG data guard that reports a getCampaign() query failure to GlitchTip and stays silent on a legitimately empty season
  - An enumerated audit of getCampaign()'s failure modes (D-11), recorded below
  - A fixed null-faction-slot crash in the OG route's factionStats/allDefeated logic, plus three tests pinning null-slot, no-active-events, and homeworld-only map states against the real route
affects: [05-seo-analytics-foundation]

# Actuals (#2632)
actuals:
  tokens: 4632
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Route-level telemetry via after(): a single trackOgOutcome() helper wraps umamiTrackEvent in after(), called from exactly one place per code path (renderOrFallback's success branch, fallbackImage's entry) so the event count structurally equals the invocation count"
    - "Fallback-stage tagging: fallbackImage(stage) takes a stage argument threaded from every call site (rasterisation / query-failure / empty-data), carried on both the Umami event and (for query-failure) the reportError call, so causes are separable without opening GlitchTip"
    - "Incident-vs-legitimate-empty disposition split: a data guard's two failure shapes get two different reportError dispositions instead of one silently-swallowed fallback — same shape as the getWarOutcome.mjs null-guard precedent from plan 01-02 (STAB-05)"

key-files:
  created: []
  modified:
    - src/app/opengraph-image.jsx
    - src/__tests__/unit/app/opengraph-image.test.jsx

key-decisions:
  - "after() is used for the telemetry call because opengraph-image is documented as \"a special Route Handler\" (Next 16 file-conventions docs) and Route Handlers are a supported after() call site — confirmed against node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md and .../01-metadata/opengraph-image.md before writing the call, per the plan's flagged assumption"
  - "No separate cache-hit telemetry event: the route only executes on a real invocation, so the rendered+fallback event count IS the invocation count; the gap against the page's own OG-fetch volume derives the cache-hit rate without a dedicated counter (D-09)"
  - "getCampaign() audited and left unchanged — no masking of a real error as an empty result was found. Its only null-returning path (_findSeason finding no last_updated season) and its own $queryRaw/findMany rejections both surface correctly as caller-visible failures already"
  - "The OG route's own data.status handling (not getCampaign.mjs) had the real bug: a null faction entry in data.status crashed factionStats.map()/allDefeated's .every() with an uncaught TypeError, never caught by any tryCatch. Fixed with the same f?.field / .filter(Boolean) pattern already established in getWarOutcome.mjs (plan 01-02, STAB-05) rather than touching computeMapState.mjs, which is mocked in this route's tests and has no evidence of ever receiving a null status entry in production"

getCampaign-failure-modes:
  - mode: "db.h1_season.findFirst rejects (connection refused, statement timeout, adapter error)"
    location: "_findSeason, src/db/queries/getCampaign.mjs"
    disposition: "Caught by an internal tryCatch and re-thrown — surfaces as a rejected getCampaign() promise. Not masked."
  - mode: "_findSeason resolves with no row (no season has a non-null last_updated)"
    location: "_findSeason, src/db/queries/getCampaign.mjs"
    disposition: "getCampaign() returns null early. Legitimate on a brand-new/unseeded database; the OG route's guard now treats a null resolved value as structurally wrong (query-failure disposition, reported), since it is indistinguishable from a stuck/partial import without deeper inspection."
  - mode: "db.$queryRaw (h1_status, h1_statistic) or db.h1_status/h1_statistic/h1_event.findMany rejects"
    location: "getCampaign(), src/db/queries/getCampaign.mjs"
    disposition: "Not wrapped in an internal tryCatch — rejects the whole getCampaign() promise directly. Not masked; surfaces to the caller's own tryCatch(getCampaign())."
  - mode: "rawLiveRows resolves with zero rows for the season (no h1_status polls landed yet — a season boundary)"
    location: "getCampaign(), src/db/queries/getCampaign.mjs"
    disposition: "liveRows (and therefore data.status) is a well-formed empty array. Legitimately empty, not an incident — the OG route's guard disposes this as empty-data, no error reported."

requirements-completed: [STAB-02]

coverage:
  - id: D1
    description: "Every real OG invocation fires exactly one outcome-labelled Umami event (api-og-rendered or api-og-fallback), fired without blocking the response"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#a successful render fires exactly one telemetry call marking the rendered outcome"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#a rasterisation failure fires exactly one fallback-outcome telemetry call and still reports the original error"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#a data-fetch failure fires exactly one telemetry call marking the fallback outcome"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#the rendered and fallback events are mutually exclusive — no invocation fires more than one telemetry call"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fallback event's data object distinguishes a rasterisation failure from a data-fetch/query failure via a stage field"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#a rasterisation failure fires exactly one fallback-outcome telemetry call and still reports the original error (asserts stage: 'rasterisation')"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#a data-fetch failure fires exactly one telemetry call marking the fallback outcome (asserts stage: 'query-failure')"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rejected getCampaign() (query failure) is reported to GlitchTip; a well-formed empty result is not (D-11 disposition split)"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#a rejected getCampaign() is dispositioned as a query failure and reported to GlitchTip (D-11)"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#a well-formed empty result is dispositioned as legitimately empty and does NOT report an error (D-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "getCampaign()'s failure modes are enumerated with their dispositions (D-11 audit)"
    requirement: STAB-02
    verification: []
    human_judgment: true
    rationale: "This is a documentation/audit deliverable (see the getCampaign-failure-modes frontmatter block above), not something a single automated check proves — a human reviewing #503 confirms the audit is complete and the dispositions are correct."
  - id: D5
    description: "Null-slot, no-active-events, and homeworld-only map states each render a real card via the actual route, not the fallback"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#a null faction slot in data.status still renders a real card, not the fallback"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#no-active-events map state still renders a real card, not the fallback"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#homeworld-only map state (active attack, no sector campaigns) still renders a real card, not the fallback"
        status: pass
      - kind: unit
        ref: "src/__tests__/unit/app/opengraph-image.test.jsx#control: guard fails when driven to the fallback by construction"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 4: OG Image Telemetry, getCampaign Failure Audit, and Edge-Case Render Coverage Summary

**One outcome-labelled Umami event per real /opengraph-image invocation, a getCampaign() failure-mode audit that splits query failures (reported) from legitimately empty seasons (silent), and a genuine null-faction-slot crash found and fixed while pinning three previously-untested map-state shapes against the real route.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-31T08:39:27Z
- **Completed:** 2026-08-31T08:51:07Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- `trackOgOutcome()` in `src/app/opengraph-image.jsx` fires exactly one `api-og-rendered` or `api-og-fallback` Umami event per real invocation via `after()`, never blocking the response — the rendered-vs-fallback ratio and the route's real re-run rate (distinct from cache hits, since the route cannot execute on a cache hit) are both now answerable from telemetry (D-09)
- `fallbackImage(stage)` threads a `stage` argument (`rasterisation` / `query-failure` / `empty-data`) from every call site onto the fallback event's data object, so the three causes are separable in Umami without opening GlitchTip
- Audited `getCampaign()` (`src/db/queries/getCampaign.mjs`) per D-11: four failure modes enumerated (see `getCampaign-failure-modes` frontmatter), no masking of a real error as an empty result found, file left unchanged
- Split the OG route's single collapsed data guard into two dispositions: a rejected `getCampaign()` or a structurally wrong resolved value now calls `reportError` with `stage: 'data-fetch'` before falling back — today's guard reported nothing at all on a real query failure, which is exactly why the original #503 freeze had no telemetry trail. A well-formed empty `status` array stays silent (not an incident)
- Found and fixed a genuine, previously-undetected crash: a null entry in `data.status` threw an uncaught `TypeError` in `factionStats.map()`/`allDefeated`'s `.every()`, never caught by any `tryCatch` — worse than the graceful fallback #503 exists to guarantee. Fixed with the same `f?.field` / `.filter(Boolean)` pattern already established for this bug class in `getWarOutcome.mjs` (plan 01-02, STAB-05)
- Extended the unit suite from 6 to 16 cases: 4 telemetry-outcome tests, 2 D-11 disposition tests, and 4 edge-case map-state tests (a control case plus the three CONCERNS.md-named shapes: null-slot, no-active-events, homeworld-only), each asserting a real `ImageResponse` construction and the rendered telemetry event, not the fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Emit render-outcome telemetry on every real invocation** - `b1d94404` (feat)
2. **Task 2: Audit getCampaign's failure modes and split the OG data guard** - `1a428b63` (fix)
3. **Task 3: Render coverage for the three suspect edge-case map states** - `fb2feadf` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/app/opengraph-image.jsx` - `trackOgOutcome()`/`after()` telemetry on every real invocation; `fallbackImage(stage)` carries the failure cause; split data guard reports query failures and stays silent on legitimately empty seasons; `factionStats`/`allDefeated` now null-slot-safe
- `src/__tests__/unit/app/opengraph-image.test.jsx` - Extended from 6 to 16 cases: telemetry outcome/mutual-exclusivity, D-11 disposition (reported vs silent), and edge-case map-state render coverage (null-slot, no-active-events, homeworld-only) built from the real `computeMapState()` via `vi.importActual`

## Decisions Made
- `after()` chosen for the telemetry call over an unawaited fire-and-forget promise, since `opengraph-image` is documented as "a special Route Handler" and Route Handlers are a supported `after()` call site (confirmed against the vendored Next 16 docs before writing the call, per the plan's flagged assumption)
- No separate cache-hit telemetry event — the invocation count derived from the two outcome events already answers the re-run-vs-cache-hit question structurally, per D-09's stated design
- `getCampaign.mjs` left unchanged after the D-11 audit — no masking bug was found there; the crash and the silent-fallback bug were both in the OG route's own caller-side handling
- The null-slot fix stops at `opengraph-image.jsx`; `computeMapState.mjs` was not touched despite having the same theoretical vulnerability (`campaign.enemy` unguarded), because it is mocked in this route's tests, has no evidence of ever receiving a null status entry from `getCampaign()` in production, and touching it would affect every other consumer (dashboard, live map) — flagged as an out-of-scope hardening concern rather than fixed speculatively

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Null faction slot in `data.status` crashed the OG route with an uncaught TypeError**
- **Found during:** Task 3 (writing the null-slot edge-case test, per the task's own instruction to probe this exact scenario)
- **Issue:** `factionStats = data.status.map((f) => { const idx = f.enemy; ... })` and `data.status.every((f) => f.status === CAMPAIGN_STATUS.DEFEATED)` both accessed properties on `f` unguarded. A manual probe confirmed a null entry in `data.status` throws `TypeError: Cannot read properties of null (reading 'enemy')`, uncaught by any `tryCatch` in the request path — a harder failure than the graceful fallback #503 exists to guarantee, and the exact bug class `getWarOutcome.mjs` was already fixed for in plan 01-02 (STAB-05), independently flagged as a cross-reference in this phase's `01-PATTERNS.md`.
- **Fix:** `factionStats` now runs `data.status.filter(Boolean).map(...)`, dropping a null slot instead of rendering it; `allDefeated`'s `.every()` now reads `f?.status`.
- **Files modified:** `src/app/opengraph-image.jsx`
- **Verification:** New test `a null faction slot in data.status still renders a real card, not the fallback` passes; manually confirmed via a throwaway probe test that the crash existed before this fix and is gone after.
- **Committed in:** `fb2feadf` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** This fix is necessary for the plan's own Test 1 acceptance criterion ("drives the route to a real rendered card") to hold against real, not artificially-avoided, input. No scope creep — the fix is scoped to the same file and pattern already established elsewhere in this phase. `computeMapState.mjs`'s theoretical equivalent vulnerability was deliberately left untouched as out of scope (see Decisions Made).

## Issues Encountered

`npm run build` failed locally with `POSTGRES_URL is not set` on the first attempt — the same pre-existing local-environment condition already logged by plans 01-01 and 01-06 (`next build` runs in production mode and does not auto-load `.env.development`). Re-ran with `.env.development` sourced into the shell; build then completed successfully with the expected static/dynamic route table, including `/opengraph-image`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `/opengraph-image`'s render-outcome ratio and re-run rate are now answerable from Umami without opening GlitchTip, and a real query failure against `getCampaign()` now reaches GlitchTip instead of degrading silently
- The three map-state shapes CONCERNS.md flagged as untested against the Satori pipeline (null-slot, no-active-events, homeworld-only) are now pinned by tests driving the real route, and the one shape that genuinely crashed (null-slot) is fixed
- `computeMapState.mjs`'s equivalent null-entry vulnerability remains theoretical and unfixed — worth a follow-up issue if `getCampaign()` is ever changed to permit a null status entry, or if another caller passes unsanitized faction data into `computeMapState`/`computeLiveMapState` directly
- No blockers identified

---
*Phase: 01-stability-fixes-release*
*Completed: 2026-08-31*
