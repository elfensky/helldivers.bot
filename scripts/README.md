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

# the three report scripts -- all need POSTGRES_URL (DB required)
node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs
node --env-file=.env.development scripts/analysis/02-baseline.mjs
node --env-file=.env.development scripts/analysis/03-hazard.mjs
```

`03-hazard.mjs` fits a logistic regression per (variant, evaluated season)
across an hourly-resolution training set and takes noticeably longer to run
than the other two -- expect it to run for several minutes.
