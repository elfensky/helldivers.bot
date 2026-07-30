# Next-wave card — design

**Date:** 2026-07-30
**Issue:** to be filed on implementation (feature, `frontend` + `enhancement`)
**Origin:** #472 attempt 3 (v0.72.0) — the defend train-start model missed the
pre-registered countdown gate (skill CI upper 0.674 vs ≤ 0.6) but passed
calibration and sharpness. The project owner chose to ship the honest
surface those two passing legs support: a live-updating **likelihood
window**, explicitly a band, never a countdown.

## What ships

One faction-neutral card on the dashboard: **"NEXT DEFEND WAVE — likely in
14–32h · 63% within 24h"**, with a band visualization, updating on the
existing 10-second live poll. Hidden while a wave is running.

Product decisions (made in-session by the owner):

| Decision              | Choice                                                                  |
| --------------------- | ----------------------------------------------------------------------- |
| Cards                 | ONE card, faction-neutral. The galaxy runs one wave slot (0 overlapping defends in 160 seasons, cross-faction included), and faction identity is unpredictable (P(same as prev) = 0.383 ≈ base rate) — per-faction cards would be sparser AND misleading. |
| Placement             | Regions section, above the faction cards (inside the existing Regions `ComponentErrorBoundary`). An event-log pseudo-entry was liked but deferred (YAGNI). |
| While a wave runs     | Card hidden entirely.                                                   |
| Confidence gating     | Band always shown (it is calibrated at every moment); `IMMINENT` badge when P(wave ≤ 24h) ≥ 0.51. |
| Surety display        | Live percentage on the card: "NN% within 24h"; 48h figure in the hover. |
| Time format           | Relative headline ("in 14–32h"); hover shows absolute local time AND war-day (via existing `warClock`). |

## Architecture

Three pieces, no API or DB change — everything the card needs is already in
the `/api/h1/live` payload (full season `events` + per-faction `status`).

### 1. Model artifact — `scripts/analysis/08-emit-wave-model.mjs` → committed JSON

Fits the attempt-3 STATE-KM estimator (states × kNN-on-elapsed × Kaplan-
Meier quantiles; K=200, MIN_CELL=30 pooled fallback — identical constants
to `07-train-state-model.mjs`) on the **full** history and emits a lookup
table to `src/features/dashboard/waveModel.json`:

```
{ meta: { generatedFromSeasons, eventCount, k, binHours },
  states: { NORMAL|SC9|SC10|ATTACK: [ { p25, p50, p75, p24, p48 }, ... ] } }
```

- One row per 1h elapsed bin, 0–167h; lookups clamp beyond the last bin.
- `p24`/`p48` = P(wave ≤ 24h / 48h) from the KM CDF of the same neighbourhood.
- ~15 KB. Deterministic. Retraining = rerun script, commit the diff.
- Walk-forward evaluation stays 07's job; 08 fits on everything (standard
  fit-on-all-after-honest-eval practice, noted in the script header).

Self-checks (script refuses to emit on failure):

- quantiles monotone (p25 ≤ p50 ≤ p75) and finite in every bin;
- `p24`/`p48` in [0,1], `p48 ≥ p24`;
- **reliability check on the displayed probabilities:** predicted
  within-24h probability, bucketed into deciles across all historical lull
  moments, must match observed within-24h frequency to within ±0.10 per
  decile and ±0.05 overall (in-sample reliability; the quartile calibration
  underneath was already walk-forward-verified in 07).

Rejected alternatives: computing in `/api/h1/live` (hot-path cost, needs
train labelling server-side, API change, no benefit); shipping raw gaps and
fitting client-side (bundle bloat).

### 2. Pure util — `src/features/dashboard/waveForecast.mjs`

`waveForecast(data, nowSeconds)` → one of:

- `{ mode: 'window', p25, p50, p75, p24, p48, state, imminent, runningLong, lastTrainStart }`
- `{ mode: 'hidden', reason: 'wave-active' | 'no-train-yet' | 'no-data' }`

Derivations (all from the live payload):

- **Train starts:** from season defends via the same rule as the analysis —
  a defend is a train start iff no same-faction defend ended within 600s
  before its start (per-faction chain, ported as a ~10-line pure function).
- **State precedence** (same as 07): `ATTACK` (any attack event active at
  now) > `SC9` > `SC10` > `NORMAL`, where SC = max over factions of
  `trunc(points / (points_max/10))` from the per-faction status rows.
- **Elapsed** = now − last train start; bin = clamp(floor(elapsed/1h), 0, 167).
- Hidden when: any defend event is active; no train start yet this season;
  or events/status/table missing or malformed (defensive `mode: 'hidden'`,
  never a throw — the dashboard degrades to exactly today's UI).

Note on freshness: live state comes from 15-minute buckets (S157+), sharper
than the ~daily-smeared history the model was fit on — errs conservative.

### 3. Component — `src/features/dashboard/NextWaveCard.jsx`

- House card style: `surface-1`, ghost border, 6px **primary** right accent
  (faction-neutral gold — deliberately not a faction color).
- Content: `NEXT DEFEND WAVE` label · headline "likely in **14–32h**" ·
  surety "**63% within 24h**" · band bar (axis from now to
  `max(48h, p75 rounded up to the next 12h)`, p25–p75 filled) ·
  badges: `IMMINENT` (p24 ≥ 0.51), `RUNNING LONG` + one-line explainer
  ("a faction is 1 sector from homeworld assault — waves pause") when
  state is `SC9`.
- Hover/tooltip on the range: absolute local times, war-day (existing
  `warClock.mjs`), 48h surety, and the static honesty line "typical miss
  ±8h".
- One interactive element: a small "how?" link to `/docs/predict` with
  `data-umami-event="dashboard-wave-window-docs"`.
- Rendered by `DashboardClient` at the top of the Regions section, above
  the faction-card `<ul>`; recomputes on the existing poll — no new timers,
  no new state management.

## Testing

- `src/__tests__/unit/features/dashboard/waveForecast.test.mjs` — train-
  start derivation (chain rule, cross-faction independence), state
  precedence, elapsed binning/clamping, every hidden reason, malformed-
  table defense.
- `src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx` — renders
  window mode, hides in hidden mode, badge logic (IMMINENT threshold,
  RUNNING LONG on SC9), umami attribute present.
- `08-emit-wave-model.mjs` self-checks per § Architecture; no vitest for
  scripts (mirror-tree rule).

## Honesty constraints (carried from #472)

The card never shows a single ETA or a ticking countdown. Every number it
displays is either a calibrated band (verified walk-forward at the
quartiles, ±0.05), a reliability-checked probability, or the static
typical-miss figure. Copy always says "likely" — never "will".
