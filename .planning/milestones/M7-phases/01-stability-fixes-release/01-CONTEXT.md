# Phase 1: Stability Fixes & Release - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning

<domain>
## Phase Boundary

The five known production bug classes (#496 hydration, #503 OG image, #485 notification toggle, #476 Space Mono, #459 null faction slot) are fixed at root cause on `develop`, then `develop` (0.93.1+) is released to `main` (currently v0.90.14) in one release, and GlitchTip shows zero new events for the #496/#503/#485 classes on the new deployment id over a 48-hour window. Requirements: STAB-01..07. No new capabilities — bug elimination, verification, and release mechanics only.

</domain>

<decisions>
## Implementation Decisions

### Release sequencing & verification (STAB-06, STAB-07)
- **D-01:** One release after all five fixes land — a single develop→main PR + `vX.Y.Z` tag, then `main` merged back into `develop`. Not a baseline release now plus a fix release later, and not per-fix releases.
- **D-02:** The 48h GlitchTip window is calendar time, not a work block. Phase 2 starts on `develop` immediately after the release; the executor/verifier returns after 48h to re-count via the GlitchTip MCP and closes #496/#503/#485 with the numbers. Phase 1 is marked complete only after that re-count.
- **D-03:** Sourcemap symbolication is fixed BEFORE the release so residual errors have readable frames on day one: the GlitchTip host upload-dir permission (#497, `/code/uploads/file_blobs` Errno 13) and the `SENTRY_PROJECT` repo secret (must be the slug `helldiversbot`, not the display name) are manual steps the user performs; the plan gates the release on them, it does not automate them.

### Hydration audit (#496, STAB-01)
- **D-04:** Full sweep of `/` before release, not "ship the known fix and re-count": grep every render-time `Date`/locale/`localStorage`/`window` read in the dashboard tree, run `/` in a real browser under a non-UTC timezone (Playwright, Europe/Warsaw — the reporter profile), and pin each divergence with a hydration test following the existing `DefeatedCard.hydration.test.jsx` pattern. The 4 `args[]=HTML`-variant events get reviewed too, not just the text variant.
- **D-05:** Per STAB-01 (locked upstream): each divergence is identified per variant — never masked with a mounted-flag.

### OG image (#503, STAB-02)
- **D-06:** The dynamic card stays primary — it must regenerate to show current game state. The fallback is only for the crash path.
- **D-07:** The crash fallback is a designed static PNG committed to the repo (1200x630, logo/wordmark + tagline + brand tokens, rendered once at design time) — served as raw bytes, never through Satori→sharp, so the fallback itself cannot fail. Replaces the current generated `fallbackImage()` (which also goes through sharp and can fail the same way).
- **D-08:** A fallback response is never cached: `Cache-Control: no-store` / bypass ISR on the error path so the next request retries the real card. This kills the current stuck-fallback failure mode (`revalidate = 300` + STALE-forever). — **Reversibility:** reversible — cache semantics are route-local.
- **D-09:** Render telemetry: track how often the OG function actually (re)runs vs serves from cache, and each render outcome (`rendered` | `fallback`) — server-side Umami event per regeneration plus a GlitchTip event carrying the real satori/sharp error on every failed render. Passive only: no new alert rules; the STAB-06 re-count and normal GlitchTip triage catch regressions.
- **D-10:** Root-causing the sharp rejection: reproduce against the standalone Docker image locally (the only environment where it fires), time-boxed. If found in the box, fix it; if not, the fallback + no-cache + telemetry ship anyway and #503 stays open with the findings.
- **D-11:** Investigate BOTH chained bugs now: also audit `getCampaign()`'s failure modes (DB timeouts, empty-season edge) as part of this phase — it wrote the original fallback into cache and is the first link in the chain.
- **D-12:** Edge-case map-state render coverage (null slots, no active events, homeworld-only) lives in unit tests extending `src/__tests__/unit/app/opengraph-image.test.jsx`: feed each fixture through the actual route, assert a real PNG comes back (not the fallback).

### Notification toggle (#485, STAB-03)
- **D-13:** New explicit `error` state with short copy ("Notifications unavailable") and a visible Retry control that re-runs the init effect. Errors are NOT folded into `disabled` or `unsupported` (per CONCERNS.md's explicit call-out).
- **D-14:** 5-second timeout on `serviceWorker.ready` before declaring the error state.
- **D-15:** Scope: VAPID handling is in — `subscribeToPush()` surfaces an error instead of silently bailing when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is missing, and the key's presence in the release image is verified (one `docker run` | grep check). The intermittent `/sw.js` 520 investigation is OUT — findings noted on the issue, doesn't block the phase.
- **D-16:** Tests pin all three failure paths: hung `serviceWorker.ready` → error after 5s (fake timers); `getSubscription()` rejects → error; Retry re-runs init and can reach a healthy state. Plus the missing-VAPID error surfacing. Extends the existing 10-case `NotificationToggle.test.jsx`.

### Space Mono (#476, STAB-04)
- **D-17:** Keep Space Mono — load it for real via `next/font` (`Space_Mono`, weights 400/700, `variable` wiring like `Space_Grotesk`/`Inter` in `src/app/layout.jsx`), point `--font-mono` at the generated variable instead of the bare string. Decision made after reviewing a side-by-side visual A/B (artifact: https://claude.ai/code/artifact/0686a5de-638c-4739-95e5-6e63c6ed2308) with live width measurements.
- **D-18:** DevTools verification pass on every affected mono row per CLAUDE.md (card points/totals, EventCountdown, PaceIndicator, bar labels, NextWaveCard meta row, assault ETA, StatGrid values) — watch `.sector-card-meta` flex-wrap at 300px/260px card widths (the EventCard.css comment documents measured overflow there). Before/after width measurements recorded on issue #476 per STAB-04.

### getWarOutcome (#459, STAB-05)
- **D-19:** Not discussed — plainly scoped by the issue: null guard in the `.every` callbacks or an early `some((f) => !f)` bail, plus a fixture test with a null slot. The issue also flags `buildPlayerBeats`' untested zero-baseline guard as worth covering in the same pass.

### Claude's Discretion
- Exact copy/placement of the notification error state (within "short copy + visible retry").
- The static OG card's visual design (within brand tokens; user chose "designed static card").
- Umami event names for OG telemetry (follow `category-action`; `api` category fits server-side).
- How the hydration sweep is mechanically organized (grep list, Playwright setup), as long as D-04/D-05 hold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GitHub issues (source of truth for each bug)
- Issue #496 — hydration mismatch; the 2026-08-05 comment is essential: DefeatedCard/EventLogCard already fixed on develop, sourcemap post-mortem, NextWaveCard cleared
- Issue #503 — OG image; the 2026-08-07 comment reframes it: not a 500 but a frozen fallback, two chained bugs
- Issue #485 — notification toggle acceptance criteria
- Issue #476 — Space Mono evidence + measurement method
- Issue #459 — getWarOutcome null guard + related `buildPlayerBeats` gap
- Issue #497 — GlitchTip host upload-dir permission (external dependency for D-03)

### Planning docs
- `.planning/ROADMAP.md` § Phase 1 — goal, success criteria, STAB-01..07 mapping
- `.planning/REQUIREMENTS.md` § STAB — requirement wording (esp. "not masked with mounted-flags")
- `.planning/codebase/CONCERNS.md` — per-bug file locations, fragile areas (OG dependency chain, notification state machine), and the lease-model docs drift (Phase 2's problem, don't fix here)

### Code (key touchpoints found in scout)
- `src/app/opengraph-image.jsx` — existing `renderOrFallback()` guard, `revalidate = 300`, `fallbackImage()`
- `src/features/notifications/NotificationToggle.jsx` — state machine, line 80 `loading → null`
- `src/__tests__/unit/features/galaxy/DefeatedCard.hydration.test.jsx` — the hydration-test harness pattern to reuse (includes a control that fails if the harness can't observe a mismatch)
- `src/app/layout.jsx` + `src/app/layout.css` — font loading pattern to extend for Space_Mono
- `src/shared/utils/game/getWarOutcome.mjs` — the unguarded `.every` at the victory-signal checks
- `Dockerfile.app` — sharp binary tracing notes (do NOT strip `@img/sharp-*`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DefeatedCard.hydration.test.jsx`: proven harness for asserting SSR/client hydration mismatches — reuse for every divergence the sweep finds.
- `renderOrFallback()` + `tryCatch` in `opengraph-image.jsx`: the guard structure exists; this phase changes what the fallback IS and how it caches, not the guard shape.
- `NotificationToggle.test.jsx` (10 cases): mock scaffolding for Notification/serviceWorker APIs already exists — extend, don't rebuild.
- `sendUmamiEvent()` (`src/shared/utils/umami.mjs`) inside `after()`: the pattern for the OG render telemetry.
- `reportError()` (`src/shared/utils/observability.mjs`): the single GlitchTip reporting call, already tagged `route`/`stage`/`level`.

### Established Patterns
- `timeZone: 'UTC'` pinning (DefeatedCard, EventLogCard, CascadeLogCard, StatGrid, groupEventsByDay) — the canonical fix shape for date-format hydration divergences.
- Fonts: `next/font/google` import + `variable:` + CSS token indirection — Space_Mono follows Space_Grotesk/Inter exactly.
- `tryCatch` everywhere; no try/catch blocks (hard rule).
- Mirrored test tree (`src/__tests__/unit/` — Phase 3 moves it, so this phase adds tests at the CURRENT mirrored paths).
- Release mechanics: develop→main PR, tag on the merge commit, merge main back into develop; `--no-ff`; version bump + CHANGELOG move in each merge to develop.

### Integration Points
- GlitchTip MCP (in-session) for the STAB-06 re-count by deployment id (`dpl` tag).
- GitHub Actions release build uploads sourcemaps — depends on the `SENTRY_PROJECT` secret + GlitchTip host fix (manual, user-performed, gate not task).
- `deploymentId` in `next.config.mjs` derives from package.json version — the release version is the `dpl` value to filter on.

</code_context>

<specifics>
## Specific Ideas

- OG telemetry must answer "how often does this function actually (re)run vs serve the cached image" — the user asked for this explicitly, alongside rendered-vs-fallback outcome tracking.
- Space Mono decision was made against the visual A/B artifact (link in D-17); its measured width table is the before/after evidence to paste into #476.

</specifics>

<deferred>
## Deferred Ideas

- `/sw.js` intermittent 520 investigation (reverse proxy / CrowdSec territory) — noted on #485, not part of this phase.
- Lease-model documentation drift found in CONCERNS.md — already scoped to Phase 2.

</deferred>

---

*Phase: 1-Stability Fixes & Release*
*Context gathered: 2026-08-31*
