# Next-event timing forecast — design

**Issue:** [#472](https://github.com/elfensky/helldivers.bot/issues/472)
**Date:** 2026-07-27
**Status:** approved, ready for implementation planning

## Goal

Answer one question with numbers: **is the start time of the next HD1 event
predictable well enough to be worth shipping?**

The deliverable is the answer, not a feature. If the analysis says "not usefully
predictable", we record the numbers, close the issue, and ship nothing. That is
an acceptable — and the cheapest — outcome.

Attack events are the primary target; defend events are secondary and reuse the
same harness.

## Data reality

Measured against the dev DB after the 2026-07-27 production refresh. These
numbers constrain every decision below, so they are recorded here rather than
left implicit.

| Fact                        | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| Events                      | 6,013 across all 160 seasons                           |
| Split                       | 5,088 `defend` / 925 `attack`                          |
| Events per season           | min 4, p50 32, max 119                                 |
| Season span (from events)   | p25 13.5d / p50 20.9d / p75 34.5d                      |
| `h1_status` resolution      | ~1.05 buckets/day for 156 seasons; 96/day for S157–160 |
| `players_at_start` coverage | 6,013 / 6,013 events, all 160 seasons                  |
| `h1_statistic` coverage     | 4 seasons (S157–160)                                   |

Gap and duration distributions, in hours:

| metric                       |   min |   p10 |   p25 |  p50 |  p75 |   p90 |   max |
| ---------------------------- | ----: | ----: | ----: | ---: | ---: | ----: | ----: |
| gap, defend → defend start   |   0.0 |   2.5 |   2.5 |  2.5 | 32.9 |  48.8 | 202.1 |
| gap, attack → attack start   |   0.1 |  10.9 |  25.9 | 54.5 | 90.1 | 157.2 | 555.1 |
| duration, defend             |   0.0 |   1.9 |   2.3 |  2.5 |  2.5 |   2.5 |  48.0 |
| duration, attack             |   0.2 |  27.9 |  39.8 | 48.0 | 48.0 |  48.0 |  48.0 |
| idle (prev end → start), def |   0.0 |   0.0 |   0.0 |  0.0 | 30.3 |  45.4 | 199.6 |
| idle (prev end → start), att | -47.8 | -33.7 | -18.9 |  9.1 | 45.0 | 113.8 | 508.3 |

### What the structure implies

1. **The two types are different problems.** `defend` is a fixed ~2.5h window
   (p10 1.9 → p90 2.5); `attack` is hard-capped at 48h (p50 = p75 = p90 = 48.0).
   Start-to-start gaps differ by an order of magnitude. One pooled model would
   predict neither.
2. **Defends are bimodal — 63.1% chain.** Idle ≤10 min for 63.1% of consecutive
   defends; the rest is a lull with p75 30.3h. The question is "chain or lull,
   and if a lull, how long", not "what is the average gap".
3. **Attacks overlap each other.** Attack idle is negative through p25 (−18.9h),
   so "time since the last attack ended" is not a well-defined clock for them.
   Attack timing must be modelled as recurrence of 48h windows.
4. **No fixed clock schedule.** `start_time % 1800 == 0` for 0 of 6,013 events;
   `% 300 == 0` for 0 of 6,013.
5. **There is a time-of-day and weekend rhythm.** Defend starts by UTC hour are
   non-uniform (χ²=128.1, df=23, crit 35.2): trough 12:00–15:00 UTC (156–181/hr),
   peak 17:00–01:00 (244–268/hr). Attacks peak 12:00–20:00 (χ²=56.8). Defends
   show a weekend bump (χ²=21.7, df=6, crit 12.6); attacks do not (χ²=9.4, n.s.).
   Effect size ~1.6× peak-to-trough — a rate modifier, not a schedule.

### Hypotheses under test

Three were proposed: time since last event, active playerbase, and faction
progress speed. Current standing:

- **Time since last event** — the core variable, and the whole of the baseline.
- **Playerbase** — `players_at_start` is universal but showed no raw signal on
  defend chain-vs-lull (mean 691 before a chain, 695 before a lull, n=4,928).
  That test used absolute counts, which drift across 160 seasons of war eras.
  Re-test normalized **within season** before discarding it.
- **Faction progress speed** — available only as points/day for 156 seasons.
  Only 11 of 925 attacks have ≥2 status buckets in the preceding 24h, so a
  fine-grained pre-attack velocity feature does not exist historically.

## Layout

New `scripts/analysis/`, alongside the existing committed one-off
`backfill-h1-tables.mjs`. Committed rather than scratchpad, so the numbers stay
reproducible when someone questions them later.

```
scripts/analysis/
  lib/dataset.mjs        # one loader, shared by all phases
  01-trigger-hunt.mjs    # is it a rule?
  02-baseline.mjs        # renewal hazard, the yardstick
  03-hazard.mjs          # + features, only if 01 finds no rule
```

Run as `node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs`.
Findings are posted as a comment on #472; no separate findings doc.

Implementation language is Node with `pg`, no statistics libraries. Rungs 1–2
are quantiles, counting and a hazard array; anything that ships has to be JS
regardless, so there is no port step.

## Data layer — `lib/dataset.mjs`

A single export, `loadDataset()`. Three queries (`h1_event`, `h1_status`,
`h1_season`), joined in JS — ~6k events and ~50k status rows fit in memory, so
no SQL gymnastics.

Returns events sorted by `(season, start_time)` with derived fields attached:
`idle`, `hoursSinceLastSameType`, `playerPercentileInSeason`. Plus a
`statusAt(season, enemy, t)` binary-search helper returning the most recent
status bucket at or before `t`.

`statusAt` carries the staleness caveat: for 156 of 160 seasons its answer can
be up to 24h old.

## Phase 1 — trigger hunt

For every attack, record campaign state at `start_time`: liberation ratio
(`points / points_max` for that enemy), regions captured, days into season,
hours since the previous same-enemy attack ended, and within-season player
percentile.

The test is **concentration against a control**: compare each variable's
distribution at attack starts against the same variable sampled at random
non-attack times within the same seasons. Report each variable's IQR at attack
starts vs at control times, and the fraction of attacks falling inside the
tightest 10% band.

If HD1's server fires attacks when liberation crosses a threshold, that variable
collapses to a narrow band while the control does not. Then it is a _rule_,
there is nothing to forecast, and phases 2–3 are never written.

**Limitation, stated up front:** daily status resolution blurs any threshold by
up to 24h. A real rule still shows as concentration, just smeared. Phase 1 can
therefore confirm a rule but cannot cleanly rule one out. A negative result
means "no rule detectable at daily resolution", which gets re-tested against
S157–160 at 15-min resolution as a sanity check before moving on.

## Phase 2 — baseline (`02-baseline.mjs`)

Renewal hazard from gap distributions alone, no features. Per `(type, enemy)`:
hazard binned by hours-elapsed-since-last, from which ETA quantiles follow.

The backtest harness lives here; phase 3 reuses it verbatim.

**Walk-forward by season.** Train on seasons `< N`, evaluate on season `N`, for
`N` in 21…160 — the first 20 seasons form the initial training set and are never
themselves evaluated. Within a held-out season, step a clock in 3h
increments. At each moment `t` the predictor sees only what is knowable at `t`
and emits p25/p50/p75 of the wait until the next same-type start strictly after
`t`. Moments with no subsequent event (right-censored, end of season) are
dropped, and the dropped count is reported.

Three scores, because any one alone is gameable:

- **Calibration** — fraction of true waits below each predicted quantile, which
  should land on 0.25 / 0.50 / 0.75. A model can be sharp and confidently wrong;
  this catches that.
- **Sharpness** — median width of the p25–p75 band, in hours. A model can be
  perfectly calibrated by predicting "somewhere between 0 and 500h"; this
  catches that.
- **Skill** — median `|true − p50|` against a constant-median baseline,
  reported as a ratio. Below 1.0 means the model earned its existence.

## Phase 3 — features (`03-hazard.mjs`)

Written only if phase 1 finds no rule.

Discrete-time hazard at daily resolution across all 160 seasons: for each
`(season, enemy, day)` a binary "did an attack start", with features
hours-since-last-attack, within-season player percentile, and points/day
velocity. Hand-rolled logistic regression by gradient descent. Same harness,
same three scores.

Sub-day timing gets whatever the hour-of-day prior provides, reported with wide
bands and cross-checked against S157–160 at 15-min resolution.

## Decision gate

Recorded now so the conclusion cannot be argued into existence afterwards.

**Ship-worthy** requires all three:

- calibration within ±0.05 of nominal at each of p25/p50/p75
- skill ratio ≤ 0.6
- p25–p75 band narrower than the unconditional gap IQR

**Skill ratio above 0.8** means not usefully predictable. Record the numbers,
close #472, ship nothing.

## Testing and error handling

These are throwaway analysis scripts: no `tryCatch`, let them throw with a real
stack. That convention governs app code, and someone will otherwise "fix" this.

No vitest files. The mirror rule in `src/__tests__/unit/_meta/mirrorTree.test.mjs`
resolves only against the `src` and `public` roots, so a test for `scripts/`
would fail it. Each script instead carries inline `assert` invariants.

One assert matters more than the rest: **the backtest must assert that no
training row comes from a season ≥ the test season.** Leakage there silently
invalidates every reported number, and it is the one bug that produces
beautiful, wrong results.

Anything later shipped into `src/shared/utils/game/` gets a proper mirrored
vitest test — that is the follow-up issue, not this one.

## Out of scope

- Predicting _which_ region, _which_ enemy, or the event outcome. Timing only.
- Any UI or API surface. #472 ends at a validated function; surfacing it is a
  separate issue.
- LLM or neural approaches. This is 6k rows of integers and a survival curve.
