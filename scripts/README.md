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
