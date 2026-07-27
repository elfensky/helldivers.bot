# Next-event timing forecast — findings

**Issue:** [#472](https://github.com/elfensky/helldivers.bot/issues/472)
**Date:** 2026-07-27
**Design doc:** [`docs/superpowers/specs/2026-07-27-next-event-timing-forecast-design.md`](../specs/2026-07-27-next-event-timing-forecast-design.md)
**Plan:** [`docs/superpowers/plans/2026-07-27-next-event-timing-forecast.md`](../plans/2026-07-27-next-event-timing-forecast.md)
**Scripts:** [`scripts/README.md`](../../../scripts/README.md#analysis) (`## analysis/`)

## Question

Is the start time of the next HD1 event predictable well enough to be worth
shipping — a countdown, an ETA, anything sold to a user as "the next event
happens around X"? The deliverable was the answer, not a feature: if the
analysis said "not usefully predictable," the plan was to record the numbers
and ship nothing.

## Headline

The question had two halves, and they had opposite answers.

- **Attacks are mechanically triggered.** There is nothing to forecast —
  the "prediction" is a deterministic readout of campaign progress that
  already exists.
- **Defends have no deterministic trigger**, and the best predictive model
  built for them does not clear the pre-registered decision gate. The
  verdict is genuinely inconclusive, not dead: both configurations beat a
  constant baseline, just not by enough, and adding features made things
  worse rather than better.

Recommendation: **do not ship a countdown or an ETA.** See § Recommendation.

## Attacks: a campaign-progress readout, not a forecast

Phase 1 (`01-trigger-hunt.mjs`) tested whether attack events fire on a
deterministic campaign-state rule, using phase-matched controls (same
fractional point through a season, drawn from other seasons) and a
permutation test corrected for testing five variables (Bonferroni alpha
0.01).

- All 925 attack events target region 11, the enemy homeworld. Every one.
- 83.6% fire at exactly 9 of 10 sectors captured; 89.3% at >= 9.
- Liberation at attack start: p25 0.932, p50 0.961, p75 0.983 — an IQR of
  0.051, versus a phase-matched control IQR of 0.378. A 7.4x tighter spread.
- Permutation test p=0.0005 for both `liberation` and `sectorsCaptured`,
  comfortably under the Bonferroni-corrected alpha of 0.01.
- `daysIntoSeason` showed **no** concentration (IQR ratio 0.912) — this is
  the control that matters. If attacks merely clustered at a particular
  point in the season's calendar, that would look like concentration for any
  variable correlated with season phase, including a spurious one. Because
  `daysIntoSeason` itself stays flat, the liberation/sector concentration is
  attributable to campaign state, not to a season-phase artifact.

So "when is the next attack" reduces to "when will players capture 9
sectors" — a fact the game already displays. It is a campaign-progress
readout, not a forecasting problem, and there is nothing further to model
here.

## Defends: no deterministic trigger, and campaign state doesn't drive them

The same Phase 1 test run against defend events found the opposite result:

- `liberation` IQR ratio 1.084, `sectorsCaptured` 1.000, `playerPercentile`
  1.180, `daysIntoSeason` 1.534 — every campaign-state variable lands at "no
  rule," all at p=1.0000.
- The only variable carrying signal is time since the previous event
  (p=0.0005, IQR ratio 0.352 — statistically significant, but below the 0.25
  effect-size bar the trigger-hunt rule requires, so it does not count as a
  deterministic threshold either).

Defend structure, measured directly rather than through the trigger-hunt
machinery: P(chain within 10 minutes of a defend ending) = 0.631 (n=4928).
Given no chain, lull length runs p25 27.8h / p50 36.8h / p75 46.4h
(n=1816).

## How well can defend timing be predicted?

### Phase 2 — features-free baseline

`02-baseline.mjs` fits an empirical residual-life predictor with no
features at all: given `e` hours elapsed since the last defend, the
predicted wait distribution is `(gap - e)` over training gaps longer than
`e`. This is the yardstick every later model has to beat.

| Configuration                          | Skill ratio | 95% CI         | Effective N |
| -------------------------------------- | ----------: | -------------- | ----------: |
| `defend, all enemies`                  |       0.628 | [0.605, 0.653] |        3925 |
| `defend, LULL ONLY (no defend active)` |       0.770 | [0.746, 0.789] |        1472 |

63% of defends chain back-to-back (start within 10 minutes of the previous
one ending), so the pooled `defend, all enemies` row is flattered: a
predictor that always guesses "wait ~= 0" scores well on it just by
exploiting that chaining, not by forecasting anything. The decision-relevant
question is when a *lull* ends, which is what the `LULL ONLY` row isolates
by restricting to moments with no defend active — read that row as the real
answer to "how well can defend timing be predicted," not the pooled one.

Skill ratio is the median `|true wait − predicted p50|` divided by the same
quantity for a constant baseline (the median forward-recurrence wait, not
the median gap — see § Method caveats). Below 1.0 means the model beats a
single constant number; above 1.0 means it's worse.

The project's decision gate — written down before any of these numbers
existed — requires all three: calibration within ±0.05 of nominal at each
quartile (p25/p50/p75), skill ratio <= 0.6, and the predicted p25–p75 band
narrower than the unconditional gap IQR. That's what was pre-registered
(design doc, § Decision gate); a later design review strengthened the skill
requirement to the skill-ratio CI's **upper bound** <= 0.6, not just the
point estimate — a stricter bar than originally written down, though the
outcome doesn't hinge on the difference: both configurations miss even the
looser, pre-registered point-estimate form too (0.628 and 0.770, both above
0.6). **Neither configuration clears it.**

Both skill ratios sit below the 0.8 "not usefully predictable" line, but the
lull config is close, not comfortably clear of it — 0.770 with a CI upper
bound of 0.789, just 0.011 from that line — so the verdict is
**INCONCLUSIVE**, not dead. That is not the same as "underpowered," though:
both configurations' CIs are tight and lie entirely above the 0.6 bar
(`[0.605, 0.653]` and `[0.746, 0.789]`), which is a clean effect-size
failure. `02-baseline.mjs:203-205` has a separate verdict string for the
genuinely underpowered case — point estimate passes, CI does not
(`'PROMISING BUT UNDERPOWERED'`) — and neither configuration triggered it.

Calibration fails on both defend configurations, but the two failures are
narrower than "fails" suggests. For `LULL ONLY`, only p25 misses tolerance
(0.194 against a nominal 0.25, off by 0.056); p50 (0.467) and p75 (0.755)
are both inside ±0.05. For the pooled `all enemies` config, p25 (0.193) and
p50 (0.441) both miss; p75 (0.737) passes.

Restricted to *uncensored* moments only — dropping the moments where the
walk-forward clock ran out before the next event started, so the true wait
was never observed — all six quantiles pass: all-enemies comes out to
0.209/0.469/0.757 and lull-only to 0.207/0.491/0.776, each within ±0.05 of
its nominal target. That isolates the driver: censored moments are scored
as definitionally non-hits, which pulls the pooled rate down by
construction. That is the harness's deliberate, correct treatment, not a
bug to explain away — `backtest.mjs:70-76` documents why right-censored
moments must be scored rather than dropped, `backtest.mjs:208-230`
(`calibrationFor`) implements it, and the harness's own self-check fails
loudly (`'censored moments were not scored — the drop-bias is back'`) if a
future change ever reintroduces the drop-bias that scoring exists to
prevent. So: the pooled calibration FAIL is driven by censored moments
being counted as misses by design, not by a defect in the predictor.

Two other properties of the predictor are real and worth recording, but
neither is needed to explain the gate result above — they describe how the
predictor behaves, not why it failed calibration here:

- **Non-stationarity.** Per-season p50 hit rate swings from 0.12 to 1.00
  across the roughly 160-season history, with a trend rather than noise
  around a constant.
- **Elapsed-dependent bias.** Hit rate rises monotonically with elapsed
  time since the last defend — the predictor is systematically
  miscalibrated as a function of how long the lull has already run.

### Phase 3 — features made it worse, verified

`03-hazard.mjs` adds three features to an hourly discrete-time logistic
hazard model, each chosen because it had prior measured support: cyclic
hour-of-day (defend starts show chi-squared 128.1 on df=23, trough
12:00–15:00 UTC, peak 17:00–01:00), a weekend indicator (chi-squared 21.7 on
df=6, critical value 12.6), and capped elapsed hours since the last defend.

| Configuration         | Variant                 | Skill ratio | 95% CI         |
| --------------------- | ----------------------- | ----------: | -------------- |
| `defend, LULL ONLY`   | all-history             |       1.307 | [1.286, 1.327] |
| `defend, LULL ONLY`   | 30-season recent window |       1.464 | [1.427, 1.497] |
| `defend, all enemies` | all-history             |       1.057 | [1.040, 1.075] |
| `defend, all enemies` | 30-season recent window |       1.176 | [1.151, 1.206] |

All four are above 1.0 — worse than a single constant number — and
recency-weighting (the 30-season window, meant to address the non-stationarity
finding above) made things _worse_ on both configurations, with CIs that
don't overlap the all-history variant.

A reviewer cleared all five artifact hypotheses that could explain a
regression this clean: no stray day-to-hour unit conversion, features
advance correctly through the hazard model's rollforward simulation,
half-open `(t, t+HOUR]` labeling verified, identical train/predict feature
units, and convergence confirmed independently — by re-implementing the
gradient-descent fitter from scratch and tracing the weight trajectory,
which plateaus by iteration ~400 and never collapses to zero.

**Interpretation:** the non-parametric residual-life estimator (Phase 2)
already extracts the elapsed-time signal near-optimally. A parametric hazard
model carrying three weak, independently-measured features dilutes that
signal rather than sharpening it — the extra flexibility costs more in
variance than it buys in fit.

## Recommendation

**Do not ship a countdown or an ETA.** Neither event type supports one:
attacks don't need a forecast (the answer is already a deterministic
campaign-progress fact), and defends don't have a model that clears the
gate.

If a product surface ships anyway, the honest options are:

- **Attack side:** a progress readout — "N of 10 sectors captured, homeworld
  assault unlocks at 9" — which is deterministic and already derivable from
  data the game exposes today. Not a prediction; a fact.
- **Defend side:** a descriptive band, not a prediction — "defends typically
  chain; when they don't, the next one is usually 28–46h out." This states
  the measured P(chain) = 0.631 and lull IQR directly, with no model and no
  implied precision beyond what the data supports.

## Method caveats

Recorded honestly, because they qualify how strong these conclusions are —
none of them overturn the headline, but they bound its precision.

- **`h1_status` staleness.** For 156 of 160 seasons, `h1_status` runs at
  roughly 1 bucket/day, so campaign state measured at an event start can be
  up to 24 hours stale relative to the actual trigger instant. A real
  threshold rule would still show up as concentration under this test, just
  smeared wider than the true rule — meaning a _negative_ trigger-hunt
  result (as found for defends) cannot cleanly rule a threshold out. The
  _positive_ result for attacks is unaffected by this caveat: staleness can
  only weaken an observed concentration, and the attack signal is strong
  enough (IQR ratio 0.051 vs 0.378) to survive it.
- **Concentration measurement.** Phase 1 concentration is measured as IQR
  and p05–p95 span ratios against phase-matched controls, plus a permutation
  test for significance. This replaced an under-specified "tightest 10%
  band" criterion from the original design, which had no well-defined null
  distribution to test against.
- **Effective N vs raw moment count.** The walk-forward backtest steps a
  clock in 3-hour increments, which produces many autocorrelated
  near-duplicate moments within a single inter-arrival interval — evaluating
  those as independent observations would overstate precision. Every skill
  ratio above is read against a season-level block-bootstrap confidence
  interval (which respects that autocorrelation by resampling whole seasons,
  not individual moments) rather than against the point estimate alone; the
  effective N reported per configuration counts distinct target events, not
  clock moments.
