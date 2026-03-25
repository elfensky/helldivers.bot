# Phase 2 — Time-Series & Snapshot Data

> Deferred from Phase 1. Depends on Phase 1 normalized tables being complete.

---

## 1. `h1_snapshot` (existing table — populate from `get_snapshots`)

### Problem

`h1_snapshot` exists in the schema but stores per-planet campaign progress over time from the `get_snapshots` API. This is time-series data — many rows per season, each a point-in-time sample.

### Current state

- Table exists with `data Json` and `json Json` fields (both JSONB, redundant).
- Phase 1 drops the redundant `json` field.
- Data exists for seasons 1, 2, 6, 148-153.

### Pipeline

Populated by `get_snapshots` (polled ~1h for current season, or fetched once for past seasons via seed files / force refresh). Each snapshot row contains:
- `season` (FK to `h1_season`)
- `time` (unix timestamp)
- `data` (JSON string of per-planet `{points, points_taken, status}` array)

Frontend must `JSON.parse()` the `data` field to get the array.

---

## 2. Add `h1_statistic_snapshot` table

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

## 3. Add `h1_event_snapshot` table

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

Use `createMany` with `skipDuplicates: true` to handle concurrent polls or retries that produce the same `(event_id, time)` pair. Without this, concurrent polling cycles will crash on the `@@unique([event_id, time])` constraint.

New file: `src/db/queries/upsertEventSnapshot.mjs`.