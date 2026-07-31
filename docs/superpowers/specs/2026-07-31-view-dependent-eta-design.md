# View-dependent ETAs + event pace verdicts — design

**Date:** 2026-07-31 · **Status:** approved (mockup reviewed by Andrei)
**Mockup:** claude.ai artifact `4db30b44` (dashboard-token-faithful, folded-pace-verdict revision)

## Problem

The dashboard shows one ETA — time until a faction's campaign completes and the
homeworld assault fires — regardless of context. In sector view the player is
looking at the *next sector*, not the campaign end; on active defend/attack
event cards the player wants "will we finish before the deadline", which today
must be inferred from a points-delta arrow (`▲ 8.1K`) plus a countdown.

## Decisions (made during brainstorm)

1. **Measure first.** New ETA ranges ship only with a measured track record.
   Sector-boundary crossings are backtested across all 160 seasons (thousands
   of crossings vs 760 attacks) before any sector range renders.
2. **Event cards fold the verdict into the pace arrow.** The existing
   `PaceIndicator` (`▲ 8.1K`) is *replaced* on event cards by a time-domain
   verdict: `▲ on track · done ~3h` (green) / `▼ behind · done ~5h` (red).
   One signal, one place. Median only — no range (event-progress history is
   S157+ only, too thin to calibrate one honestly).
3. **Sub-hour ETAs render as minutes** (`~40m`), fixing the existing `~0h`
   rounding edge in `AssaultEta`.

## Behavior

### Frontier card (per `regionsView`)

| View | ETA target | Display |
| --- | --- | --- |
| `sector` | next sector boundary: `ceil(points / (points_max/10)) × points_max/10` | `ETA ~40m (30m-55m)` |
| `campaign` | campaign completion (attack trigger) — unchanged | `ETA ~11h (9-16h)` |

- Sector ETA hides while a defend event is active (Super Earth defends freeze
  the campaign — `computeMapState` wipes attacker sectors during one).
- Attack ETA keeps its current gates (hidden during active attack, stalled,
  beyond 48h window).
- Sector ETA display window: proportional to its horizon; exact cutoff chosen
  by the backtest (start point: p50 < 8h shows, tune from measured data).

### Event cards (active defend / SE defend / homeworld assault)

- The `PaceIndicator` slot in the bar-label row becomes the verdict:
  - `▲ on track · done ~3h` (green, new `--color-success` token) when the
    completion ETA beats the deadline with slack.
  - `▼ behind · done ~5h` (red, existing danger token) when it doesn't.
- ETA = `remaining points / average rate since event start` — computable from
  the event row alone (`points`, `points_max`, `start_time`); no new API.
- Anti-flicker slack: verdict flips only when ETA vs time-remaining differ by
  more than a margin; the margin is picked from `h1_event_progress` history
  (S157+): the smallest margin at which the verdict at mid-event predicted the
  actual outcome without oscillating. Fallback if data is too thin: 10% of
  time remaining.
- Stalled event (rate ≤ 0, points < max): `▼ behind · stalled`.
- Meta row returns to `points / max · countdown` only.

## Analysis phase (ships first)

1. **`scripts/analysis/13-sector-eta.mjs`** — walk-forward backtest of
   time-to-next-sector-boundary on `h1_status`, all seasons, same
   leakage/honesty machinery as scripts 10/12 (`walkForward` with synthetic
   "crossing events", shared momentFilter, effN honesty, when-showing
   calibration). Fits per-band ratio quantiles for the sector horizon.
2. **Emitter** — script 11 extended to write a `sector` section
   `{bands, ratios, meta}` into the committed `attackModel.mjs` (one model
   file, one `isValidModel` extension; a missing `sector` section degrades
   sectorForecast to hidden, never breaks attackForecast). Refuse-to-emit
   guards: monotone finite ratios, replay recall/precision bars analogous to
   the attack model's.
3. **Event verdict margin measurement** — small script section reading
   `h1_event_progress` (S157+): replay mid-event verdicts vs outcomes, pick
   the anti-flicker margin. This tunes one constant, not a table.

UI ships only after (1)+(2) emit a table passing guards.

## Code shape

- `src/features/dashboard/attackForecast.mjs`: extract the shared core
  (rate from snapshots, dow adjust, staleness anchor, band→ratio application)
  into an internal `forecastToTarget(data, enemy, nowSeconds, target, model)`;
  public `attackForecast` keeps its exact signature/behavior; new
  `sectorForecast(data, enemy, nowSeconds, model)` computes the boundary
  target and applies sector gates + sector ratio table.
- New `src/features/dashboard/eventForecast.mjs`: pure
  `eventForecast(event, nowSeconds)` → `{ mode: 'verdict', etaHours, onTrack }
  | { mode: 'hidden', reason }`. No model dependency.
- `src/features/galaxy/EventCard.jsx`: `AssaultEta` generalizes to an `EtaLine`
  (median-first, minutes under 1h); event cards render the verdict in the
  `PaceIndicator` slot (PaceIndicator itself stays for any non-event use).
- `src/features/dashboard/DashboardClient.jsx`: frontier card picks
  `sectorForecast` vs `attackForecast` by `regionsView`; event cards get
  `eventForecast(activeEvent, now)`.
- `src/app/layout.css`: add `--color-success` to the `@theme` block.
- Umami: no new interactive elements (display-only), no new events needed.

## Testing

- Unit (mirrored paths): `sectorForecast` (boundary math, defend gating,
  band application), `eventForecast` (on-track/behind/stalled/expired/complete
  edges, slack hysteresis), `EventCard` (verdict rendering, minutes
  formatting, view-dependent ETA), regression: `attackForecast` unchanged.
- Analysis: script self-check blocks (no DB) as in scripts 10/12; script 10
  output regression after any shared-lib touch.
- Verify chain per CLAUDE.md + DevTools/SSR check on the live dashboard.

## Out of scope

- Calibrated *ranges* on event ETAs (data too thin; revisit with telemetry
  growth, cf. issue #481's trigger condition).
- Any change to `/docs/predict` pages (can follow once shipped).
- NextWaveCard / defend-wave prediction (separate model, #472/#481).

## Rollout

Feature worktree `feature/view-dependent-eta` (this branch). Two stages,
small commits: analysis + emitted model first, UI second. Merge to develop
with minor version bump per § Git Workflow.
