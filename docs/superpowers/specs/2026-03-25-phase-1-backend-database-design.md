# Phase 1 — Backend & Database Spec

> Focus: `get_campaign_status` and `get_snapshots` data flows only. Other API actions (entitlements, usernames, leaderboards) are deferred.

## API Reference

### `get_campaign_status` response shape

```json
{
    "time": 1774438558,
    "error_code": 0,
    "campaign_status": [
        { "season": 156, "points": 170123, "points_taken": 387515, "points_max": 543480, "status": "active", "introduction_order": 0 }
    ],
    "defend_event": {
        "season": 156, "event_id": 4888, "start_time": 1774425902, "end_time": 1774433161,
        "region": 5, "enemy": 1, "points_max": 502, "points": 502, "status": "success"
    },
    "attack_events": [
        {
            "season": 155, "event_id": 915, "start_time": 1772992682, "end_time": 1773165482,
            "enemy": 0, "points_max": 44933, "points": 22592, "status": "fail",
            "players_at_start": 331, "max_event_id": 915
        }
    ],
    "statistics": [
        {
            "season": 156, "season_duration": 1261959, "enemy": 0, "players": 88,
            "total_unique_players": 14544, "missions": 94795, "successful_missions": 58952,
            "total_mission_difficulty": 283978, "completed_planets": 20589,
            "defend_events": 13, "successful_defend_events": 4,
            "attack_events": 1, "successful_attack_events": 0,
            "deaths": 368138, "kills": 19327247, "accidentals": 90764,
            "shots": 87879653, "hits": 40746802
        }
    ]
}
```

**Cross-season events:** `attack_events` can include events from previous seasons (e.g., season 151's response includes season 150's event_id 883). This is confirmed in production data. The pipeline filters these out by checking `event.season !== currentSeason` — only current-season events are stored in normalized `h1_event` rows. Cross-season events are preserved in `rebroadcast_status.json`.

**`defend_event` vs `defend_events`:** `get_campaign_status` returns a single `defend_event` object (not an array). It does NOT include `players_at_start`. `get_snapshots` returns `defend_events` as an array WITH `players_at_start`.

**`defend_event` nullable:** When no defend event is active, the API may omit `defend_event` or return null. The Zod validator (`isValidStatus.js`) currently requires `defend_event: defendEventSchema` as non-optional — **this must be changed to `.nullable()` or `.optional()`** to avoid crashing the pipeline when no defend event is active. `status.mjs` and `generateMap()` must guard against null `defend_event`.

### `get_snapshots` response shape

```json
{
    "time": 1774438591,
    "error_code": 0,
    "introduction_order": [2, 1, 0],
    "points_max": [30000, 30000, 30000],
    "snapshots": [
        { "season": 1, "time": 1424881142, "data": "[{\"points\":1500,\"points_taken\":0,\"status\":\"hidden\"}]" }
    ],
    "defend_events": [
        { "season": 1, "event_id": 1, "start_time": 1424881201, "end_time": 1424881321, "region": 5, "enemy": 2, "points_max": 48, "points": 48, "status": "success", "players_at_start": 1 }
    ],
    "attack_events": [
        { "season": 1, "event_id": 1, "start_time": 1425099481, "end_time": 1425272281, "enemy": 0, "points_max": 17960, "points": 1265, "status": "success", "players_at_start": 1 }
    ]
}
```

**Snapshot `data` encoding:** The `data` field is a JSON string containing an escaped JSON array. In `h1_snapshot`, this is stored as-is in JSONB (double-encoded). The frontend must `JSON.parse()` the `data` field to get the array of `{points, points_taken, status}` objects per planet.

---

## 1. Unify events → `h1_event`

### Current state

- `h1_defend_event` and `h1_attack_event` tables exist with nearly identical schemas (defend has `region`, attack does not).
- `h1_event` unified table already exists in schema with a `type` field and `region` (comment: "fill out for defend, automatic 11 for attack").
- `h1_event` table is **empty in production** — clean migration, no data to reconcile.
- `queryUpsertEvent.mjs` exists but is **missing the `type` field** in create/update and is **never called** by the pipeline. Error message incorrectly says "defend event is missing".
- `status.mjs` calls `queryUpsertDefendEvent` + `queryUpsertAttackEvents` (separate tables).
- `season.mjs` calls `queryUpsertDefendEvents` + `queryUpsertAttackEvents` (separate tables).

### Production data reference

- `h1_defend_event`: ~600 rows across seasons 1, 2, 6, 148-153. Regions 0-10, all have `players_at_start`.
- `h1_attack_event`: ~30 rows across same seasons. No `region` field. All have `players_at_start`.
- Event IDs: defend events use IDs in the 4000s range (e.g., 4426-4735), attack events use IDs in the 800s range (e.g., 875-898). They are globally unique across types.

### Changes

**`src/db/queries/upsertEvent.mjs`:**
- Add `type` to both `create` and `update` blocks.
- Add `players_at_start` to both blocks (nullable — not present in `defend_event` from `get_campaign_status`, but present in both event types from `get_snapshots`).
- Replace try/catch with `tryCatch` wrapper per project conventions.
- Fix error message: "defend event is missing" → "event is missing".
- Accept `type` as a parameter: `queryUpsertEvent(season, type, event)`.

**`src/update/status.mjs`:**
- Import `queryUpsertEvent` instead of `queryUpsertDefendEvent` + `queryUpsertAttackEvents`.
- Defend event: `queryUpsertEvent(season, 'defend', fetchedData.defend_event)`. Note: `defend_event` from `get_campaign_status` does NOT include `players_at_start` — the field is nullable in `h1_event`, so this is fine.
- Attack events: map over array, call `queryUpsertEvent(season, 'attack', { ...event, region: 11 })` for each.
- Cross-season events: `queryUpsertEvent` checks `event.season !== season` and returns null for mismatched seasons. This is intentional — matches existing behavior. Only current-season events are stored in normalized tables; cross-season events exist in `rebroadcast_*` raw data. **Confirmed in production:** season 151's `rebroadcast_status` includes season 150's event_id 883.
- `max_event_id` field on attack events is intentionally discarded — it's metadata about the API response, not event data.

**`src/update/season.mjs`:**
- Same replacement. Map defend_events with `type: 'defend'`, attack_events with `type: 'attack'` + `region: 11`.

**`prisma/schema.prisma`:**
- Remove `h1_defend_event` and `h1_attack_event` models.
- Remove `defend_events` and `attack_events` relations from `h1_season`.
- Keep `h1_event` and its `events` relation on `h1_season`.

**Delete files:**
- `src/db/queries/upsertDefendEvent.mjs`
- `src/db/queries/upsertDefendEvents.mjs`
- `src/db/queries/upsertAttackEvents.mjs`

**Migration:** `npx prisma migrate dev` to drop old tables. Existing defend/attack event data must be migrated into `h1_event` before dropping old tables (SQL migration script in the Prisma migration file, not a separate script).

**Deployment safety:** The table drops (`DROP TABLE`) should ideally be in a **separate, follow-up migration** after the new code is deployed and confirmed working. During deployment, old containers may still be writing to the old tables. Recommended order:
1. **Migration 1:** Create `h1_event` indexes + new snapshot tables. Backfill `h1_event` from old tables. Deploy new code that writes to `h1_event`.
2. **Migration 2:** (after confirming no old containers are running) Drop `h1_defend_event` and `h1_attack_event`.

If single-migration is acceptable (e.g., zero-downtime is not a concern for this app), use this combined script:

```sql
-- Backfill h1_event from existing split tables
INSERT INTO h1_event (id, season, type, event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start)
SELECT id, season, 'defend', event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start
FROM h1_defend_event
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO h1_event (id, season, type, event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start)
SELECT id, season, 'attack', event_id, start_time, end_time, 11, enemy, points_max, points, status, players_at_start
FROM h1_attack_event
ON CONFLICT (event_id) DO NOTHING;

-- Then drop old tables
DROP TABLE h1_defend_event;
DROP TABLE h1_attack_event;
```

---

## 2. Drop redundant `json` fields

### `h1_introduction_order`

- Currently stores `order Int[]` AND `json Json` — identical data.
- **Production confirms duplication:** `order: "{2,1,0}"` (Postgres array) matches `json: "[2, 1, 0]"` (JSONB) exactly.
- Drop `json` field from schema. `Int[]` is the canonical storage.
- Update `src/db/queries/upsertIntroductionOrder.mjs` to stop writing `json`.

### `h1_points_max`

- Same situation — `points Int[]` AND `json Json` are duplicates.
- **Production confirms:** `points: "{551980,392520,237950}"` matches `json: "[551980, 392520, 237950]"`.
- Drop `json` field from schema.
- Update `src/db/queries/upsertPointsMax.mjs` to stop writing `json`.

### `h1_snapshot`

- Same pattern — stores `data Json` AND `json Json` (schema lines 243-244). Both are JSONB fields containing the snapshot data.
- Drop `json` field from schema. `data` is the canonical storage (already used by the frontend via `JSON.parse()`).
- Update `src/db/queries/upsertSnapshot.mjs` (or equivalent) to stop writing `json`.
- **Migration:** Add `ALTER TABLE h1_snapshot DROP COLUMN json;` to the Prisma migration.

---

## 3. Add `h1_statistic_snapshot` table

### Problem

`h1_statistic` upserts by `(season, enemy)`, overwriting previous values. No way to see how player counts, kills, missions etc. change over the course of a war.

### Schema

```prisma
model h1_statistic_snapshot {
    id                       String @id @default(uuid(7))
    season                   Int
    time                     Int    // unix timestamp of snapshot
    enemy                    Int
    // same fields as h1_statistic:
    season_duration          Int
    players                  Int
    total_unique_players     Int
    missions                 Int
    successful_missions      Int
    total_mission_difficulty Int
    completed_planets        Int
    defend_events            Int
    successful_defend_events Int
    attack_events            Int
    successful_attack_events Int
    deaths                   BigInt
    kills                    BigInt
    accidentals              BigInt
    shots                    BigInt
    hits                     BigInt

    linked_season h1_season? @relation("OneSeasonToManyStatisticSnapshots", fields: [season], references: [season])

    @@unique([season, enemy, time])
    @@index([season, enemy, time])
    @@index([season, time])
}
```

Also add back-reference to `h1_season`:
```prisma
// in h1_season model:
statistic_snapshots h1_statistic_snapshot[] @relation("OneSeasonToManyStatisticSnapshots")
```

### Pipeline logic (`status.mjs`)

After upserting `h1_statistic` (current values), check whether 15 minutes have passed since the last snapshot:

1. Query `h1_statistic_snapshot` for the max `time` where `season = currentSeason`.
2. If no rows exist, or `now - lastTime >= 900` (15 min in seconds): upsert all statistics entries as snapshots with `time = fetchedData.time` (API server timestamp, not `Date.now()`, to avoid clock skew — consistent with how `h1_snapshot` uses the API's `time` field).
3. Otherwise skip.

Use `createMany` with `skipDuplicates: true` (not plain insert) to handle edge cases where the same timestamp appears twice (retries, fast cycles).

New file: `src/db/queries/upsertStatisticSnapshot.mjs`.

### What this captures

- `players` (concurrent per enemy) and `total_unique_players` over time — covers player count tracking.
- Mission success rates, kill counts, accuracy — all trackable as time series.
- Sale event correlation deferred to later phase (needs admin UI).

### BigInt data note

Production data shows some suspiciously large BigInt values (e.g., season 149 enemy 1: `kills: 1,549,314,923`, `accidentals: 1,184,270,328`). This appears to be API-side data corruption, not a schema issue. BigInt fields handle these values correctly. The snapshot table will faithfully record whatever the API returns.

---

## 4. Add `h1_event_snapshot` table

### Problem

Events have `points` that progress toward `points_max` over time, but `h1_event` upsert overwrites. No way to see how a defend event or attack event progressed.

### Schema

```prisma
model h1_event_snapshot {
    id         String   @id @default(uuid(7))
    event_id   Int
    time       Int      // unix timestamp (from API's time field)
    points     Int
    points_max Int

    // No FK relation to h1_event — intentional. event_id is a logical key
    // but events can span seasons and the snapshot table is append-only.
    // Orphan cleanup (if ever needed) can use a periodic job.

    @@unique([event_id, time])
    @@index([event_id, time])
}
```

### Pipeline logic (`status.mjs`)

For active events (defend_event where `status == 'active'`, attack_events where `status == 'active'`):

1. Query `h1_event_snapshot` for the max `time` where `event_id = event.event_id`.
2. If no rows exist, or `now - lastTime >= 600` (10 min): insert snapshot.
3. Otherwise skip.

Use `createMany` with `skipDuplicates: true` (same as `h1_statistic_snapshot`) to handle concurrent polls or retries that produce the same `(event_id, time)` pair. Without this, concurrent polling cycles will crash on the `@@unique([event_id, time])` constraint.

New file: `src/db/queries/upsertEventSnapshot.mjs`.

---

## 5. Composite indexes

Add to `h1_event`:
```prisma
@@index([season, type])
@@index([season, status])
@@index([season, enemy])
```

`h1_statistic_snapshot` and `h1_event_snapshot` indexes are defined in their schema sections above.

---

## 6. Map generation pipeline

### Current state

- `src/enums/map.js` — static map structure: 3 enemies x 11 regions + Super Earth. Each region has `region`, `capital`, `percent`, `points`, `points_max`, `points_sector`, `points_sector_max`, `status`, `event` fields, all zeroed out.
- `App.map` — `Json?` field on the `App` model. **Empty in production** — no existing map data to preserve.
- `App` table uses a single-row pattern (one config row for the entire app).
- **Frontend reads:** After this change, the Map component reads from `App.map` (pre-computed). It no longer queries `h1_campaign` or `h1_event` directly. `h1_campaign` remains written by the pipeline for historical data integrity but is not consumed by the frontend map.

### New file: `src/update/map.mjs`

```js
export function generateMap(introductionOrder, campaigns, defendEvent, attackEvents, season)
```

**Logic:**
1. Deep clone the base map from `src/enums/map.js`.
2. For each campaign in `campaign_status`: resolve the enemy index using the `introduction_order` mapping (see below), then populate `points`, `points_max`, `percent` (calculated as `points / points_max`), `status` on `map[enemy]` aggregate fields. **Note:** `campaign_status` provides aggregate per-faction data, not per-region. Per-region breakdown (`points_sector`, `points_sector_max`) requires data from `h1_snapshot.data` — this is deferred to a later phase. For now, regions inherit the faction-level status/percent.
3. For the active `defend_event` (if not null): set `event: 'defend'` on `map[enemy][region]`. **Guard against null:** `defend_event` can be null when no defend event is active (see API Reference).
4. For active `attack_events`: **filter out cross-season events first** (`event.season === currentSeason`), then set `event: 'attack'` on `map[enemy][11]` (homeworld). Without this filter, stale events from previous seasons would appear on the live map.
5. Return the populated map object.

**`introduction_order` → enemy mapping:**

The `introduction_order` array from `get_snapshots` is indexed by enemy: `introduction_order[enemy] = position`. For example, `[2, 1, 0]` means enemy 0 (Bugs) has position 2, enemy 1 (Cyborgs) has position 1, enemy 2 (Illuminate) has position 0.

Each `campaign_status` entry has an `introduction_order` field which is the position value (0, 1, 2). To find the enemy for a campaign entry:

```js
// introductionOrder = [2, 1, 0] (from h1_introduction_order.order in DB)
// campaign.introduction_order = 0 (position value)
const enemy = introductionOrder.indexOf(campaign.introduction_order);
// enemy = 2 (Illuminate was introduced first, position 0)
```

### Integration in `status.mjs`

The function needs the `introduction_order` array, so either:
- Pass it as a parameter: `generateMap(introductionOrder, campaigns, defendEvent, attackEvents)`
- Read `h1_introduction_order.order` from DB inside `generateMap()`

After all upserts succeed:
```js
const introOrder = await db.h1_introduction_order.findUnique({ where: { season } });
const map = generateMap(
    introOrder.order,
    fetchedData.campaign_status,
    fetchedData.defend_event,   // may be null — generateMap must handle this
    fetchedData.attack_events,
    season                       // needed to filter cross-season attack events
);
await db.app.update({ where: { /* app row */ }, data: { map } });
```

---

## 7. Route cleanup

### `/api/h1/rebroadcast` (`src/app/api/h1/rebroadcast/route.js`)

- Replace bare `await` calls with `tryCatch` wrapper (e.g., `queryGetRebroadcastStatus()` and `queryGetRebroadcastSeason()` in the switch/case block).
- The custom `rebroadcastErrorResponse()` format (`error_code`/`error_message`) intentionally mirrors the official Helldivers API — leave as-is, do not convert to `errorResponse()`/`successResponse()`.

### `/api/h1/update` (`src/app/api/h1/update/route.js`)

- Add map generation call after `updateStatus()` completes (or integrate into `updateStatus()` itself).

### `/api/h1/campaign` (`src/app/api/h1/campaign/route.js`)

- No changes needed — already follows project patterns correctly.

---

## 8. Seed files for past seasons

### Purpose

Historical season data is immutable. Instead of fetching from the API on demand, ship pre-fetched JSON files in the repo.

### Location

`prisma/seed/seasons/*.json` — one file per season, same shape as `get_snapshots` response.

```
prisma/seed/seasons/
  001.json
  002.json
  ...
  155.json
```

### Current state

Only seasons 1, 2, 6, 148-153 have been ingested into the production DB. The remaining ~145 past seasons need to be fetched once from the API and saved as seed files.

### Processing

Seed files use the **same normalization pipeline** as live `get_snapshots` data:
1. Read JSON file
2. Validate with `isValidSeason` Zod schema
3. Upsert into `h1_season`, `h1_introduction_order`, `h1_points_max`, `h1_snapshot`, `h1_event`

This can run as a `prisma db seed` script or a startup initialization check.

**Limitation:** `get_snapshots` does not include `campaign_status` or `statistics`. Seed files therefore cannot populate `h1_campaign`, `h1_statistic`, or `h1_statistic_snapshot`. These tables are only populated by the live `get_campaign_status` polling loop. For past seasons, this data is unavailable — historical stats/campaigns are not part of the snapshot API response. This is acceptable: past season frontends use timeline data from `h1_snapshot` and event data from `h1_event`, not live campaign/statistic tables.

### Seed vs. Force Refresh

Seed files **bootstrap the app** on first deploy — they get the DB populated without API dependency. They do NOT replace the ability to re-fetch from the API.

**Force refresh** re-fetches any season from the live API on demand (e.g., `/api/h1/update?season=148&force=true`). This uses the existing `updateSeason()` function in `src/update/season.mjs`. Use cases:
- Pick up a newly completed season
- Correct corrupted or stale data
- Backfill a season not included in seed files

Both paths go through the same normalization pipeline. Upserts are idempotent via unique constraints — force refresh safely overwrites existing data.

---

## Files to modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Drop `h1_defend_event`, `h1_attack_event`, `json` from intro_order/points_max/snapshot. Add `h1_statistic_snapshot`, `h1_event_snapshot`. Add indexes to `h1_event`. |
| `src/update/status.mjs` | Switch to `queryUpsertEvent`, add snapshot logic, add map generation. Guard for null `defend_event`. |
| `src/update/season.mjs` | Switch to `queryUpsertEvent` for defend/attack events. |
| `src/update/map.mjs` | **New** — `generateMap()` function. Must handle null `defend_event` and filter cross-season `attack_events`. |
| `src/db/queries/upsertEvent.mjs` | Add `type` field, add `players_at_start`, fix error message, use `tryCatch`. |
| `src/db/queries/upsertIntroductionOrder.mjs` | Stop writing `json` field. |
| `src/db/queries/upsertPointsMax.mjs` | Stop writing `json` field. |
| `src/db/queries/upsertSnapshot.mjs` | Stop writing `json` field. |
| `src/db/queries/upsertStatisticSnapshot.mjs` | **New** — insert into `h1_statistic_snapshot` with `skipDuplicates`. |
| `src/db/queries/upsertEventSnapshot.mjs` | **New** — insert into `h1_event_snapshot` with `skipDuplicates`. |
| `src/validators/isValidStatus.js` | Make `defend_event` nullable: `defendEventSchema.nullable()`. |
| `src/app/api/h1/rebroadcast/route.js` | Replace bare `await` with `tryCatch`. |

**Delete:**
- `src/db/queries/upsertDefendEvent.mjs`
- `src/db/queries/upsertDefendEvents.mjs`
- `src/db/queries/upsertAttackEvents.mjs`

---

## Verification

1. `npx prisma migrate dev` applies cleanly (including backfill SQL)
2. `npx prisma generate` succeeds
3. `npm run dev` — cron worker triggers `/api/h1/update` without errors
4. `/api/h1/rebroadcast` with `action=get_campaign_status` returns data
5. `/api/h1/rebroadcast` with `action=get_snapshots&season=153` returns data
6. `h1_event` contains all migrated defend + attack events with correct `type` and `region`
7. After 15+ min, `h1_statistic_snapshot` has rows
8. During an active event, `h1_event_snapshot` has progress rows
9. `App.map` contains populated map JSON after an update cycle
10. Seed script loads a test season file and populates all normalized tables
