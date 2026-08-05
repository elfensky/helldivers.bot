# Attack forecast — design

**Date:** 2026-07-28 (rewritten 2026-07-30)
**Status:** trigger established; rate model designed, not built
**Related:** [`2026-07-27-next-event-timing-forecast-design.md`](2026-07-27-next-event-timing-forecast-design.md), `/docs/predict`

## The finding that rewrote this spec

**Attacks are deterministic.** One fires within minutes of a faction's campaign reaching
full points — `points == points_max`, the exact integer. Established by
`scripts/analysis/09-attack-trigger.mjs`, three falsifiable tests:

| Age of campaign reading | Attacks | Median liberation at attack start |
| --- | --- | --- |
| <15 min | 13 | **100.00%** |
| <1h | 23 | 99.69% |
| <6h | 170 | 98.87% |
| <12h | 182 | 97.37% |
| <24h | 537 | 94.28% |

Twelve of the thirteen freshest readings sit within 0.1% of full; seven are at
`points_max` exactly. Season 20's Bug campaign was **46 points short of 763,240 sixty-two
seconds before its attack began**. Trigger lag on the 15-minute seasons: 1–14 minutes,
median 3.0 (n = 7).

The earlier "trigger band" (p25 0.932 / p50 0.961 / p75 0.983) was `h1_status`'s ~daily
sampling smearing a hard threshold downward. `/docs/predict` is corrected in the same
branch as this spec.

### What this deleted from the previous design

Gone, and not because they were badly designed — because the question they answered is
now answered exactly: the liberation-binned lookup model, the `L*` threshold estimate,
the p25/p50/p75 trigger band, the ratio calibration, the season-phase control model, the
within-season shuffle placebo, the pooled `min(ETA_i)` construction, and the 18-row run
matrix. There is no threshold to learn and no "is the signal real" question to answer.

## The remaining problem

```
eta = (points_max − points) / rate
```

Every term but `rate` is a known constant, readable in real time. **The entire forecasting
problem and the entire error budget now live in estimating pace.**

### What makes it hard

Two facts, both measured:

- **Pace is not steady.** On the current season's 15-minute data, a faction's rate over
  the last hour can differ from its 3-day average by an order of magnitude (Cyborgs:
  86.4 %/day over 1h vs 5.4 %/day over 3d). Roughly one 3-day window in five shows net
  *negative* progress.
- **Short windows are unbackestable.** Share of moments with `rate <= 0`:

  | window | 15-min data (S157+) | daily data (S<157) |
  | --- | --- | --- |
  | 1h | **16.2%** | uncomputable — both endpoints land in one bucket |
  | 6h | 17.7% | uncomputable |
  | 24h | 22.7% | 38.5% |
  | 3d | 36.5% | 39.4% |

  A 1-hour window is usable 84% of the time and is the better live model — but it cannot
  be validated, because 156 of 160 seasons have daily buckets and S157–160 contain
  **8 attacks total**.

### The resolution

**Ship the configuration history can validate.** Use a **24-hour rate window**: computable
on all 160 seasons (925 attacks to test against) *and* computable live. Live it is measured
from fresh 15-minute endpoints instead of two stale daily snapshots — the same feature,
less noise. That makes the backtested accuracy an honest floor rather than a hopeful
extrapolation, because live conditions strictly improve the input rather than changing it.

Shorter-window rates may be **displayed** as observed context (they are real and live), but
must not carry a number claiming backtested accuracy.

## Model

`scripts/analysis/10-attack-eta.mjs`, following the `02-baseline.mjs` idiom: pure-function
self-checks at the top (no DB), `loadDataset()`, a CONFIGS loop through `walkForward`, then
the gate print.

**Predictor.** At moment `t` for faction `f`:

```
remaining = points_max[f] − points(f, t)
rate      = (points(f, t) − points(f, t − 24h)) / 24h
eta       = remaining / rate
```

Quantiles come from the empirical distribution of `true_wait / eta` on training seasons,
learned **per remaining-fraction band** (not pooled — the ratio is heavy-tailed and
mechanically correlated with `eta` as `remaining → 0`).

**Degenerate cases.** `rate <= 0`, or `eta` beyond the horizon: emit no forecast. Do not
substitute a fallback model — a blended predictor makes "does this work" unanswerable.
The script reports the no-forecast rate per config; it is expected near 23%.

**Configs.** 3 factions × {filtered, unrestricted}, where filtered excludes moments with an
attack already active against that faction. Six rows. No pooled target — per-faction is the
deliverable, and `min` of per-faction quantiles is not a valid pooled quantile.

## Success bar — written before running anything

The published three-leg gate was written for a countdown. The product this feeds is a
**heads-up** ("assault coming, pay attention"), so it is scored as an alert. Both bars are
reported; the alert bar governs shipping.

**Alert bar (governs):**

1. The line fires before **≥70%** of attacks.
2. When it fires, an attack follows within **2× the upper bound ≥80%** of the time.

**Gate (reported, not governing):** calibration ±0.05 at each quartile, skill-ratio 95% CI,
sharpness vs. the config's own marginal.

**Sanity check (binding):** the windowed-rate model must beat a constant-rate baseline
(each season's own median rate to date). If it does not, the rate window is doing no work.

This bar is recorded here *before* the model exists. Relaxing it after seeing results is
the failure mode this project has repeatedly refused; if the numbers argue for a different
bar, that argument gets made in writing against this text.

## Harness changes — `scripts/analysis/lib/backtest.mjs`

| Change | Kind |
| --- | --- |
| `forwardRecurrenceMedian` respects `momentFilter` | **Behavioural — changes published defend numbers** |
| Report horizon-clamp rate | Additive |
| Report reliability table (calibration by predicted-p50 decile) | Additive |

`baselineConstant` (`backtest.mjs:146`) is computed by walking the *unfiltered* season span
while `momentFilter` applies only inside the eval loop (`backtest.mjs:166`), so for any
filtered config the skill ratio partly measures the filter. Fixing it requires re-running
`02-baseline.mjs`, `04-train-baseline.mjs` and `07-train-state-model.mjs`, and updating
`/docs/predict`'s defend numbers.

The clamp rate matters because `backtest.mjs:180-182` clamps all quantiles to
`horizonHours`, and `sharpnessHours` is `median(q75 − q25)` — a record whose quantiles all
clamp contributes width 0, so majority clamping can make the sharpness leg report PASS on
an artifact. **A clamp rate above 10% marks that config's sharpness UNREADABLE**, printed
as such rather than PASS or FAIL.

## UI — one line in the existing faction card

Not a new component. A fourth conditional in `EventCard`'s existing meta row, which already
renders `points · countdown · pace`:

```
ASSAULT ETA 4-16H
```

- **No glyph.** A ⚔ was tried and dropped: U+2694 is absent from Space Mono, so it fell
  back to another family at an 8.43px advance against the font's uniform 7px, breaking the
  monospace grid and rendering as a faint × at 14px. The label is self-describing.
- **Range, not a countdown.** p25–p75. The median goes in `title`.
- **Shown only when p50 is under a display threshold**, default 24h. Purely a UX choice —
  it does not restrict the data feeding the model, which uses all 160 seasons. Make it a
  named constant so it can be widened while observing it live.
- **`flex-wrap: wrap` on `.sector-card-meta`.** Measured: the span needs
  `white-space: nowrap`, which makes it incompressible, and with a `PaceIndicator` also in
  the row it overflows by 25px at a 300px card and 65px at 260px. The wrap takes overflow
  to 0 at every width.
- **No empty state needed.** A stalled front produces no sub-threshold estimate, so the
  line simply does not render.

Live-only. On an archived season the attack either happened or did not.

## Documentation

Already applied in this branch:

- `/docs/predict` § Attacks rewritten around the deterministic trigger, including the
  staleness gradient, the thirteen fresh readings, and the trigger-lag measurement.
- The four corrected claims called out explicitly rather than silently replaced.
- The defend side's Attempt-3 mechanism corrected: `SC9` is the window in which an assault
  is *pending*, not the trigger itself. This strengthens the finding — the SC9-vs-SC10
  reversal now has a mechanism (at SC10 the assault has already fired).
- The "coarse resolution can only weaken a signal" caveat corrected: it cannot manufacture
  a signal from noise, but it can convert a hard rule into a publishable distribution.

Still to do once `10-attack-eta.mjs` runs: the forecast-accuracy numbers and the defend
re-run after the baseline fix.

## Verification

`npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` — all four.
Plus `node scripts/analysis/lib/dataset.mjs`, `node scripts/analysis/lib/backtest.mjs`,
and `node --env-file=.env.development scripts/analysis/09-attack-trigger.mjs`.

## Out of scope

- Shipping the UI line before the alert bar is met.
- Any short-window (<24h) rate model as a *predictor*.
- Re-running `05-defend-covariates.mjs` — unaffected.

## Provenance

The first draft of this spec built a liberation-threshold model with a velocity ETA and was
revised after an adversarial multi-model review (Codex, Antigravity, Sonnet 4.6, Opus 5).
It was then discarded entirely when the user pointed out that attacks trigger at full
points, which measurement confirmed. The published "trigger band" the whole design was
built around was an artifact of the project's own sampling rate. Debate transcript:
`~/.claude-octopus/debates/no-session/001-attack-eta-design/`.
