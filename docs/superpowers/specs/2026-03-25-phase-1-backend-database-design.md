# Phase 1 — Backend & Database Spec

> Focus: Normalized seasonal data from `get_campaign_status` and `get_snapshots`. Time-series and snapshot tracking deferred to [Phase 2](2026-03-25-phase-2-time-series-snapshots.md).

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

**Array ordering:** `campaign_status`, `attack_events`, and `statistics` arrays are always ordered by enemy index: **0 = Bugs, 1 = Cyborgs, 2 = Illuminate**. The array index IS the enemy ID.

**`introduction_order` and `points_max` from campaign_status:** Each `campaign_status` entry includes `introduction_order` (position in war: 0 = first, 1 = second, 2 = third, 255 = not yet) and `points_max`. These are the same values available from `get_snapshots` as top-level arrays — `get_campaign_status` is sufficient for the current season.

**Cross-season events:** `attack_events` can include events from previous seasons (e.g., season 151's response includes season 150's event_id 883). This is confirmed in production data. The pipeline filters these out by checking `event.season !== currentSeason` — only current-season events are stored in normalized `h1_event` rows. Cross-season events are preserved in `rebroadcast_status.json`.

**`defend_event` vs `defend_events`:** `get_campaign_status` returns a single `defend_event` object (not an array). It does NOT include `players_at_start`. `get_snapshots` returns `defend_events` as an array WITH `players_at_start`.

**`defend_event` nullable:** When no defend event is active, the API may omit `defend_event` or return null. The Zod validator (`isValidStatus.js`) currently requires `defend_event: defendEventSchema` as non-optional — **this must be changed to `.nullable()` or `.optional()`** to avoid crashing the pipeline when no defend event is active. `status.mjs` must guard against null `defend_event`.

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

**`introduction_order` and `points_max` arrays:** Indexed by enemy (0 = Bugs, 1 = Cyborgs, 2 = Illuminate). Same data derivable from `campaign_status` entries.

**`snapshots` array:** Time-series data — deferred to Phase 2. Not stored in Phase 1.

### Table architecture

**Live state** (current season, overwritten every 5-15s poll):
| Table | Source |
|-------|--------|
| `h1_live` | `campaign_status[]` + `statistics[]` + computed map — merged into one table per (season, enemy) |

**Historical** (all seasons, immutable once written):
| Table | Source |
|-------|--------|
| `h1_season` | both endpoints |
| `h1_event` (unified) | both endpoints — defend + attack events |
| `h1_introduction_order` | `campaign_status` (current) or `get_snapshots` (past) |
| `h1_points_max` | `campaign_status` (current) or `get_snapshots` (past) |

**Raw cache:** `rebroadcast_status`, `rebroadcast_snapshot` — raw JSON per season.

**Config:** `App` — version, active_season. No game data.

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
- Event IDs: **NOT globally unique across types.** Season 1 has both defend `event_id: 1` and attack `event_id: 1`. Later seasons use different ranges (defend: 4000s, attack: 800s) but uniqueness is NOT guaranteed. The unique constraint must be `@@unique([type, event_id])`, not `@@unique(event_id)`.

### Changes

**`src/db/queries/upsertEvent.mjs`:**
- Add `type` to both `create` and `update` blocks.
- Add `players_at_start` to both blocks (nullable — not present in `defend_event` from `get_campaign_status`, but present in both event types from `get_snapshots`).
- Upsert by `(type, event_id)` — not just `event_id` (defend and attack events can share the same event_id).
- Replace try/catch with `tryCatch` wrapper per project conventions.
- Fix error message: "defend event is missing" → "event is missing".
- Accept `type` as a parameter: `queryUpsertEvent(season, type, event)`.

**`src/update/status.mjs`:**
- Import `queryUpsertEvent` instead of `queryUpsertDefendEvent` + `queryUpsertAttackEvents`.
- Defend event: `queryUpsertEvent(season, 'defend', fetchedData.defend_event)`. Guard for null `defend_event`. Note: `defend_event` from `get_campaign_status` does NOT include `players_at_start` — the field is nullable in `h1_event`, so this is fine.
- Attack events: map over array, call `queryUpsertEvent(season, 'attack', { ...event, region: 11 })` for each.
- Cross-season events: `queryUpsertEvent` checks `event.season !== season` and returns null for mismatched seasons. This is intentional — matches existing behavior.
- `max_event_id` field on attack events is intentionally discarded — it's metadata about the API response, not event data.
- Also derive and upsert `h1_introduction_order` and `h1_points_max` from `campaign_status` (see API Reference — these values are available per entry).

**`src/update/season.mjs`:**
- Same replacement. Map defend_events with `type: 'defend'`, attack_events with `type: 'attack'` + `region: 11`.

**`prisma/schema.prisma`:**
- Remove `h1_defend_event` and `h1_attack_event` models.
- Remove `defend_events` and `attack_events` relations from `h1_season`.
- Keep `h1_event` and its `events` relation on `h1_season`.
- Change unique constraint from `@@unique(event_id)` to `@@unique([type, event_id])` — event IDs are only unique within type (Season 1 has both defend and attack with event_id 1).
- Add composite indexes to `h1_event`:
```prisma
@@unique([type, event_id])
@@index([season, type])
@@index([season, status])
@@index([season, enemy])
```

**Delete files:**
- `src/db/queries/upsertDefendEvent.mjs`
- `src/db/queries/upsertDefendEvents.mjs`
- `src/db/queries/upsertAttackEvents.mjs`

**Migration:** Backfill `h1_event` from old tables before dropping them:

```sql
INSERT INTO h1_event (id, season, type, event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start)
SELECT id, season, 'defend', event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start
FROM h1_defend_event
ON CONFLICT (type, event_id) DO NOTHING;

INSERT INTO h1_event (id, season, type, event_id, start_time, end_time, region, enemy, points_max, points, status, players_at_start)
SELECT id, season, 'attack', event_id, start_time, end_time, 11, enemy, points_max, points, status, players_at_start
FROM h1_attack_event
ON CONFLICT (type, event_id) DO NOTHING;

DROP TABLE h1_defend_event;
DROP TABLE h1_attack_event;
```

**Deployment safety:** If zero-downtime matters, split into two migrations: (1) backfill + deploy new code, (2) drop old tables after confirming no old containers.

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

---

## 3. Replace `h1_campaign` + `h1_statistic` + `App.map` → `h1_live`

### Problem

`h1_campaign` and `h1_statistic` are current-season-only data overwritten every poll. They can't be populated for past seasons (`get_snapshots` doesn't provide this). `App.map` stores a computed map blob. All three are ephemeral live state mixed in with historical tables and app config.

### Solution

Merge all live current-season state into a single `h1_live` table. One row per (season, enemy). The `App` model stays pure config (version, active_season). No game data in `App`.

### Schema

```prisma
model h1_live {
    id                       String @id @default(uuid(7))
    season                   Int
    enemy                    Int    // 0=Bugs, 1=Cyborgs, 2=Illuminate

    // from campaign_status
    points                   Int
    points_taken             Int
    points_max               Int
    status                   String // 'active', 'defeated', 'hidden'
    introduction_order       Int    // war-entry position (0,1,2,255)

    // from statistics
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

    // computed map data (this faction's 11 regions + homeworld)
    map                      Json?

    linked_season h1_season? @relation("OneSeasonToManyLive", fields: [season], references: [season])

    @@unique([season, enemy])
    @@index([season, enemy])
    @@index([season])
}
```

Also add back-reference to `h1_season`:
```prisma
// in h1_season model:
live h1_live[] @relation("OneSeasonToManyLive")
```

### Map data per faction

Each `h1_live` row's `map` field stores a JSON object for that faction's 11 regions (from `src/enums/map.js`). Each region has: `region`, `capital`, `percent`, `points`, `points_max`, `points_sector`, `points_sector_max`, `status`, `event`.

The map is computed in `status.mjs` when upserting each faction's `h1_live` row:
- Populate `status` and aggregate `points`/`points_max`/`percent` from `campaign_status`.
- For the active `defend_event` (if not null, and matching this enemy): set `event: 'defend'` on the appropriate region.
- For active `attack_events` (filtered to current season, matching this enemy): set `event: 'attack'` on region 11 (homeworld).
- Per-region breakdown (`points_sector`, `points_sector_max`) requires `h1_snapshot.data` — deferred to Phase 2.

Frontend assembles the full map by reading all 3 `h1_live` rows for the active season.

### Pipeline logic (`status.mjs`)

Replace the parallel `queryUpsertCampaigns` + `queryUpsertStatistics` calls with a single loop:

```js
// campaign_status and statistics arrays are both indexed by enemy (0,1,2)
for (let enemy = 0; enemy < 3; enemy++) {
    const campaign = fetchedData.campaign_status[enemy];
    const stats = fetchedData.statistics[enemy];
    const factionMap = computeFactionMap(enemy, campaign, fetchedData.defend_event, fetchedData.attack_events, season);

    await queryUpsertLive(season, enemy, campaign, stats, factionMap);
}
```

### Migration

```sql
-- No data migration needed for h1_live — it's ephemeral and will be populated on next poll.
-- Drop old tables:
DROP TABLE IF EXISTS h1_campaign;
DROP TABLE IF EXISTS h1_statistic;

-- Remove App.map column:
ALTER TABLE "App" DROP COLUMN IF EXISTS map;
```

### Changes

**`prisma/schema.prisma`:**
- Add `h1_live` model.
- Remove `h1_campaign` and `h1_statistic` models.
- Remove `campaigns` and `statistics` relations from `h1_season`.
- Add `live` relation to `h1_season`.
- Remove `map` field from `App` model.

**`src/db/queries/upsertLive.mjs`** — **New**. Upserts one `h1_live` row per (season, enemy) combining campaign + statistics + map data.

**Delete files:**
- `src/db/queries/upsertCampaigns.mjs`
- `src/db/queries/upsertStatistics.mjs`

---

## 4. BigInt serialization fix

### Problem

Prisma returns `BigInt` for 5 statistic fields (`deaths`, `kills`, `accidentals`, `shots`, `hits`). `NextResponse.json()` crashes because `JSON.stringify()` cannot serialize BigInt natively. Values can exceed 2.1B so changing to `Int` is not viable.

### Solution

Replace `NextResponse.json()` in `src/utils/responses.mjs` with manual `JSON.stringify` using a BigInt→Number replacer. Values under 2^53 (~9 quadrillion) convert exactly — well above any Helldivers stat.

No changes to Zod validators (`z.number()` is correct — incoming API data is regular JSON numbers). Prisma handles Number→BigInt coercion on write automatically.

### Changes

**`src/utils/responses.mjs`:**
- Both `errorResponse` and `successResponse`: replace `NextResponse.json(payload, { status })` with:
```js
const body = JSON.stringify(payload, (_, v) => (typeof v === 'bigint' ? Number(v) : v));
return new NextResponse(body, { status, headers: { 'Content-Type': 'application/json' } });
```

---

## 5. Route cleanup

### `/api/h1/rebroadcast` (`src/app/api/h1/rebroadcast/route.js`)

- Replace bare `await` calls with `tryCatch` wrapper (e.g., `queryGetRebroadcastStatus()` and `queryGetRebroadcastSeason()` in the switch/case block).
- The custom `rebroadcastErrorResponse()` format (`error_code`/`error_message`) intentionally mirrors the official Helldivers API — leave as-is, do not convert to `errorResponse()`/`successResponse()`.

### `/api/h1/update` (`src/app/api/h1/update/route.js`)

- No separate map generation call needed — `h1_live` upsert handles it.

### `/api/h1/campaign` (`src/app/api/h1/campaign/route.js`)

- Update to read from `h1_live` instead of `h1_campaign` (or remove if no longer needed).

---

## 6. Seed files for past seasons

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
3. Upsert into `h1_season`, `h1_introduction_order`, `h1_points_max`, `h1_event`

This can run as a `prisma db seed` script or a startup initialization check.

**Seeds do NOT populate `h1_live`** — that table is current-season-only, populated by the live polling loop. Past seasons have no campaign/statistic data.

### Seed vs. Force Refresh

Seed files **bootstrap the app** on first deploy — they get the DB populated without API dependency. They do NOT replace the ability to re-fetch from the API.

**Force refresh** re-fetches any season from the live API on demand (e.g., `/api/h1/update?season=148&force=true`). This uses the existing `updateSeason()` function in `src/update/season.mjs`. Both paths go through the same normalization pipeline. Upserts are idempotent via unique constraints.

---

## Files to modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Drop `h1_defend_event`, `h1_attack_event`, `h1_campaign`, `h1_statistic`. Drop `json` from intro_order/points_max. Drop `map` from `App`. Add `h1_live`. Add indexes to `h1_event`. |
| `src/update/status.mjs` | Switch to `queryUpsertEvent` + `queryUpsertLive`. Derive intro_order/points_max from campaign_status. Guard for null `defend_event`. |
| `src/update/season.mjs` | Switch to `queryUpsertEvent` for defend/attack events. |
| `src/db/queries/upsertEvent.mjs` | Add `type` field, add `players_at_start`, fix error message, use `tryCatch`. |
| `src/db/queries/upsertLive.mjs` | **New** — upsert `h1_live` row per (season, enemy) with campaign + stats + map. |
| `src/db/queries/upsertIntroductionOrder.mjs` | Stop writing `json` field. |
| `src/db/queries/upsertPointsMax.mjs` | Stop writing `json` field. |
| `src/validators/isValidStatus.js` | Make `defend_event` nullable: `defendEventSchema.nullable()`. |
| `src/utils/responses.mjs` | Replace `NextResponse.json()` with `JSON.stringify` + BigInt→Number replacer in both response functions. |
| `src/app/api/h1/rebroadcast/route.js` | Replace bare `await` with `tryCatch`. |

**Delete:**
- `src/db/queries/upsertDefendEvent.mjs`
- `src/db/queries/upsertDefendEvents.mjs`
- `src/db/queries/upsertAttackEvents.mjs`
- `src/db/queries/upsertCampaigns.mjs`
- `src/db/queries/upsertStatistics.mjs`

---

## Verification

1. `npx prisma migrate dev` applies cleanly (including backfill SQL)
2. `npx prisma generate` succeeds
3. `npm run dev` — cron worker triggers `/api/h1/update` without errors
4. `/api/h1/rebroadcast` with `action=get_campaign_status` returns data
5. `/api/h1/rebroadcast` with `action=get_snapshots&season=153` returns data
6. `h1_event` contains all migrated defend + attack events with correct `type` and `region`
7. `h1_live` contains 3 rows (one per faction) with campaign + stats + map data after an update cycle
8. `App` table no longer has `map` column
9. Seed script loads a test season file and populates all historical tables (not `h1_live`)
