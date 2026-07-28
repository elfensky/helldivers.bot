# Attack forecast — design

**Date:** 2026-07-28
**Status:** design approved, plan pending
**Supersedes nothing.** Extends the #472 next-event-timing work to the attack side.
**Related:** [`2026-07-27-next-event-timing-forecast-design.md`](2026-07-27-next-event-timing-forecast-design.md), `/docs/predict`

## Why

`/docs/predict` says of attacks: *"the approach is sound… but this has never been
measured. No forecast model has been built for the attack side, and no accuracy figure
exists."* This design measures it.

The published finding it builds on: attacks are mechanically triggered on campaign
progress. Liberation at attack start is p25 0.932 / p50 0.961 / p75 0.983; 89.3% fire at
≥90% liberation; IQR ratio 0.135 against phase-matched controls, permutation p = 0.0005.

## The question

**Does liberation forecast attacks better than season phase alone?**

Not "how accurate is an attack ETA." Measured against the database, attacks average
**2.17 per (season, faction)** (min 1, max 7, n = 427 faction-seasons). With ~2 targets
per faction-season, "predict the wait to the next attack" is very close to "predict where
you are in the season" — and `daysIntoSeason` is the trigger hunt's own control variable,
included precisely because season-phase correlation can manufacture concentration for a
spurious variable. A forecast with no equivalent control is not interpretable.

## Measurements that shaped this design

Run against the dev database on 2026-07-28, before any modelling:

| Measurement | Value |
| --- | --- |
| Attacks per (season, faction) | mean **2.17** (min 1, max 7, n = 427) |
| `h1_status` median bucket gap, S<157 | **24.00h** (n = 12,666) |
| `h1_status` median bucket gap, S157+ | **0.25h** (n = 21,762) |
| Sign of 1-bucket (~1-day) liberation change, S<157 | 61.5% positive · 26.1% zero · 12.4% negative |
| Sign of 3-bucket (~3-day) change, S<157 | 60.6% positive · 16.7% zero · 22.7% negative |

Two consequences drove the design away from its first draft:

1. **`v ≤ 0` on ~39% of moments, at both windows** (38.5% at 1d, 39.4% at 3d). Widening
   the window trades "zero" for "negative"; it does not improve the usable fraction. A
   velocity-ETA model that falls back on `v ≤ 0` is the fallback model on two moments in
   five, by construction. Velocity is therefore an appendix, not the headline, and the
   1d/3d sweep is dropped — there was nothing for it to discover.
2. **Liberation is not monotone.** Roughly one 3-day window in five shows net *loss*.
   `(L* − L)/v` presumes steady progress toward a threshold; the process lacks that shape.

## Models

All four run through the existing `walkForward()` harness — walk-forward by season,
right-censoring aware, season-level block bootstrap, leakage asserts.

| # | Model | Role |
| --- | --- | --- |
| 1 | `phase` — elapsed days since `firstStart`, binned at 1-day width with a ≥30-day overflow bin, empirical wait lookup | **Control.** Must be beaten. |
| 2 | `liberation` — liberation binned (0.05 wide, plus a ≥1.0 overflow bin), empirical wait lookup | **The claim.** |
| 3 | `liberation-shuffled` — model 2 with liberation permuted within season | **Placebo.** Must fail. |
| 4 | `eta` — `(L* − L)/v`, `v > 0` moments only, ratio quantiles learned **per liberation band** | **Appendix.** |

**Model 1 uses elapsed days, not fraction-through-season.** `spanSeconds` derives from
`lastEnd` (`dataset.mjs:98-105`), so a fractional-phase feature leaks the season's end
into the predictor.

**Model 2 bin widening:** bins with <30 observations widen to nearest non-empty
neighbours, ultimately to the pooled wait distribution.

**Model 3 is the load-bearing addition.** `/docs/predict` names the absent automated
same-season placebo as *"the single biggest gap between what the scripts check and what
the published findings claim."* Shuffling liberation within season, refitting, and
requiring failure closes that gap for the attack side.

**Model 4 is never blended with model 2.** It is evaluated strictly on `v > 0` moments
and reported alongside model 2 restricted to *those same moments*. The rejected first
draft used model 2 as model 4's fallback, which would have made "does velocity add
anything" unanswerable: a 39% fallback rate means the blended model is largely the
fallback wearing the ETA's name. Ratio quantiles are learned per liberation band because
`wait / rawEta` is heavy-tailed as `rawEta → 0` and is mechanically correlated with
`rawEta` — a single pooled `{r25, r50, r75}` is invalid.

## Run matrix — 18 rows

- `{phase, liberation}` × 3 factions × `{filtered, unrestricted}` = 12
- `liberation-shuffled` × 3 factions, filtered = 3
- `eta` × 3 factions, filtered, `v > 0` only = 3. Each of these rows *also* prints
  `liberation` re-scored on that row's own `v > 0` moment subset, as a paired comparison
  inside the row — not as a fourth set of rows.

**Filtered** excludes moments where an attack against that faction is already active.
**Unrestricted** runs anyway: if the verdict flips between them, the filtered result is a
conditioned result, not a general attack-timing one, and the page must say so.

**Pooled ("next attack against anyone") is dropped.** `min(ETA_i)` is not a valid pooled
quantile — `S_pooled(t) = ∏S_i(t) ≤ min_i S_i(t)`, so the true pooled median is *earlier*
than `min_i(median_i)`; the construction predicts too late and calibration lands above
nominal. Rebuilding it properly (multiply per-bin empirical survival curves, invert)
assumes faction independence, which does not hold — factions share a player base and a
season. Per-faction is the deliverable and the page will say so plainly.

Every result is additionally **stratified by status resolution** (S<157 vs S157+) as a
diagnostic, since the two populations differ by ~100× in bucket cadence.

## Harness changes — `scripts/analysis/lib/backtest.mjs`

| Change | Kind |
| --- | --- |
| `forwardRecurrenceMedian` respects `momentFilter` | **Behavioural — changes published numbers** |
| Report horizon-clamp rate | Additive |
| Report reliability table (calibration by predicted-p50 decile) | Additive |
| Extract `seasonMoments(span, stepHours)` shared by fit and eval loops | Refactor |

**The baseline fix changes the published defend result.** `baselineConstant`
(`backtest.mjs:146`) is currently computed by walking the *unfiltered* season span while
`momentFilter` applies only inside the eval loop (`backtest.mjs:166`) — so for any
filtered config the skill ratio partly measures the filter. `02-baseline.mjs` and
`04-train-baseline.mjs` must be re-run and `/docs/predict`'s defend numbers updated to
whatever the corrected run produces, with a note that a harness bug was found and fixed.
The defend verdict (INCONCLUSIVE) is unlikely to flip — 0.753 sits far from the 0.6 bar —
but the numbers will move and the page must not keep stale ones.

**Why the clamp rate matters.** `backtest.mjs:180-182` clamps all three quantiles to
`horizonHours = 1500`, and `sharpnessHours` is `median(q75 − q25)` (`backtest.mjs:330,363`).
A record whose quantiles all clamp contributes width 0. If a majority clamp, the median
band width collapses toward zero and the sharpness leg reports PASS on an artifact.
**Threshold: a clamp rate above 10% marks that config's sharpness leg UNREADABLE**, and
the script prints it as such rather than PASS or FAIL.

**Why the reliability table matters.** `calibrationFor` (`backtest.mjs:233-246`) pools
every record, so it is a marginal check. A model can pass it while being miscalibrated in
every liberation stratum with the errors cancelling.

**Sharpness marginal** is computed in the new script, not the harness: for a filtered
config it is the distribution of **attack-end → next-attack-start** gaps, not raw
start-to-start, mirroring `02-baseline.mjs:227-259`. Using start-to-start would inflate
the marginal and make the sharpness leg trivially passable.

## New script — `scripts/analysis/06-attack-forecast.mjs`

Follows the `02-baseline.mjs` idiom: pure-function self-checks at the top (no DB), then
`loadDataset()`, then a CONFIGS loop through `walkForward`, then the gate print.

**Closure over `ds`.** `fitPredictor(trainEvents, ctx)` receives only
`{testSeason, trainGaps, baselineConstant}` (`backtest.mjs:148-152`). The lookup models
need `seasons` and `liberationAt`, so they close over the loaded dataset.

**Incremental bin accumulation.** `fitPredictor` runs once per eval season
(`backtest.mjs:120,148`), and a naive lookup fit is O(trainSeasons × span/stepHours) —
~10⁴ season-walks across the run. Bins accumulate as a prefix over ascending eval
seasons instead, with an assert that the accumulator never holds a season ≥ `testSeason`.

**Shared clock.** Both the fit loop and `walkForward`'s eval loop use `seasonMoments()`,
so fit-time bins and eval-time moments cannot silently diverge.

**`libVelocity` moves** from `05-defend-covariates.mjs:195` into `lib/dataset.mjs`,
exported as a pure function (so `05`'s fake-injection self-check still works) and exposed
on the loaded dataset as `libVelocityAt` alongside `liberationAt`.

## Decision gate

Unchanged, all three legs required: calibration within ±0.05 at p25/p50/p75; skill-ratio
95% CI entirely at or under 0.6; predicted band narrower than the config's own marginal.

Additional pass conditions specific to this design, applied before the gate is read:

- `liberation` must beat `phase` on skill ratio. If it does not, the result is about
  season calendar, not the attack mechanic, and no gate verdict is meaningful.
- `liberation-shuffled` must **fail**. If the placebo passes, the pipeline is fitting
  something other than liberation and every other row is void.
- Sharpness is reported as unreadable wherever the horizon-clamp rate is material.

## Self-check — must be non-vacuous

The project deleted a prior test for being invariant to its input. The equivalent trap
here is a lookup pipeline that scores well on any binned variable. The self-check
therefore requires **both** directions, no DB needed:

1. A synthetic world with a deterministic liberation→attack threshold, where models 1–2
   **recover** it (skill ratio well under 1, calibration near nominal).
2. The same world with liberation shuffled within season, where they **fail**
   (skill ratio ≈ 1).

Plus pure-function checks: bin widening, per-band ratio quantiles, quantile ordering,
and the incremental accumulator matching a from-scratch fit.

## Documentation

`src/app/docs/predict/page.mdx`:

- Rewrite § Attacks → "Can we forecast the next one?" with measured numbers, replacing
  the "never been measured / approach is sound" text.
- Update the bottom-line bullet.
- Add an `<details>` in-depth block: the 18-row table (effective N, calibration, sharpness
  vs. marginal, MAE vs. baseline, skill ratio + CI, clamp rate, verdict), the reliability
  table, the resolution stratification, and the placebo result.
- Record the ~39% `v ≤ 0` finding as the reason velocity ETA is an appendix.
- Update the defend numbers after the baseline fix, noting the harness bug.
- Update the "top outstanding gap" caveat: the same-season placebo now exists for attacks.
- Add `06-attack-forecast.mjs` to the reproduce list and to `scripts/README.md`.

Charts are out of scope. If the result warrants a visual, it is a follow-up issue.

## Verification

`npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` — all four must
pass. Plus: `node scripts/analysis/lib/dataset.mjs`, `node scripts/analysis/lib/backtest.mjs`,
and `node --env-file=.env.development scripts/analysis/06-attack-forecast.mjs`.

## Out of scope

- Shipping any user-facing countdown or API field. If the gate passes, that is a separate
  issue.
- Re-running `05-defend-covariates.mjs`; its findings are unaffected.
- Any change to the defend model itself beyond re-running it under the corrected baseline.

## Provenance

Design revised after an adversarial multi-model review (Codex, Antigravity, Sonnet 4.6,
Opus 5; blinded/independent). All four rejected the first draft. Unanimous findings:
the model-A-as-fallback blend, the pooled `min(ETA_i)` construction, the pooled
ratio-calibration degeneracy, and the unmeasurability of velocity at ~1 bucket/day.
Transcript: `~/.claude-octopus/debates/no-session/001-attack-eta-design/`.
