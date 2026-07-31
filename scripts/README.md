# Scripts

Offline migration and maintenance tools. These scripts run outside
Next.js and use relative imports (no `@/*` alias).

## backfill-h1-tables.mjs

One-shot migration script that reads from a pg_dump restore of the
pre-cleanup schema (legacy) and writes normalized rows into the
current production schema (h1_status, h1_statistic, h1_event_progress).

### Prerequisites

1. Restore a pg_dump of the old database into a separate Postgres instance
   (or a different database on the same instance).
2. Set environment variables:
    - `LEGACY_POSTGRES_URL` -- connection string for the restored dump
    - `POSTGRES_URL` -- connection string for the target (production) database
    - `BUCKET_SIZE` -- (optional) tumbling-window size in seconds, default 900

### Usage

```bash
# Backfill all seasons (resumes from last completed season)
node --experimental-strip-types scripts/backfill-h1-tables.mjs

# Backfill seasons 1 through 50 (skip active season 51+)
node --experimental-strip-types scripts/backfill-h1-tables.mjs --to=50

# Start from a specific season
node --experimental-strip-types scripts/backfill-h1-tables.mjs --from=10

# Combine: backfill seasons 10-50
node --experimental-strip-types scripts/backfill-h1-tables.mjs --from=10 --to=50

# Destructive re-run: delete target rows before inserting
node --experimental-strip-types scripts/backfill-h1-tables.mjs --force

# Show help
node --experimental-strip-types scripts/backfill-h1-tables.mjs --help
```

### What it does per season

1. Reads `h1_season` metadata (with JOINed `h1_introduction_order.order`
   and `h1_points_max.points`) from the legacy DB.
2. Reads `h1_snapshot` rows, parses stringified JSON `data` field,
   fans each frame into 3 faction rows, deduplicates by (enemy, bucket).
3. Reads `h1_live` rows, converts each faction to a single bucket row.
4. Reads `h1_live_snapshot` (stats timeseries), deduplicates by
   (enemy, bucket) keeping the latest `time`. All 11 stats fields.
5. Reads `h1_event_snapshot` (event progression), deduplicates by
   (type, event_id, bucket) keeping the latest `time`.
6. Writes everything to the target DB in a single Prisma transaction.

### Safety

- Uses `createMany({ skipDuplicates: true })` for idempotent re-runs.
- Each season is wrapped in `db.$transaction([])`.
- Resumable: checks `MAX(season)` from `h1_status` for checkpoint.
- Does NOT write to `h1_event` -- that table is unchanged by the migration.
- `--force` deletes target rows for each season before inserting.

## analysis/

Read-only, one-shot analysis scripts for the next-event timing forecast
investigation ([#472](https://github.com/elfensky/helldivers.bot/issues/472)).
They query the event log and campaign timeseries, print a report to stdout,
and exit -- there is no persisted output and nothing here runs on a schedule.
The design doc is
[`docs/superpowers/specs/2026-07-27-next-event-timing-forecast-design.md`](../docs/superpowers/specs/2026-07-27-next-event-timing-forecast-design.md);
the findings are written up at
[`docs/superpowers/findings/2026-07-27-next-event-timing.md`](../docs/superpowers/findings/2026-07-27-next-event-timing.md).

### Layout

- `lib/dataset.mjs` -- the single data loader. Runs three queries
  (`h1_event`, `h1_status`, `h1_season`) and attaches derived per-event
  fields (causal within-season player percentile, enemy-scoped gaps, a
  point-in-time status lookup). Every other script imports `loadDataset()`
  from here rather than querying directly.
- `lib/backtest.mjs` -- `walkForward()`, a walk-forward-by-season backtest
  harness. Takes a caller-supplied `fitPredictor`, steps a clock through each
  held-out season, and scores calibration/sharpness/skill-ratio with a
  season-level block-bootstrap CI. Knows nothing about any particular model;
  `02-baseline.mjs` and `03-hazard.mjs` both build on it. Has no DB import at
  all, so its self-check runs against a synthetic fixture only.
- `01-trigger-hunt.mjs` -- Phase 1. Tests whether attack/defend events fire
  on a deterministic campaign-state rule (phase-matched controls +
  permutation test, Bonferroni-corrected across five variables).
- `02-baseline.mjs` -- Phase 2. Features-free empirical residual-life
  predictor, the yardstick every later model has to beat, plus the
  chain-vs-lull decomposition for defends and the project's pre-registered
  decision gate.
- `03-hazard.mjs` -- Phase 3. Hourly discrete-time logistic hazard model for
  defends, using only features with measured support from Phases 1/2
  (cyclic hour-of-day, weekend indicator, capped elapsed-hours). Compares
  itself against the Phase 2 numbers on the same configuration.
- `04-train-baseline.mjs` -- Phase 4, the corrected-target follow-up
  ([#472](https://github.com/elfensky/helldivers.bot/issues/472)). Phases
  1-3 measured defend timing against all 4,928 defend-to-defend gaps, a
  bimodal series dominated by ~2.5h mechanical chain gaps (a defend train
  continues iff the previous defend FAILED -- 96.9% vs 0.1%, see
  `lib/dataset.mjs`'s train-labelling self-check). This script retrains and
  re-evaluates on the correct series -- train-start-to-train-start gaps only
  (n=1,976 events / 1,816 gaps, CV 0.45 vs the pooled series' CV 1.32) --
  using the same `walkForward` method as `02-baseline.mjs`. It also reports
  a lull-stratified table (by `prevTrainLength`/`prevTrainFailures`) and the
  Pearson correlation of each against the following lull's length, which
  replaced an earlier concentration/permutation test proven invariant to the
  data (shuffling the feature values reproduced identical output).
- `05-defend-covariates.mjs` -- covariates against defend train starts that
  `01-trigger-hunt.mjs` never tested (liberation velocity at three windows,
  players relative to the season median, faction status, other-faction event
  activity), using the same phase-matched-control machinery. Headline: the
  liberation-velocity "signal" is a cross-season artifact -- redrawn with
  same-season controls it vanishes (0.832 -> 0.998) -- and everything else
  is null or definitional.
- `06-train-covariates.mjs` -- the second covariate sweep, on the corrected
  target (train-start lulls), with the same-season placebo machinery built
  in: every test is a WITHIN-SEASON label permutation (plus a
  phase-stratified season-x-tercile variant), so neither cross-season
  composition nor within-season calendar drift can manufacture an effect.
  Eight pre-declared tests under Bonferroni. Null: clock features on train
  starts (the pooled hour-of-day effect was follow-up dilution), previous
  train's faction, `prevRegion==9`; no hard cooldown floor. Significant and
  observable: `maxSC==9` at lull start (+20.3h -- the homeworld-assault
  window), attack active at lull start (-11.5h), `prevRegion==10` (+10.1h).
- `07-train-state-model.mjs` -- feeds the 06 covariates through
  `walkForward` as an observable moment-level state (`ATTACK` > `SC9` >
  `SC10` > `NORMAL`): kNN-on-elapsed within state, a season-pace variant,
  and a declared Kaplan-Meier censoring fix. Best configuration: skill
  0.648 [0.622, 0.674], calibration PASS, sharpness PASS -- still misses
  the pre-registered ship bar (CI upper bound <= 0.6). Verdict:
  INCONCLUSIVE, do not ship.
- `08-emit-wave-model.mjs` -- emits the committed lookup table behind the
  dashboard's next-wave card (`src/features/dashboard/waveModel.mjs`): the
  attempt-3 STATE-KM estimator fit on full history, one row per observable
  state x 1h elapsed bin, plus within-24h/48h probabilities. Refuses to emit
  unless quantiles are monotone and the predicted probabilities are reliable
  against history (deciles within ±0.10, overall ±0.05).
- `09-attack-trigger.mjs` -- tests whether the attack trigger is exactly
  `points == points_max`, with the published liberation "trigger band" as the
  competing hypothesis (an artifact of `h1_status`'s ~1-bucket/day staleness
  smearing a hard threshold into a plausible-looking spread). Three checks: a
  staleness gradient (liberation-at-attack vs. reading age), every attack with
  a <15-minute-old reading listed individually, and trigger lag for the
  15-minute-resolution seasons.
- `10-attack-eta.mjs` -- once `09-attack-trigger.mjs` establishes the
  threshold as a known constant, the forecast collapses to
  `eta = (points_max - points) / rate`, so this script measures how well a
  24-hour pace window predicts it (chosen because shorter windows are
  unbacktestable against 156 of 160 seasons' daily buckets), with no fallback
  model for `rate <= 0` moments and per-remaining-fraction ratio quantiles
  (pooling would be invalid since `wait / eta` is heavy-tailed near
  `remaining -> 0`).
- `11-emit-attack-model.mjs` -- emits the committed constants behind the
  dashboard's assault-ETA line (`src/features/dashboard/attackModel.mjs`):
  per-remaining-fraction band ratio multipliers and day-of-week pace factors
  from `10-attack-eta.mjs`, fit on full history. Refuses to emit unless the
  multipliers are finite/positive/monotone, the day-of-week table actually
  varies, and a full-history replay clears the same alert bar the
  walk-forward run was held to.
- `13-scheduler-shape.mjs` -- distribution forensics on the train-start lull:
  discriminates six candidate scheduler implementations by shape (KS vs
  exponential/gamma/uniform), tick combs, per-faction-vs-pooled CV, and
  wave-index stationarity. Verdict: one global end-anchored timer with a
  gamma(k~4-5) delay; faction drawn at spawn. Forensic-descriptive -- the
  discriminations rest on order-of-magnitude gaps, not p-values.
- `12-faction-choice.mjs` -- which faction the next wave hits. The
  counterattack rule (a FAILED homeworld assault is always followed by a
  wave on that faction -- 179/179 in the current dataset), succeeded-assault
  exclusion, SC9-window targeting (61.4%, within-season permutation
  placebo), and the honest remainder: near-random among active factions;
  per-faction recency/liberation/sector rules all at chance.

### Self-checks

Each module runs its own `assert`-based self-check when invoked directly
(`import.meta.filename === process.argv[1]`) -- there are no vitest files
for these scripts. `src/__tests__/unit/_meta/mirrorTree.test.mjs` resolves
every unit-test path against the `src` and `public` roots only, so a test
under `scripts/` has no mirrored source root to land on and would fail that
rule. The in-module `assert` blocks are the test suite for this directory.

### Running

```
# self-checks -- no DB required for backtest.mjs
node scripts/analysis/lib/backtest.mjs
node --env-file=.env.development scripts/analysis/lib/dataset.mjs

# the report scripts -- all need POSTGRES_URL (DB required)
node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs
node --env-file=.env.development scripts/analysis/02-baseline.mjs
node --env-file=.env.development scripts/analysis/03-hazard.mjs
node --env-file=.env.development scripts/analysis/04-train-baseline.mjs
node --env-file=.env.development scripts/analysis/05-defend-covariates.mjs
node --env-file=.env.development scripts/analysis/06-train-covariates.mjs
node --env-file=.env.development scripts/analysis/07-train-state-model.mjs
node --env-file=.env.development scripts/analysis/08-emit-wave-model.mjs
node --env-file=.env.development scripts/analysis/09-attack-trigger.mjs
node --env-file=.env.development scripts/analysis/10-attack-eta.mjs
node --env-file=.env.development scripts/analysis/11-emit-attack-model.mjs
node --env-file=.env.development scripts/analysis/13-scheduler-shape.mjs
node --env-file=.env.development scripts/analysis/12-faction-choice.mjs
```

`03-hazard.mjs` fits a logistic regression per (variant, evaluated season)
across an hourly-resolution training set and takes noticeably longer to run
than the others -- expect it to run for several minutes.
