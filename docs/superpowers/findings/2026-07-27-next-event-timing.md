# Next-event timing forecast — findings

**Issue:** [#472](https://github.com/elfensky/helldivers.bot/issues/472)
**Date:** 2026-07-27 (defend verdict corrected 2026-07-28 — see § Train
starts; third attempt added 2026-07-28 — see § Attempt 3, from the handoff
in
[`docs/superpowers/specs/2026-07-28-defend-prediction-handoff.md`](../specs/2026-07-28-defend-prediction-handoff.md))
**Design doc:** [`docs/superpowers/specs/2026-07-27-next-event-timing-forecast-design.md`](../specs/2026-07-27-next-event-timing-forecast-design.md)
**Plan:** [`docs/superpowers/plans/2026-07-27-next-event-timing-forecast.md`](../plans/2026-07-27-next-event-timing-forecast.md), [`docs/superpowers/plans/2026-07-28-defend-train-starts.md`](../plans/2026-07-28-defend-train-starts.md)
**Scripts:** [`scripts/README.md`](../../../scripts/README.md#analysis) (`## analysis/`)

> **Correction notice (2026-07-28):** the original defend predictor (Phase
> 2/3, below) was trained and evaluated against a mis-specified target: all
> 4,928 defend-to-defend gaps, a distribution dominated by ~2.5h mechanical
> chain gaps from a game mechanic (a defend train continues iff the previous
> defend was FAILED — 96.9% vs 0.1%, see § Train starts). The corrected
> target is train-start-to-train-start gaps only (n=1,816). Every defend
> skill/calibration number below this notice through § How well can defend
> timing be predicted? was measured against the OLD, mis-specified target and
> is **superseded** by § Train starts, which retrains and re-evaluates on the
> correct series. The numbers are kept in place, not deleted, because they
> remain a useful comparator (see the "versus v0.69.0" subsection below) and
> because a false "we found a rule" retraction should be as visible as the
> original claim — but do not read them as the current defend verdict.

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
  verdict is genuinely inconclusive, not dead: the corrected-target
  configuration beats a constant baseline, just not by enough.
  **(Corrected 2026-07-28 — see § Train starts. A third attempt the same
  day — § Attempt 3 — found real, observable campaign-state structure (the
  homeworld-assault window) and improved skill to 0.648 [0.622, 0.674]
  with calibration and sharpness both passing, but the skill CI upper
  bound still misses the pre-registered 0.6 ship bar. The verdict —
  INCONCLUSIVE, do not ship — is unchanged through all three attempts.)**

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

> **Note (2026-07-28):** "chain within 10 minutes" here is the same
> phenomenon later identified precisely as a game mechanic, not a
> statistical tendency — see § Train starts. This pooled trigger-hunt result
> mixes the 61.2% of defends that are mechanical train follow-ups in with the
> 1,976 real train starts; if a trigger existed only for train starts, it
> could have been masked by that dilution. It was rerun restricted to train
> starts only and the "no rule" conclusion held (see § Train starts), so this
> section's trigger-hunt verdict stands. The P(chain) figure above is
> superseded by the direct per-defend mechanic measurement in § Train
> starts (96.9% vs 0.1%, conditioned on the previous defend's outcome
> rather than inferred from a 10-minute threshold) — but the lull figures
> just above are NOT superseded: they are computed over the same 1,816
> gaps as § Train starts' regularity table and are bit-identical to that
> section's lull figures, i.e. independent corroboration rather than
> something the correction replaces.

## How well can defend timing be predicted?

> **SUPERSEDED (2026-07-28):** every skill ratio, calibration figure, and
> gate verdict below this point through the end of § Phase 3 was measured
> against a mis-specified target (see the correction notice at the top of
> this document). The corrected numbers are in § Train starts. This section
> is kept as the historical record of that first pass, not as the current
> defend verdict.

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
0.209/0.469/0.757 and lull-only to 0.206/0.491/0.777, each within ±0.05 of
its nominal target. These are printed by `02-baseline.mjs` as the
"uncensored-only calibration (diagnostic, NOT the gate)" line under each
config, computed by `calibrationUncensoredFor` in
`scripts/analysis/lib/backtest.mjs` — reproducible by re-running the script,
not copied from a one-off session. That isolates the driver: censored moments are
scored
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

## Train starts: correcting the mis-specified target

**Follow-up plan:** [`docs/superpowers/plans/2026-07-28-defend-train-starts.md`](../plans/2026-07-28-defend-train-starts.md).
**Scripts:** `01-trigger-hunt.mjs` (extended, third run over train starts),
`04-train-baseline.mjs` (new).

### The mechanic

A defend train continues iff the previous defend in it was **FAILED** — a
game mechanic, not a statistical tendency:

| Previous defend outcome | Chained within 10 min?  |
| ------------------------ | ----------------------- |
| FAILED                    | 3110 / 3208 = **96.9%** |
| SUCCEEDED                 | 2 / 1720 = **0.1%**     |

So 61.2% of the 5,088 defend events (n=3,112) are mechanical
follow-ups whose timing is dictated by the game's own continuation rule, not
by anything forecastable, and only the **1,976 train starts** are
forecasting targets. Every skill/calibration number in the superseded
section above was computed on the pooled 4,928-gap series (a bimodal mix of
~2.5h mechanical chain gaps and real inter-train waits), used to predict
~44h waits — the mis-specified target this correction fixes.

> **Note (2026-07-28):** the 96.9% / 0.1% continuation rates and the 61.2%
> mechanical-follow-up share above were computed directly against the
> database for this write-up and are not derived or printed by any
> committed script — `lib/dataset.mjs`'s train-labelling self-check
> (`scripts/README.md`) only asserts the post-success side is below 0.05,
> not either headline figure. Both figures are correct, but flagged here
> under the same reproducibility standard applied elsewhere in this
> project.

### Regularity

| Series               | gaps | p25   | p50   | p75   | CV       |
| --------------------- | ---: | ----- | ----- | ----- | -------- |
| all defends            | 4928 | 2.5h  | 2.5h  | 32.9h | 1.32     |
| train starts (start-to-start) | 1816 | 33.6h | 44.1h | 56.0h | **0.45** |

Train starts are a far more regular series than the pooled one — the CV drop
from 1.32 to 0.45 is exactly what the bimodal-mixing hypothesis predicts.

**Start-to-start is not the lull.** The row above measures gaps between
consecutive train starts (this train's start minus the previous train's
start), which includes however long the previous train itself ran. The
*lull* — end of the previous train to this train's start, the quantity any
"once you hold, the next wave is out in..." recommendation actually needs —
is a different number, over the same 1,816 gaps:

| Quantity                                            | gaps | p25   | p50   | p75   |
| ----------------------------------------------------- | ---: | ----- | ----- | ----- |
| Lull (end of previous train -> this train's start)      | 1816 | 27.8h | 36.8h | 46.4h |
| Start-to-start (this start -> previous start)          | 1816 | 33.6h | 44.1h | 56.0h |
| Inflation (start-to-start minus lull)                  | 1816 | +5.8h | +7.3h | +9.6h |

The lull figures here are the same ones reported earlier under § Defends
("given no chain, lull length" — p25 27.8h / p50 36.8h / p75 46.4h, n=1816):
that pooled-series measurement and this train-start-only one are the same
set, same n, bit-identical values — see § Recommendation for why that
matters. Use the lull for "once you hold" language; the start-to-start
figure is fine for a "~44h cycle" framing, a different and still-correct
claim.

### Trigger hunt on train starts: still no trigger

`01-trigger-hunt.mjs` was extended with a third run over
`ds.events.filter(e => e.type === 'defend' && e.isTrainStart)`, printed
alongside a pooled-vs-train-starts IQR-ratio comparison so the dilution
effect (or its absence) is visible either way. Result: **the dilution
hypothesis is rejected** — restricting to train starts did not surface a
trigger the pooled run had masked.

| Variable                 | Pooled defend IQR ratio | Train-starts IQR ratio |
| -------------------------- | -----------------------: | ------------------------: |
| `liberation`                 |                     1.084 |                      1.057 |
| `sectorsCaptured`            |                     1.000 |                      1.000 |
| `daysIntoSeason`             |                     1.534 |                      1.403 |
| `playerPercentile`           |                     1.180 |                      1.175 |
| `hoursSincePrevEventEnd`     |                     0.352 |                      0.928 |

`hoursSincePrevEventEnd` moves the most (0.352 -> 0.928), but that move is
**partly definitional, not purely dilution**: the "previous event" lookup is
scoped to whichever event array was passed in, so the pooled column means
"hours since the previous defend of any kind ended," while the train-starts
column means "hours since the previous TRAIN's first defend ended" (the
nearest preceding train start — mechanical follow-ups are excluded from that
array entirely, so they can't be "the previous event"). These are not the
same underlying quantity, so the shift toward "no rule" is not solely
evidence against a masked trigger — `01-trigger-hunt.mjs`'s dilution-check
table now prints this caveat directly beneath the numbers. All four
campaign-state variables (`liberation`, `sectorsCaptured`, `daysIntoSeason`,
`playerPercentile`) land at "no rule" on both columns regardless, which is
the load-bearing comparison and is unaffected by the definitional caveat.

### Corrected baseline

`04-train-baseline.mjs` retrains AND evaluates on train-start-to-train-start
gaps (method identical to `02-baseline.mjs` — empirical residual life
through `walkForward` — only the event set changes), under the
`NO DEFEND ACTIVE` moment filter (a train cannot start while one is already
running):

| Configuration                              | Skill ratio | 95% CI         | Effective N |
| -------------------------------------------- | ----------: | -------------- | ----------: |
| train starts, `NO DEFEND ACTIVE` (corrected) |       0.753 | [0.732, 0.773] |        1461 |

- Median absolute error **9.1h** vs a constant baseline's **12.1h**.
- Calibration **PASSES** (within ±0.05 of nominal at all three quartiles) —
  it **FAILED** on the old mis-specified target.
- Sharpness: predicted band median width 23.1h vs the train-start gap IQR
  22.4h — **NOT narrower**, so that gate leg still fails.
- **Verdict: INCONCLUSIVE** — clears neither the 0.6 ship bar nor the 0.8
  dead bar.

**Versus v0.69.0:** the like-for-like comparator is the old `defend, LULL
ONLY` configuration (0.770, CI [0.746, 0.789]) — the closest prior config to
"predict a lull's length," even though its training data was still the
pooled, mis-specified series. Correcting the target improved skill slightly
(0.770 -> 0.753) and flipped calibration from FAIL to PASS, but **did not
change the verdict** — INCONCLUSIVE either way.

### Previous-train features: null

A prior version of this test built phase-matched "controls" for
`prevTrainLength`/`prevTrainFailures` via a helper (`prevTrainStatsAt`) that
computed the previous-train stats a HYPOTHETICAL train start would inherit
at an arbitrary instant. That value is piecewise-constant across an entire
lull, and its value on that lull IS the value the REAL train start ending
that lull carries — so every "control" was, by construction, an exact copy
of a real event's value (0 of 6270 control draws fell outside the set of
real event values). A reviewer proved the resulting concentration/permutation
statistic was **invariant to the data**: shuffling the feature values across
all train starts produced IDENTICAL output (IQR ratio 1.000, p=1.0000), and
a synthetic world with a literally deterministic trigger was still reported
as "no signal." A statistic that cannot distinguish shuffled data from real
data cannot be published as evidence, so that test was **deleted, not
patched** — this section is the project's own record of catching it.

The replacement asks the question directly: does the previous train's
length/failure count predict how long the FOLLOWING LULL runs (the gap from
the end of the previous train to this train start), stratified by
`prevTrainLength`/`prevTrainFailures`:

```
stratified by prevTrainLength (lull hours per stratum):
  prevTrainLength=1   n=809  lull p25=25.0h  p50=36.1h  p75=47.7h
  prevTrainLength=2   n=246  lull p25=29.9h  p50=37.6h  p75=45.9h
  prevTrainLength=3   n=258  lull p25=29.3h  p50=37.9h  p75=45.6h
  prevTrainLength=4   n=238  lull p25=29.2h  p50=37.9h  p75=46.2h
  prevTrainLength=5   n=121  lull p25=29.8h  p50=36.2h  p75=44.9h
  prevTrainLength=6+  n=144  lull p25=28.7h  p50=35.5h  p75=44.7h
```

Medians run a flat 35.5h-37.9h across every stratum from L=1 to L=6+ — no
trend with previous-train length. The Pearson correlation, computed across
the 1,816 train starts that have a defined previous train (of 1,976 train
starts total — the first train of each season has none to compare against),
confirms it: **r = -0.036** for `prevTrainLength` vs lull length (and r =
-0.059 for `prevTrainFailures` vs lull length). For contrast — _not_ as
evidence of signal — `prevTrainLength` correlates r = 0.324 with the
**start-to-start** gap (this train's start minus the previous train's
start), but that correlation is mechanical: a longer previous train simply
pushes its own end time later, which pushes the start-to-start gap out even
when the lull that follows it is unrelated to how long the train was. The
script prints this distinction explicitly, because the start-to-start
correlation is exactly the kind of number a reader could otherwise mistake
for signal.

**No detectable relationship by a magnitude threshold — not a formal
null result.** `04-train-baseline.mjs` tests `|r| < 0.1` on each feature's
Pearson correlation against the lull, and documents that check itself as
"not a formal significance test (that machinery is exactly what was just
deleted for being degenerate)" — a plain magnitude threshold on the
correlation coefficient, with no null distribution behind it. Pearson `r`
also only captures linear relationships; a non-linear pattern could sit
underneath a near-zero `r` undetected. Within that limit, both features fall
well under the threshold, consistent with the flat `prevTrainLength` medians
above. The `prevTrainFailures` stratification (not reproduced in full here)
is not uniformly flat, though: p50 runs 31.9h at `prevTrainFailures=1`
against 38.5h at `prevTrainFailures=0`, a visibly off-trend stratum worth
disclosing rather than folding into the same "flat" characterization as the
`prevTrainLength` table above. No feature model was built on either feature
— a sub-0.1 correlation magnitude across the board is not grounds to fit
one, but "null" overstates what a magnitude threshold with one off-trend
stratum actually shows.

### Recommendation (train starts)

Unchanged from the pooled analysis: **do not ship a countdown.** ~9.1h
typical error on a ~44h cycle is not a usable ETA — over a fifth of the
predicted interval. The supportable defend surface remains descriptive:
"trains continue while you keep losing; once you hold, the next wave is
usually 28–46h out." **(A third attempt — § Attempt 3 below — later cut the
typical error to 7.8h with observable campaign-state features and still
missed the ship bar; the recommendation is unchanged.)**

## Attempt 3: observable campaign state (2026-07-28)

**Scripts:** `06-train-covariates.mjs` (covariate sweep with same-season
placebos), `07-train-state-model.mjs` (state-conditional models vs. the
gate).

A third pass at the corrected target, working the untried angles from the
handoff: clock features on train starts specifically, a cooldown floor,
per-faction cadence, season-level effects, and region. Every test in this
attempt carries the same-season placebo machinery the handoff demanded and
prior positives lacked: labels are permuted WITHIN season (cross-season
composition can't manufacture an effect), with a second phase-stratified
variant permuting within season × season-phase tercile (within-season
calendar drift can't either). Eight pre-declared tests, Bonferroni alpha
0.00625, 2,000 seeded permutations each, and a degenerate-control guard
(the permuted statistic must actually vary — the failure mode that shipped
twice before).

### The nulls, for the record

- **Clock features on train starts are null.** The hour-of-day effect
  measured on all defends (chi-squared 128.1, df=23) does not survive
  restriction to the 1,978 train starts: exposure-corrected chi-squared
  32.2 (df=23) with a season-rotation permutation p=0.13, day-of-week
  chi-squared 3.5 at p=0.57. The rotation null preserves each season's
  entire internal structure (gaps, trains, exposure shape) and destroys
  only clock alignment — an iid chi-squared null would be anticonservative
  here. Hourly rate ratios span 0.79–1.31: even the point pattern is weak.
  The pooled effect was mechanical-follow-up dilution, and the old hazard
  model (Phase 3) was right to find these features useless.
- **No hard cooldown floor.** Lull minimum 0.09h (cross-faction
  near-simultaneous train starts exist in every era); p01=3.7h, smooth left
  tail. The p05 drifts up across eras (12.3h → 24.7h, S1-40 → S121-160) —
  soft non-stationary tightening, not a mechanic.
- **Previous train's faction: null** (within-season delta −0.7h, p=0.74).
- **prevRegion==9: null** (−0.3h, p=1.0) — region 9 is where lulls END
  (see below), not a property that carries forward.
- **Season-level random effects: real but too weak to matter.** Split-half
  correlation of per-season median gaps r=0.30; an online season-pace
  predictor (M=3 pseudo-gap shrinkage) scored skill 0.787 [0.763, 0.813] —
  no better than the featureless baseline's 0.753.

### The signal: the homeworld-assault window

Three observable-at-forecast-time covariates survive both placebo variants
at p=0.0005 (the permutation floor), all pointing at one mechanism:

| Covariate (at lull start)         | Within-season delta | Phase-stratified | n (label) |
| ---------------------------------- | ------------------: | ---------------: | --------: |
| `maxSC == 9` (assault window)        |            +20.3h |          +20.3h |       251 |
| attack active (any faction)          |            −11.5h |          −11.5h |       206 |
| `prevRegion == 10`                   |            +10.1h |          +10.1h |       185 |

`maxSC` is the maximum sectors-captured across the three factions at the
moment the lull begins. Attacks fire at 9 of 10 sectors (§ Attacks), so
`maxSC==9` marks the window where a homeworld assault is imminent — and
train starts go quiet in it: lull p50 55.1h vs 34.8h elsewhere. The
designated confound check kills the season-phase explanation: `maxSC==10`
lulls are LATER in the season than `maxSC==9` lulls yet revert to baseline
(34.8h) — a monotone "late season is slower" drift cannot produce a spike
at 9 that reverses at 10. The `curRegion==9` structure (+11.5h, p=0.0005;
lulls that end in a region-9 train start are longer and much more
dispersed) is the same phenomenon seen from the other side — train-start
region is largely a campaign-state readout (73% of train starts fire
within ±1 of `sectorsCaptured+1`) — but it is NOT observable during the
lull and is reported as structure, not as a feature.

At moment level (the frame a predictor actually conditions in), the
separation is large at fixed elapsed: with 0–24h elapsed, median remaining
wait in the SC9 state runs 48–54h against 23–30h in NORMAL; the ATTACK
state runs 20–29h against NORMAL's 7–14h at 24h+ elapsed.

### The gate result

`07-train-state-model.mjs` feeds that state (precedence ATTACK > SC9 >
SC10 > NORMAL, evaluated fresh at every walk-forward moment from
information observable at that moment) into a k-nearest-neighbours
conditional wait estimator (K=200 on elapsed, within state; cells under 30
fall back to the pooled sample), through the same `walkForward` harness,
moment filter, and pre-registered gate as `04-train-baseline.mjs`. The
plain fit dropped right-censored training moments — a bias declared in the
script header before the first run, direction predicted (fitted waits too
short) — and the first run confirmed it exactly: skill 0.644 [0.624,
0.666] but calibration FAIL with all three rates low (0.188/0.442/0.722).
The single declared v2 fix, standard for precisely this defect, was
Kaplan-Meier product-limit quantiles over the same neighbourhoods with
censored moments included; nothing else changed and both versions are in
the output.

| Configuration    | Skill ratio | 95% CI         | Calibration       | Band vs 22.4h marginal |
| ----------------- | ----------: | -------------- | ----------------- | ---------------------- |
| BASELINE (04)     |       0.753 | [0.732, 0.773] | PASS              | 23.1h — NOT narrower   |
| STATE (v1)        |       0.644 | [0.624, 0.666] | FAIL (low)        | 18.9h — narrower       |
| SEASON-SCALE      |       0.787 | [0.763, 0.813] | PASS              | 24.2h — NOT narrower   |
| STATE × SCALE     |       0.649 | [0.626, 0.675] | PASS              | 19.7h — narrower       |
| **STATE-KM (v2)** |   **0.648** | [0.622, 0.674] | **PASS**          | **20.4h — narrower**   |
| STATE-KM × SCALE  |       0.669 | [0.644, 0.697] | PASS              | 21.3h — narrower       |

STATE-KM is the first model in this project to pass the sharpness leg, and
it passes calibration — two of the three gate legs, with a skill ratio a
clear CI-separated step below the previous best (0.648 vs 0.753; median
absolute error 7.8h vs 9.1h, against the constant baseline's 12.1h). The
third leg is the bar it dies on: the skill-ratio CI upper bound is 0.674,
and the pre-registered ship requirement is ≤ 0.6. **Verdict: INCONCLUSIVE
— do not ship.** Nowhere near the 0.8 dead bar either; the signal is real,
just not deep enough for a countdown.

Two caveats, disclosed rather than buried. First, six configurations were
evaluated and STATE-KM is the post-hoc best of correlated variants — its
CI does not account for that selection, which can only flatter it, and it
still misses the bar. Second, `h1_status` staleness (up to 24h for 156 of
160 seasons) smears the `maxSC` state boundaries, so the true assault-
window effect is likely SHARPER than measured here — a genuine reason a
future attempt with fresher state data (S157+ has ~15-minute buckets, but
only ~49 train starts so far) could do better, and the honest framing is
"insufficient data at the required freshness," not "no signal."

### What this changes about the recommendation

Nothing, for shipping: 7.8h typical error on a ~44h cycle is still too
coarse for a countdown, and the gate was missed on the leg it was designed
to be strict about. What it does change is the descriptive story the data
supports, which now has a mechanistic third clause: trains continue while
you keep losing; once you hold, the next wave is usually 28–46h out —
**unless a faction sits at 9 of 10 sectors, in which case the galaxy goes
quiet (p50 ~55h) until the homeworld assault resolves.**

## Faction choice (2026-07-31)

**Script:** `12-faction-choice.mjs`. `13-scheduler-shape.mjs` (above) answers
WHEN the next train starts; this answers WHICH of the three factions it
hits. Every lull is partitioned, at its own start (t0), into three
mutually exclusive buckets: an assault active at t0 (split by its FINAL
status), no assault but exactly one faction at `sectorsCaptured==9` (the
assault window from Attempt 3), or the residual.

- **Counterattack rule — a sequencing MECHANIC, not a statistical
  tendency** (same epistemic class as "a train continues iff the previous
  defend failed", § Train starts). Among lulls with a FAILED homeworld
  assault active at their start, the next wave hit that same faction
  **179/179 = 1.0000**. `succeeded` assaults are a definitional exclusion
  check, not a competing rule: **0/27** — the faction that just won cannot
  be the next target.
- **SC9-window targeting is statistical**, and real but modest: among
  lulls with no active assault and exactly one faction sitting at
  `sectorsCaptured==9`, the next wave targeted that faction **189/308 =
  0.6136** — well above the 1/3 chance rate. A within-season permutation
  placebo (2,000 draws, degenerate-control spread guard) gives **p=0.0005**
  (the permutation floor), so cross-season composition cannot be
  manufacturing this.
- **The honest remainder is near-random.** Once neither condition holds
  (n=1,305), five naive per-faction rules were scored for accuracy:
  majority class 0.3640, same-as-previous 0.4429, most-overdue-for-a-defend
  among active factions 0.3588 (n=967), highest-liberation among active
  factions 0.3533 (n=1121), and majority-among-active-status (predict the
  lone active faction when only one is active, else fall back to the
  overall majority) 0.4245. None of these clears any bar that would make it
  useful as a forecasting rule — the closest, same-as-previous and
  majority-among-active, sit in the low-to-mid 0.4s against a 1/3 chance
  floor for a three-way choice, not the kind of separation the assault
  mechanics show.
- **Transition matrix P(next | prev)** (n=1,819, all lulls):

  | prev \ next  |  Bugs | Cyborgs | Illuminate |     n |
  | ------------ | ----: | ------: | ---------: | ----: |
  | Bugs         | 0.334 |   0.361 |      0.305 |   548 |
  | Cyborgs      | 0.246 |   0.410 |      0.344 |   663 |
  | Illuminate   | 0.291 |   0.311 |      0.398 |   608 |

  Base rate (marginal `next`): Bugs 0.288, Cyborgs 0.362, Illuminate 0.350.
  Every faction is somewhat more likely to repeat than the base rate would
  predict (a mild positive autocorrelation, consistent with
  same-as-previous scoring above the naive 1/3), but none of the
  off-diagonal entries approach the near-1.0 concentration the
  counterattack mechanic produces.

**Bottom line:** faction choice has exactly one deterministic rule
(counterattack, a mechanic) and one real but modest statistical tilt (the
SC9 assault window). Outside both, which faction gets hit next is close to
a coin flip among the three — no per-faction recency, liberation, or
sector-progress rule tried here beats chance by a useful margin.

## Scheduler shape (2026-07-31)

**Script:** `13-scheduler-shape.mjs`. Reverse-engineering framing: which
game-dev implementation produces the observed lulls? Fingerprints measured
on the full history:

- Memoryless per-tick spawning: dead (KS vs exponential 0.314; CV 0.476
  against the memoryless CV of 1).
- Cooldown + uniform roll: dead (KS 0.240).
- Coarse scheduler tick: dead (train-start timestamps carry full
  second-level entropy; no comb at 15min/1h wall-clock or 0.5-6h relative).
- k-stage accumulator / gamma delay: fits (KS 0.073 at k 4.4, theta 8.9h).
- Per-faction independent timers: dead — per-faction cycles are NOISIER
  (CV 0.768, 0.783, 0.777) than the pooled series (CV 0.447); superposition signature of
  ONE global clock with the faction drawn at spawn.
- Fixed schedule table: dead (lull CV flat across wave index).
- End-anchored: r(prev train duration, lull) -0.027 (near zero).

Reconstructed: `onTrainEnd(WIN): nextWaveAt = now + Gamma(k≈4.4, θ≈8.9h)`,
faction chosen at spawn (see § Faction choice), with the assault-window
pause and counterattack override layered on top.

## Recommendation

**Do not ship a countdown or an ETA.** Neither event type supports one:
attacks don't need a forecast (the answer is already a deterministic
campaign-progress fact), and defends don't have a model that clears the
gate.

If a product surface ships anyway, the honest options are:

- **Attack side:** a progress readout — "N of 10 sectors captured, homeworld
  assault unlocks at 9" — which is deterministic and already derivable from
  data the game exposes today. Not a prediction; a fact.
- **Defend side:** a descriptive band, not a prediction — "trains continue
  while you keep losing; once you hold, the next wave is usually 28–46h
  out." **(Corrected 2026-07-28 — see § Train starts.** The mechanic is now
  measured directly (fail -> 96.9% continuation, success -> 0.1%) rather than
  inferred from a 10-minute chain threshold. The band itself is unchanged:
  the earlier "given no chain, lull length" figures (p25 27.8h / p50 36.8h /
  p75 46.4h, n=1,816) already were the train-start lull — the pooled-series
  measurement and this correction's train-start-only measurement are the
  same set, same n, bit-identical values. That makes this correction
  independent corroboration of the 28–46h band, not a retraction of it. (Do
  not substitute the start-to-start gap, 33.6h–56.0h, for this band — that
  quantity includes the previous train's own duration; see § Train starts,
  Regularity.))

Either way, even the best model's ~7.8h typical error against a ~44h
train-start cycle (§ Attempt 3, STATE-KM) is too coarse for a countdown —
descriptive language, not a number, is what the data supports. Attempt 3
adds one mechanistic clause the descriptive surface can honestly carry:
when a faction sits at 9 of 10 sectors (the homeworld-assault window),
lulls run ~20h longer than usual (p50 ~55h vs ~35h) — observable directly
from campaign state, placebo-tested, and coherent with the attack
mechanics in § Attacks.

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
