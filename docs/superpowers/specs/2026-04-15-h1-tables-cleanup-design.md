---
title: h1_* Tables Cleanup
date: 2026-04-15
status: approved
---

# h1_\* Tables Cleanup

## Summary

Consolidate the data-domain schema from **10 tables** (8 `h1_*` + 2 `rebroadcast_*` caches) down to **5 tables**, eliminate dead columns, drop write-only tables, normalize a stringified-JSON column into proper columns, and adopt a **tumbling-window bucket-upsert pattern** for the timeseries tables that preserves sub-15s homepage freshness while bounding storage to ~120 MB total.

## Motivation

The current schema carries several kinds of accumulated debt:

- **`h1_live_snapshot` is write-only.** It captures 16 statistics fields every 15 minutes but has zero UI/API readers — the only consumers are throttle bootstrap queries in `src/update/snapshotTimers.mjs` and test mocks.
- **`h1_snapshot.data` stores stringified JSON inside a Prisma `Json` column.** Every consumer defensively parses (`typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data`). The shape is a byproduct of the HD1 API wire format, preserved verbatim on write. Postgres can't query into it, storage is inflated, and the Zod validator accepts both parsed and unparsed forms as a defensive union.
- **`h1_live.map` is precomputed per poll but never read.** `computeMapState(data.live, activeEvents)` rebuilds the map from campaign fields + events at request time in three call sites (`src/app/api/h1/live/route.js:20`, `src/app/layout.jsx:66`, `src/app/opengraph-image.jsx:113`). The persisted `map` column is pure write amplification.
- **`h1_introduction_order` and `h1_points_max` are 1:1 ceremony tables.** They hold 3-element arrays that never change within a season and could live as `Int[]` columns directly on `h1_season`.
- **`h1_snapshot` and `h1_live` capture the same measurement from two different API endpoints.** The former from `get_snapshots` (game-server cadence), the latter as the "current" value per poll. Same fields, different sources.
- **`rebroadcast_status` and `rebroadcast_snapshot`** duplicate everything in the normalized tables; their sole purpose is to preserve the raw HD1 wire format for the `/api/h1/rebroadcast` endpoint.
- **`src/update/snapshotTimers.mjs`** carries 91 lines of stateful in-memory throttle tracking with cold-start DB bootstrap and season-change reset logic — all working around the lack of a deterministic bucketing scheme.
- **`h1_event.players_at_start`** can be overwritten with `null` on `get_snapshots` reseeds because `upsertEvent.mjs:47` sets it unconditionally on both create and update paths.

The result of this cleanup is a schema where every table has a clear purpose, every column is read by something, the write path is simpler, and the mental model maps cleanly to "per-season metadata + bucketed timeseries + current event state."

## Goals

1. Reduce table count from **10 tables** (8 `h1_*` + 2 `rebroadcast_*`) to **5 tables total**.
2. Eliminate dead columns (`h1_live.map`), dead tables (`h1_live_snapshot` as currently used), and redundant caches (rebroadcast\_\*).
3. Normalize `h1_snapshot.data` from stringified JSON to typed columns.
4. Adopt a **tumbling-window bucket-upsert pattern** for all timeseries tables that preserves sub-15s homepage freshness with bounded storage (~120 MB total at default bucket size).
5. Replace stateful throttle tracking (`snapshotTimers.mjs`) with deterministic bucket math.
6. Make `BUCKET_SIZE` operator-tunable via environment variable for future storage/resolution tradeoffs.
7. Preserve all existing production data via a pre-migration `pg_dump` backup that feeds a deferred offline reseed script (no in-migration backfill).
8. Fix the `players_at_start` null-overwrite bug on `h1_event` update path.

## Non-goals

- **Not dropping `h1_event`** in favor of a timeseries-only event model. Events are discrete entities with lifecycle (start → progress → resolve); they don't match the "latest-row-equals-current-state" pattern that works for continuous campaign measurement. Keeping `h1_event` mutable is correct for its semantics.
- **Not adding a replay feature.** The deferred MEMORY note about replay is orthogonal — we leave `h1_status` capable of supporting a future replay feature without designing it now.
- **Not changing the `/api/h1/live` URL or `useLiveData` hook** — "live" is a user-facing concept, distinct from the table name.
- **Not updating user-facing UI.** No visible changes to the dashboard or archives beyond "things work the same, just faster/cleaner."
- **Not splitting attack/defend events into separate tables.** The structural fields are identical; the `type` discriminator is sufficient.

## Proposed design

### Final schema: 5 tables

```prisma
model h1_season {
    id                 String    @id @default(uuid(7))
    season             Int       @unique
    last_updated       DateTime?
    introduction_order Int[]     // 3 values, one per faction
    points_max         Int[]     // 3 values, one per faction

    status   h1_status[]
    statistic h1_statistic[]
    events   h1_event[]

    @@index([season])
    @@index([last_updated])
}

model h1_status {
    id           String @id @default(uuid(7))
    season       Int
    enemy        Int    // 0=Bugs, 1=Cyborgs, 2=Illuminate
    bucket       Int    // floor(poll_time / BUCKET_SIZE) * BUCKET_SIZE
    time         Int    // latest poll time within this bucket

    points       Int
    points_taken Int
    status       String // 'hidden' | 'active' | 'defeated'

    linked_season h1_season @relation(fields: [season], references: [season])

    @@unique([season, enemy, bucket])
    @@index([season, bucket])
}

model h1_statistic {
    id                   String @id @default(uuid(7))
    season               Int
    enemy                Int
    bucket               Int
    time                 Int

    players              Int
    total_unique_players Int
    kills                BigInt
    deaths               BigInt

    linked_season h1_season @relation(fields: [season], references: [season])

    @@unique([season, enemy, bucket])
    @@index([season, bucket])
}

model h1_event {
    id               String @id @default(uuid(7))
    season           Int
    type             String // 'attack' | 'defend'
    event_id         Int
    start_time       Int
    end_time         Int
    region           Int
    enemy            Int
    points_max       Int
    points           Int
    status           String
    players_at_start Int?

    linked_season h1_season           @relation(fields: [season], references: [season])
    progress      h1_event_progress[]

    @@unique([type, event_id])
    @@index([season, type])
    @@index([season, status])
    @@index([season, enemy])
}

model h1_event_progress {
    id         String @id @default(uuid(7))
    type       String
    event_id   Int
    bucket     Int
    time       Int

    points     Int    // the progression signal — points_max is constant, lives on h1_event

    linked_event h1_event @relation(fields: [type, event_id], references: [type, event_id])

    @@unique([type, event_id, bucket])
    @@index([type, event_id, bucket])
}
```

### Key properties

- **`h1_season`** absorbs the former `h1_introduction_order` and `h1_points_max` tables as `Int[]` columns. Per-season constants live in one place.
- **`h1_status`** is the unified campaign progression timeseries. Both `get_campaign_status` (every poll, bucket-upsert) and `get_snapshots` (archived season backfill) write here. Absorbs what was `h1_snapshot`.
- **`h1_statistic`** is the population stats timeseries. 4 fields kept (players, total_unique_players, kills, deaths); 12 fields dropped from the original `h1_live_snapshot` (season_duration, missions, successful_missions, total_mission_difficulty, completed_planets, defend_events, successful_defend_events, attack_events, successful_attack_events, accidentals, shots, hits).
- **`h1_event`** is the mutable current/final state of each event. Shape largely unchanged; gains a null-protection fix on the update path.
- **`h1_event_progress`** is the event progression timeseries (points over time). Drops `points_max` (constant, in `h1_event`); no `season` column (derivable via FK).

### The bucket-upsert pattern

Every poll, the worker computes a bucket timestamp:

```
bucket = floor(poll_time / BUCKET_SIZE) * BUCKET_SIZE
```

Then UPSERTs each timeseries row on its `(…, bucket)` unique key. Within an active bucket window, subsequent polls UPDATE the existing row with latest values. When `poll_time` crosses a bucket boundary, a new row is INSERTed.

**Effect:** one row per bucket per entity, not one row per poll. The row's `time` column drifts with each update to reflect the actual latest poll time; the `bucket` column is stable.

**Why two columns:**
- `bucket` is the stable key (deterministic from poll time, never changes for a row).
- `time` is the actual latest poll time (updated every upsert), used by the homepage for "last updated X seconds ago" freshness display.

If we collapsed into one column, we'd either break upsert semantics (time changes every poll) or lose sub-bucket freshness (bucket is rounded). Two columns is ~4 extra bytes and keeps both meanings explicit.

### Shared bucketing helper

```js
// src/update/bucketing.mjs
const DEFAULT_BUCKET_SIZE = 900; // 15 minutes in seconds
const parsed = parseInt(process.env.BUCKET_SIZE ?? '', 10);

export const BUCKET_SIZE =
  Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BUCKET_SIZE;

export function computeBucket(pollTime) {
  return Math.floor(pollTime / BUCKET_SIZE) * BUCKET_SIZE;
}
```

Five lines. Parsed once at module load. All three bucket-upsert query files import `computeBucket` and use the shared constant. Per-table upsert queries stay thin and type-safe (no higher-order factory — Prisma's typed compound keys don't survive that kind of abstraction).

### BUCKET_SIZE env var

Operator-tunable via `BUCKET_SIZE` in `.env`. Default: `900` (15 min).

| `BUCKET_SIZE` | Effective cadence | Rows/season/table | Total storage (2 timeseries tables, 140 seasons) |
| ------------- | ----------------- | ----------------- | ------------------------------------------------- |
| `10`          | every poll        | ~777k             | ~11 GB                                            |
| `60`          | 1 min             | ~130k             | ~1.8 GB                                           |
| `300`         | 5 min             | ~26k              | ~360 MB                                           |
| `900` (default) | 15 min          | ~8.6k             | **~120 MB**                                       |
| `3600`        | 1 hour            | ~2.2k             | ~30 MB                                            |

**Operational note:** changing `BUCKET_SIZE` between deployments means old rows carry bucket values computed with the old size; new rows with the new size. Rows coexist in the same table with mixed granularity. Archive charts would show denser data points before/after the change. Fine for occasional tuning.

Added to `.example.env` with this tradeoff documented.

## Query patterns

### Homepage read (latest bucket per faction)

The worker writes all 3 factions every poll, so in normal operation they share the same latest bucket. In the edge case where factions diverge (e.g. a defeated faction stops getting updates), the query must return each faction's own latest row — not a global top-N by bucket. Use Postgres `DISTINCT ON`:

```js
// src/db/queries/getCampaign.mjs — latest row per faction for current season
const latest = await db.$queryRaw`
  SELECT DISTINCT ON (enemy) *
  FROM h1_status
  WHERE season = ${season}
  ORDER BY enemy ASC, bucket DESC
`;
```

This is the one place the refactor adds a raw SQL call. Prisma's generated client doesn't express `DISTINCT ON` natively, but `$queryRaw` with a template literal is safely parameterized and this query is well-covered by Postgres plan optimization (uses the `(season, enemy, bucket)` unique index directly).

The archives chart can use the standard Prisma `findMany` with ascending order — it reads all rows for the season, no deduplication needed:

```js
const history = await db.h1_status.findMany({
  where: { season },
  orderBy: [{ bucket: 'asc' }, { enemy: 'asc' }],
});
```

### Event progression read (archives)

```js
// Join h1_event for points_max (constant) and event metadata
const events = await db.h1_event.findMany({
  where: { season },
  include: { progress: { orderBy: { bucket: 'asc' } } },
});
```

### Event player-count derivation

Player count at the time of an event is not denormalized into `h1_event_progress`. Consumers range-query `h1_statistic`:

```js
const players = await db.h1_statistic.aggregate({
  where: {
    season,
    enemy,
    time: { gte: event.start_time, lte: event.end_time },
  },
  _avg: { players: true },
});
```

### Rebroadcast reconstruction

The `/api/h1/rebroadcast` endpoints reconstruct the HD1 API wire format from normalized tables. Pseudo-code:

```js
// /api/h1/rebroadcast/status/:season
const season = await db.h1_season.findUnique({ where: { season: s } });
const statusRows = await db.h1_status.findMany({
  where: { season: s },
  orderBy: [{ bucket: 'desc' }, { enemy: 'asc' }],
  take: 3,
});
const statRows = await db.h1_statistic.findMany({
  where: { season: s },
  orderBy: [{ bucket: 'desc' }, { enemy: 'asc' }],
  take: 3,
});
const events = await db.h1_event.findMany({
  where: { season: s, status: 'active' },
});

return {
  time: Math.max(...statusRows.map(r => r.time)),
  error_code: 0,
  campaign_status: statusRows.map(r => ({ ...r, points_max: season.points_max[r.enemy], introduction_order: season.introduction_order[r.enemy] })),
  statistics: statRows.map(r => ({ enemy: r.enemy, players: r.players, ... })),
  defend_event: events.find(e => e.type === 'defend'),
  attack_events: events.filter(e => e.type === 'attack'),
  introduction_order: season.introduction_order,
  points_max: season.points_max,
};
```

~50 lines of mapping code replace the raw JSON caches. Loss of fidelity: the `time` field becomes "latest poll time" rather than the original API response timestamp (negligible). The `error_code` field is always 0 (we only store successful captures).

## Code changes

### Schema — `prisma/schema.prisma`

- Delete models: `h1_live`, `h1_live_snapshot`, `h1_snapshot`, `h1_introduction_order`, `h1_points_max`, `h1_event_snapshot`, `rebroadcast_status`, `rebroadcast_snapshot`
- Add models: `h1_status`, `h1_statistic`, `h1_event_progress`
- Modify `h1_season`: add `introduction_order Int[]` and `points_max Int[]` columns; update relations
- Modify `h1_event`: no field changes, but the relation to `h1_event_snapshot` renames to `h1_event_progress`

### Queries — `src/db/queries/`

New files:
- `bucketing.mjs` → imported, not in queries/ — lives in `src/update/`
- `upsertStatus.mjs` — bucket-upsert for `h1_status`, called from status.mjs
- `upsertStatistic.mjs` — bucket-upsert for `h1_statistic`
- `upsertEventProgress.mjs` — bucket-upsert for `h1_event_progress`

Rename/rewrite:
- `upsertLive.mjs` → deleted (replaced by `upsertStatus.mjs`)
- `createLiveSnapshots.mjs` → deleted (replaced by `upsertStatistic.mjs`)
- `createEventSnapshots.mjs` → deleted (replaced by `upsertEventProgress.mjs`)
- `upsertSnapshots.mjs` → deleted (absorbed into `upsertStatus.mjs` — game-server frames upsert same table with source's timestamp-based bucket)
- `upsertIntroductionOrder.mjs`, `upsertPointsMax.mjs` → deleted (inlined into `upsertSeason.mjs`)
- `rebroadcast.mjs` → deleted (or kept as read-only reconstruction query file, renamed)

Modify:
- `getCampaign.mjs` — select latest bucket per faction from `h1_status`, pull `introduction_order` and `points_max` from `h1_season` directly (not separate tables), remove `map` select, handle columnar h1_status shape. Rename returned field `live` → `status` (or alias for consumer compat).
- `upsertSeason.mjs` — accept and write `introduction_order`/`points_max` arrays
- `upsertEvent.mjs` — **null-protection fix on update path**: `players_at_start` is only set on UPDATE if the incoming value is non-null
- `admin.mjs:241` — update `db.h1_live.count(...)` to `db.h1_status.count(...)` (or equivalent latest-bucket query)

### Worker — `src/update/`

New file:
- `bucketing.mjs` — 5-line shared helper (`BUCKET_SIZE` + `computeBucket`)

Delete files:
- `snapshotTimers.mjs` (~91 lines) — stateful throttle tracking, replaced by deterministic bucket math
- `src/__tests__/unit/update/snapshotTimers.test.mjs` — tests for the deleted module

Modify `status.mjs`:
- Remove `computeFactionMap` helper
- Remove `captureEventSnapshot` helper
- Remove all `shouldTake*` / `recordTimeTaken` calls
- Replace with direct bucket-upsert calls: each poll writes to `h1_status`, `h1_statistic`, and `h1_event_progress` (for active events) via the new query helpers
- Net: ~30–40 LOC removed

Modify `season.mjs`:
- Update to call the new bucket-upsert queries
- Remove `factionMap` argument flow
- Drop the stringified-JSON parsing path (consumers no longer see stringified data)

### Validators — `src/validators/`

- `isValidSeason.mjs` — continue to accept HD1 wire format on input (stringified snapshots array), but the normalization happens in the upsert layer. The dual-form union in the validator can be simplified to "string form only" since that's what the API ships.

### Seeding — `prisma/seed/`

- `fetch-seasons.mjs` — parse `snapshots[].data` stringified JSON on seed load and flatten to the columnar `h1_status` rows (3 rows per frame, one per faction). Seed JSON files on disk stay in HD1 wire format; the seed script does the parse.
- The ~140 season-NNN.json files under `prisma/seed/seasons/` remain as-is (no file-level changes).

### Frontend readers

- `src/features/archives/FactionHealthChart.jsx:27` — drop `typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data` defensive parse. `getCampaign` returns parsed objects directly.
- `src/features/archives/FactionStats.jsx:51` — same
- `src/features/archives/getWarOutcome.mjs:66` — same
- `src/shared/utils/game/computeMapStateAtEvent.mjs:45` — same
- `src/app/layout.jsx:66` — references `data.live` via `computeMapState(data.live, activeEvents)`. Rename to `data.status` (cascade).
- `src/app/api/h1/live/route.js:20` — same rename
- `src/app/opengraph-image.jsx:113` — same rename
- `src/features/notifications/*` — audit for `data.live` references, rename.

### Rebroadcast endpoint

- `src/app/api/h1/rebroadcast/route.js` — rewrite to reconstruct wire format from normalized tables instead of serving cached JSON

### Tests

- Delete `snapshotTimers.test.mjs`
- Update `createLiveSnapshots.test.mjs` → `upsertStatistic.test.mjs` (new shape, new bucket logic)
- Update `createEventSnapshots.test.mjs` → `upsertEventProgress.test.mjs`
- Add `bucketing.test.mjs` — unit tests for `computeBucket` edge cases
- Update integration tests that touch `h1_live` / `h1_live_snapshot` / `h1_snapshot` / `h1_event_snapshot`
- Update Zod validator tests if the union type simplifies

### Docs

- `src/shared/components/DataFlowDiagram/dataFlowDefinition.js` — rewrite Mermaid definition for the new schema
- `src/shared/components/DataFlowDiagram/dataFlowConfig.js` — update table descriptions, remove references to dropped tables
- `/docs/architecture` page — update references
- `/docs/database` page — update references
- `CLAUDE.md` — update table names referenced in the architecture section
- `.example.env` — document `BUCKET_SIZE` with default 900 and storage tradeoff

## Migration strategy

**Export, drop, reseed-later.** A pre-migration `pg_dump` captures the entire database as a safety net. A single destructive Prisma migration then creates the new tables and drops the old ones in one deploy — no in-migration backfill, no multi-phase schema soak. Historical timeseries data is restored later by an offline reseed script that reads from the dump.

The detailed execution runbook (operator commands, verification checks, rollback triggers) lives in `~/.claude/plans/zazzy-inventing-lighthouse.md`. This section captures the strategy at the spec level.

### Step 1: Export production database

Before touching production, run `pg_dump --format=custom --no-owner --no-acl` against prod to produce a compressed, restorable artifact. Verify the dump by restoring it into a throwaway local database and recording row counts for each of the 10 old tables — those numbers are the reference point for validating the later reseed. **Do not run Step 2 until the dump has restored cleanly on a verification DB.** The dump is the only rollback mechanism for the destructive migration.

### Step 2: Destructive schema migration (single deploy)

One Prisma migration that is pure DDL — no `INSERT INTO ... SELECT`, no data transforms, no procedural blocks:

```sql
-- New tables
CREATE TABLE "h1_status"         (...);
CREATE TABLE "h1_statistic"      (...);
CREATE TABLE "h1_event_progress" (...);

-- h1_season augmentation
ALTER TABLE "h1_season"
  ADD COLUMN "introduction_order" INTEGER[],
  ADD COLUMN "points_max"         INTEGER[];

-- Old table drops (FKs cascade)
DROP TABLE "h1_live";
DROP TABLE "h1_live_snapshot";
DROP TABLE "h1_snapshot";
DROP TABLE "h1_event_snapshot";
DROP TABLE "h1_introduction_order";
DROP TABLE "h1_points_max";
DROP TABLE "rebroadcast_status";
DROP TABLE "rebroadcast_snapshot";
```

Generate via `npx prisma migrate dev --name h1_tables_cleanup --create-only`, review the emitted SQL against the checklist (all 8 drops present, unique indexes on the bucket keys, `h1_event_progress → h1_event` FK on `(type, event_id)`), then dry-run on the verification DB before promoting to production.

### Step 3: Code cutover (same release as Step 2)

The schema migration and the code changes **must ship in the same deploy** to avoid a client/DB mismatch window. Contents of the release are scoped in the "Code changes" section below — worker cutover, query-layer rename, frontend cascade rename `data.live` → `data.status`, rebroadcast reconstruction, new `bucketing.mjs` helper, `players_at_start` null-protection fix.

On the first post-deploy poll the worker begins populating `h1_status`, `h1_statistic`, and `h1_event_progress` for the current season. Historical seasons render empty in `/archives` until either (a) `updateSeason()` lazily rehydrates them from the HD1 API when a user visits, or (b) the reseed script bulk-populates them from the dump.

### Step 4: Deferred offline reseed script

A separate, out-of-band Node script (`scripts/backfill-h1-tables.mjs`) reads from the Step 1 dump (restored into a local legacy DB) and writes to the post-migration production database using the standard Prisma client. **Not part of the migration's critical path.** Ships after the cutover is stable.

Key design points:

- **Read side**: raw `pg` client against the restored legacy DB. The legacy schema is gone from `schema.prisma` post-migration, so a second Prisma client would require a second schema file and build target — raw `pg` is simpler for read-only SELECTs.
- **Write side**: production Prisma client, `createMany({ skipDuplicates: true })` for bulk inserts, `@@unique([season, enemy, bucket])` for idempotent re-runs.
- **Bucket dedup in SQL**: `DISTINCT ON (…, bucket) ORDER BY …, time DESC` pushes the work to Postgres and mirrors the going-forward bucket-upsert semantics (keep the latest time within each bucket).
- **JSON parse in Node**: `h1_snapshot.data` is stringified JSON; `JSON.parse` each row, fan into 3 faction rows. Skip-and-log on parse failure; don't throw.
- **Per-season transaction + resumable**: each season wrapped in its own target-DB transaction; on restart, re-derive the checkpoint from `SELECT MAX(season) FROM h1_status` rather than trusting a checkpoint file.
- **Active-season skip**: pass `--to=<currentSeason - 1>`. The worker has been writing fresh current-season rows since the Step 2/3 deploy; backfilling the active season from the (now-stale) dump would overwrite live data.
- **`BUCKET_SIZE` must match production**: if the reseed runs with a different `BUCKET_SIZE` than the worker, the two sets of rows can never collide on their unique keys and archive charts will show a discontinuity. Assert on startup.
- **`h1_event` untouched**: the script must not `upsert` into `h1_event` — that table is unchanged by the migration. Grep the finished script for `h1_event.` and expect zero writes.
- **`--force` destructive refresh**: default mode is fast no-op re-runs (`skipDuplicates`); `--force` deletes target rows for each season before inserting, for recovering from a parse-bug fix.

Operator runbook:

```bash
# After Step 2/3 deploy is stable, restore the backup into a local legacy DB
createdb helldivers_legacy
pg_restore --no-owner --no-acl --dbname=helldivers_legacy /backups/helldivers-h1-pre-cleanup-*.dump

# Run the backfill from a local machine with prod write access
export LEGACY_POSTGRES_URL="postgres://localhost/helldivers_legacy"
export POSTGRES_URL="$PRODUCTION_POSTGRES_URL"
export BUCKET_SIZE=900   # MUST match production worker value
node --experimental-strip-types scripts/backfill-h1-tables.mjs --to=$((CURRENT_SEASON - 1))

# Verify per-season row counts land in production
psql "$POSTGRES_URL" -c "SELECT season, COUNT(*) FROM h1_status GROUP BY season ORDER BY season;"

# Drop the legacy DB when satisfied
dropdb helldivers_legacy
```

## Testing strategy

### Unit tests

- `bucketing.test.mjs` — new. Covers `computeBucket` at bucket boundaries, env var parsing, fallback to default, invalid values.
- `upsertStatus.test.mjs` — new. Covers bucket-upsert semantics: first poll in a bucket inserts, subsequent polls update, bucket-boundary transition inserts new row.
- `upsertStatistic.test.mjs` — new. Same pattern.
- `upsertEventProgress.test.mjs` — new. Same pattern.
- `upsertEvent.test.mjs` — add coverage for the `players_at_start` null-protection fix.
- `getCampaign.test.mjs` — update expectations for latest-bucket selection shape.

### Integration tests

- End-to-end worker poll test: given a mock HD1 API response, verify all 3 timeseries tables get upserted correctly within a bucket and at bucket boundaries.
- Backfill migration test: given fixtures of the old schema with known data, run the migration script and verify the new tables contain the expected rows.
- Rebroadcast reconstruction test: given populated normalized tables, verify `/api/h1/rebroadcast/status/:season` returns a response that validates against the original HD1 wire-format Zod schema.

### Manual verification (post-deploy)

- Homepage loads, shows current faction state, live player count updates within sub-15s of a poll.
- Archives page loads for multiple seasons, FactionHealthChart renders correctly, FactionStats shows correct last-snapshot state.
- Admin refresh of an archived season reseeds correctly.
- Notification system still detects event transitions (started/won/lost).

## Risks and mitigations

### Risk 1: Data loss during the destructive migration
**Mitigation:** The pre-migration `pg_dump` is the single source of truth for historical data, and it must be verified (restored into a throwaway DB with recorded row counts) before Step 2 runs. Dry-run the Prisma migration against the restored-dump DB before applying to production. If the production migration fails or the post-deploy smoke checks fail, restore from the dump. The destructive migration has no per-row rollback path — the dump is the only recovery mechanism, so its integrity is non-negotiable.

### Risk 2: Cascade rename breaks a missed consumer
**Mitigation:** Grep for all `data.live` references before deploy. Build + unit test + e2e test must pass. If something slips through, it'll surface as a runtime error on a specific route, easily rolled back.

### Risk 3: Prisma doesn't express `DISTINCT ON` natively
**Mitigation:** One raw SQL call (`db.$queryRaw`) in `getCampaign.mjs` for the homepage "latest row per faction" read. Safely parameterized via template literal, ~6 lines. Archives reads stay in standard Prisma `findMany` — only the latest-per-group query needs raw SQL. This is a known Prisma limitation; the pattern is well-documented.

### Risk 4: `BUCKET_SIZE` tuning post-deploy creates mixed-granularity history
**Mitigation:** Document the tradeoff in `.example.env`. Tune sparingly. Archive charts render correctly regardless (they plot whatever rows exist).

### Risk 5: Season-transition edge case (covered by existing lastSeasonObserved logic)
**Mitigation:** Existing closing-pass logic in `src/app/api/h1/update/route.js` stays unchanged; it calls `updateSeason(previousSeason)` which now writes to the new `h1_status` table via the bucket-upsert query.

### Risk 6: Event player-count derivation gives imprecise results when throttles don't align
**Mitigation:** At default `BUCKET_SIZE=900`, both `h1_statistic` and `h1_event_progress` use the same bucket cadence, so their timestamps align exactly. Range queries return exact bucket matches. If an operator tunes `BUCKET_SIZE` to different values for different tables (not currently supported), alignment would break — but we don't support per-table sizes.

## Open questions (deferred)

- **Per-table `BUCKET_SIZE` overrides.** Currently all three tables share one env var. If an archives feature later needs h1_statistic at tighter resolution than h1_status, we'd add `STATISTIC_BUCKET_SIZE` etc. Deferred — no concrete need.
- **Replay feature.** MEMORY note about replay feature is still deferred. The schema supports it (h1_status has points/points_taken/status over time), but no UI or API is planned.
- **`players_at_end` on h1_event.** Might be interesting to capture engagement at event close as a scalar. Deferred — no concrete need.
- **Contested region percentage bars.** Separate MEMORY note; deferred to a future archives feature.

## Related work

- MEMORY note: `project_schema_gap.md` — h1_live_snapshot missing campaign fields. **Resolved by this spec** (those fields now live in h1_status).
- MEMORY note: `project_data_sources.md` — "Homepage reads h1_live; /archives reads h1_snapshot. Never mix for new analytics." **Superseded by this spec** (both sources now feed h1_status; the separation of concerns is now by bucket cadence, not by table).
- Existing Git Flow automation — work should land on a feature branch from `develop`.

## Appendix: locked decisions

1. Drop `h1_live` (cache); replaced by `h1_status` (bucket-upsert timeseries, latest row = current state)
2. Drop `h1_live_snapshot`; replaced by `h1_statistic` (4 signal fields, bucket-upsert, 12 noise fields dropped)
3. Drop `h1_snapshot`; absorbed into `h1_status` (same fields, different API source)
4. Drop `h1_introduction_order`; inlined as `Int[]` on `h1_season`
5. Drop `h1_points_max`; inlined as `Int[]` on `h1_season`
6. Drop `h1_event_snapshot`; renamed to `h1_event_progress`, bucket-upsert pattern, `points_max` column removed
7. Drop `rebroadcast_status` + `rebroadcast_snapshot`; wire-format reconstruction on demand
8. Drop `h1_live.map` column; `computeMapState` already rebuilds at request time
9. Cascade rename `data.live` → `data.status` through consumers
10. Bundle `h1_event.players_at_start` null-protection fix
11. Event player count derived from `h1_statistic` at query time (no denormalization into `h1_event_progress`)
12. Pre-migration `pg_dump` backup + destructive single-deploy schema migration + deferred offline reseed script (preserves existing production data via the dump, not via in-migration backfill)
13. Shared `src/update/bucketing.mjs` helper (`BUCKET_SIZE` + `computeBucket`) used by all 3 bucket-upsert queries
14. Delete `snapshotTimers.mjs` and its tests — bucket math replaces stateful throttle tracking
15. Event progression table name: `h1_event_progress` (parent-child clarity with `h1_event`)
16. `BUCKET_SIZE` configurable via env var, default `900` (15 min), documented in `.example.env` with storage tradeoff
17. Keep `h1_event` mutable — events are discrete entities with lifecycle, don't fit the timeseries-only pattern
18. Keep attack and defend events in one `h1_event` table, discriminated by `type` column
19. All three timeseries tables use the same bucket size and column shape (`bucket + time`)
