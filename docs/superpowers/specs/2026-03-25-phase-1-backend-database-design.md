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

---

## 1. Unify events → `h1_event`

### Current state

- `h1_defend_event` and `h1_attack_event` tables exist with nearly identical schemas (defend has `region`, attack does not).
- `h1_event` unified table already exists in schema with a `type` field and `region` (comment: "fill out for defend, automatic 11 for attack").
- `queryUpsertEvent.mjs` exists but is **missing the `type` field** in create/update and is **never called** by the pipeline.
- `status.mjs` calls `queryUpsertDefendEvent` + `queryUpsertAttackEvents` (separate tables).
- `season.mjs` calls `queryUpsertDefendEvents` + `queryUpsertAttackEvents` (separate tables).

### Changes

**`src/db/queries/upsertEvent.mjs`:**
- Add `type` to both `create` and `update` blocks.
- Replace try/catch with `tryCatch` wrapper per project conventions.
- Accept `type` as a parameter: `queryUpsertEvent(season, type, event)`.

**`src/update/status.mjs`:**
- Import `queryUpsertEvent` instead of `queryUpsertDefendEvent` + `queryUpsertAttackEvents`.
- Defend event: `queryUpsertEvent(season, 'defend', fetchedData.defend_event)`. Note: `defend_event` from `get_campaign_status` does NOT include `players_at_start` — the field is nullable in `h1_event`, so this is fine.
- Attack events: map over array, call `queryUpsertEvent(season, 'attack', { ...event, region: 11 })` for each.
- Cross-season events: `queryUpsertEvent` checks `event.season !== season` and returns null for mismatched seasons. This is intentional — matches existing behavior. Only current-season events are stored in normalized tables; cross-season events exist in `rebroadcast_*` raw data.
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

**Migration:** `npx prisma migrate dev` to drop old tables. No backfill — raw data preserved in `rebroadcast_*` tables.

---

## 2. Drop redundant `json` fields

### `h1_introduction_order`

- Currently stores `order Int[]` AND `json Json` — identical data (e.g., `[2, 1, 0]`).
- Drop `json` field from schema. `Int[]` is the canonical storage.
- Update `src/db/queries/upsertIntroductionOrder.mjs` to stop writing `json`.

### `h1_points_max`

- Same situation — `points Int[]` AND `json Json` are duplicates.
- Drop `json` field from schema.
- Update `src/db/queries/upsertPointsMax.mjs` to stop writing `json`.

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

- `src/enums/map.js` — static map structure: 3 enemies x 11 regions + Super Earth. Each region has `region`, `capital`, `percent`, `points`, `points_max`, `status`, `event` fields, all zeroed out.
- `App.map` — `Json?` field on the `App` model. Exists but never written to.

### New file: `src/update/map.mjs`

```js
export function generateMap(campaigns, defendEvent, attackEvents)
```

**Logic:**
1. Deep clone the base map from `src/enums/map.js`.
2. For each campaign in `campaign_status`: resolve the enemy index using the `introduction_order` mapping (see below), then populate `points`, `points_taken`, `points_max`, `percent` (calculated), `status` on `map[enemy]` regions.
3. For the active `defend_event`: set `event: 'defend'` on `map[enemy][region]`.
4. For active `attack_events`: set `event: 'attack'` on `map[enemy][11]` (homeworld).
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
const map = generateMap(introOrder.order, fetchedData.campaign_status, fetchedData.defend_event, fetchedData.attack_events);
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

## Files to modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Drop `h1_defend_event`, `h1_attack_event`, `json` from intro_order/points_max. Add `h1_statistic_snapshot`, `h1_event_snapshot`. Add indexes to `h1_event`. |
| `src/update/status.mjs` | Switch to `queryUpsertEvent`, add snapshot logic, add map generation. |
| `src/update/season.mjs` | Switch to `queryUpsertEvent` for defend/attack events. |
| `src/update/map.mjs` | **New** — `generateMap()` function. |
| `src/db/queries/upsertEvent.mjs` | Add `type` field, use `tryCatch`. |
| `src/db/queries/upsertIntroductionOrder.mjs` | Stop writing `json` field. |
| `src/db/queries/upsertPointsMax.mjs` | Stop writing `json` field. |
| `src/db/queries/upsertStatisticSnapshot.mjs` | **New** — insert into `h1_statistic_snapshot`. |
| `src/db/queries/upsertEventSnapshot.mjs` | **New** — insert into `h1_event_snapshot`. |
| `src/app/api/h1/rebroadcast/route.js` | Replace bare `await` with `tryCatch`. |

**Delete:**
- `src/db/queries/upsertDefendEvent.mjs`
- `src/db/queries/upsertDefendEvents.mjs`
- `src/db/queries/upsertAttackEvents.mjs`

---

## Verification

1. `npx prisma migrate dev` applies cleanly
2. `npx prisma generate` succeeds
3. `npm run dev` — cron worker triggers `/api/h1/update` without errors
4. `/api/h1/rebroadcast` with `action=get_campaign_status` returns data
5. `/api/h1/rebroadcast` with `action=get_snapshots&season=156` returns data
6. After 15+ min, `h1_statistic_snapshot` has rows
7. During an active event, `h1_event_snapshot` has progress rows
8. `App.map` contains populated map JSON after an update cycle
