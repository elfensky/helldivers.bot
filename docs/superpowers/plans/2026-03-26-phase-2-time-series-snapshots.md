# Phase 2 — Time-Series Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add snapshot capture for statistics and event progress so time-series data is preserved instead of overwritten each poll cycle.

**Architecture:** Two new append-only tables (`h1_live_snapshot`, `h1_event_snapshot`) are populated by the existing `status.mjs` polling pipeline. A throttle check (in-memory timer, DB fallback on cold start) prevents snapshots from firing every 20-second poll. The existing `h1_snapshot` table gets its redundant `json` column dropped as a Phase 1 cleanup prerequisite.

**Tech Stack:** Prisma 7 (@prisma/adapter-pg), PostgreSQL, Zod validation, `tryCatch` wrapper pattern.

---

## File Structure

| File                                                          | Action | Responsibility                                                                                                            |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                        | Modify | Add `h1_live_snapshot` and `h1_event_snapshot` models, add back-references to `h1_season`, drop `json` from `h1_snapshot` |
| `prisma/migrations/YYYYMMDD_phase2_time_series/migration.sql` | Create | SQL migration for new tables + drop h1_snapshot.json                                                                      |
| `src/db/queries/createLiveSnapshots.mjs`                      | Create | Insert statistic snapshots from h1_live data                                                                              |
| `src/db/queries/createEventSnapshots.mjs`                     | Create | Insert event progress snapshots                                                                                           |
| `src/update/status.mjs`                                       | Modify | Wire snapshot capture after h1_live upsert (step 8) and after event upsert (step 6)                                       |
| `src/update/snapshotTimers.mjs`                               | Create | In-memory throttle state + cold-start DB seed                                                                             |
| `src/db/queries/upsertSnapshots.mjs`                          | Modify | Remove `json` field from upsert, fix error cause string, convert to tryCatch                                              |
| `src/update/fetch.mjs`                                        | Modify | Uncomment `throw error` in `fetchStatus()`                                                                                |
| `src/validators/isValidStatus.js`                             | Modify | Add timestamp range validation                                                                                            |
| `docs/TODO.md`                                                | Modify | Update Phase 2 checklist                                                                                                  |

---

## Task 1: Fix `fetchStatus()` silent error swallowing

**Why:** `fetchStatus()` catches errors and returns `undefined` instead of throwing. This causes confusing downstream failures and will make snapshot debugging impossible.

**Files:**

- Modify: `src/update/fetch.mjs:51-62`

- [ ] **Step 1: Fix `fetchStatus()` to propagate errors**

In `src/update/fetch.mjs`, replace the `fetchStatus` function:

```js
export async function fetchStatus() {
    const url = getApiURL();
    const form = new FormData();
    form.append('action', 'get_campaign_status');
    return fetchInvalidHttps(url, form);
}
```

This removes the try/catch entirely — errors propagate to `tryCatch()` in `status.mjs` where they're already handled.

- [ ] **Step 2: Verify the app still starts and polls**

Run: `npm run dev`
Check worker logs — should see normal update cycle. If the API is unreachable, the error message should now be the actual axios error, not "Invalid status data".

- [ ] **Step 3: Commit**

```bash
git add src/update/fetch.mjs
git commit -m "fix: propagate fetchStatus() errors instead of swallowing them"
```

---

## Task 2: Add timestamp range validation to Zod schema

**Why:** The API `time` field is validated only as `z.number()`. A zero, negative, or far-future timestamp would break snapshot interval logic (either creating snapshots every poll or halting them permanently).

**Files:**

- Modify: `src/validators/isValidStatus.js:58-59`

- [ ] **Step 1: Add range validation**

In `src/validators/isValidStatus.js`, change the `time` field in `rootSchema`:

```js
const rootSchema = z.object({
    time: z.number().int().min(1000000000).max(2000000000),
    error_code: z.number(),
    campaign_status: z.array(campaignStatusSchema),
    defend_event: defendEventSchema.nullable(),
    attack_events: z.array(attackEventSchema),
    statistics: z.array(statisticsSchema),
});
```

This accepts Unix timestamps from 2001-09-09 through 2033-05-18.

- [ ] **Step 2: Commit**

```bash
git add src/validators/isValidStatus.js
git commit -m "fix: add timestamp range validation to status Zod schema"
```

---

## Task 3: Drop `h1_snapshot.json` column (Phase 1 gap)

**Why:** The Phase 1 migration dropped `json` from `h1_introduction_order` and `h1_points_max` but missed `h1_snapshot`. The schema still declares it and `upsertSnapshots.mjs` still writes to it. This must be cleaned up before Phase 2 adds more snapshot logic.

**Files:**

- Modify: `prisma/schema.prisma:215-228`
- Create: `prisma/migrations/20260326000001_drop_snapshot_json/migration.sql`
- Modify: `src/db/queries/upsertSnapshots.mjs`

- [ ] **Step 1: Remove `json` field from Prisma schema**

In `prisma/schema.prisma`, change the `h1_snapshot` model:

```prisma
model h1_snapshot {
    id            String    @id @default(uuid(7))
    season        Int //foreign key //multiple snapshots per season, hence NOT unique. enforces one-to-many relationship
    time          Int //original value
    data          Json //data field
    //relationship
    linked_season h1_season @relation("OneSeasonToManySnapshots", fields: [season], references: [season])

    //indexes
    @@unique([season, time]) //unique
    @@index([season]) //index
}
```

Note: also remove the redundant `@@index([season, time])` since `@@unique([season, time])` already creates an index.

- [ ] **Step 2: Create migration SQL**

Create `prisma/migrations/20260326000001_drop_snapshot_json/migration.sql`:

```sql
-- Drop redundant json column from h1_snapshot (Phase 1 gap)
ALTER TABLE "h1_snapshot" DROP COLUMN IF EXISTS "json";

-- Drop redundant index (unique constraint already covers this)
DROP INDEX IF EXISTS "h1_snapshot_season_time_idx";
```

- [ ] **Step 3: Update `upsertSnapshots.mjs` — remove `json` field and convert to tryCatch**

Replace the entire file `src/db/queries/upsertSnapshots.mjs`:

```js
import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertSnapshots(season, snapshots) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!snapshots) throw new Error('snapshots are missing');

    const upsertRecords = [];
    let skipped = false;

    for (const snapshot of snapshots) {
        if (snapshot?.season !== season) {
            skipped = true;
            continue;
        }

        const { data: upsertRecord, error } = await tryCatch(
            db.h1_snapshot.upsert({
                where: {
                    season_time: {
                        season: season,
                        time: snapshot.time,
                    },
                },
                update: {
                    data: snapshot.data,
                },
                create: {
                    season: season,
                    time: snapshot.time,
                    data: snapshot.data,
                },
            }),
        );

        if (error) throw error;

        upsertRecords.push(upsertRecord);
        skipped = false;
    }

    return {
        ms: performanceTime(start),
        query: upsertRecords || skipped,
    };
}
```

Changes: removed `json` from upsert/create, converted from raw try/catch to `tryCatch` wrapper, fixed error cause string.

- [ ] **Step 4: Regenerate Prisma client**

Run: `npx prisma generate`

Verify no errors and that `src/generated/prisma/` is updated.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260326000001_drop_snapshot_json/ src/db/queries/upsertSnapshots.mjs src/generated/prisma/
git commit -m "fix: drop redundant json column from h1_snapshot, remove duplicate index"
```

---

## Task 4: Add `h1_live_snapshot` table

**Why:** `h1_live` upserts by `(season, enemy)`, overwriting previous values. This table captures statistics at 15-minute intervals so player counts, kills, missions etc. are tracked as time series.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260326000002_add_live_snapshot/migration.sql`

- [ ] **Step 1: Add model to Prisma schema**

Add after the `h1_live` model in `prisma/schema.prisma`:

```prisma
model h1_live_snapshot {
    id                       String @id @default(uuid(7))
    season                   Int
    time                     Int    // unix timestamp from API response
    enemy                    Int    // 0=Bugs, 1=Cyborgs, 2=Illuminate

    // statistics fields (from fetchedData.statistics[enemy])
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

    linked_season h1_season? @relation("OneSeasonToManyLiveSnapshots", fields: [season], references: [season])

    @@unique([season, enemy, time])
    @@index([season, time])
}
```

Key decisions:

- Named `h1_live_snapshot` (not `h1_statistic_snapshot`) because the source table is `h1_live`, not the dropped `h1_statistic`.
- No `@@index([season, enemy, time])` — the `@@unique` already creates that index.
- `@@index([season, time])` is kept — useful for cross-faction queries ("all stats for season X in time range").
- Campaign fields (`points`, `points_max`, `status`, `map`) are excluded because `h1_snapshot` already captures per-planet campaign progress as time series.
- `season_duration` IS included — it comes from `fetchedData.statistics[enemy].season_duration` and exists in the API response even though it was removed from the original Phase 2 spec's discussion. Confirmed via `isValidStatus.js:39`.

- [ ] **Step 2: Add back-reference to `h1_season`**

In the `h1_season` model, add:

```prisma
    live_snapshots     h1_live_snapshot[]     @relation("OneSeasonToManyLiveSnapshots")
```

Add this after the existing `live` relation line.

- [ ] **Step 3: Create migration SQL**

Create `prisma/migrations/20260326000002_add_live_snapshot/migration.sql`:

```sql
-- Create h1_live_snapshot table for time-series statistics
CREATE TABLE "h1_live_snapshot" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "time" INTEGER NOT NULL,
    "enemy" INTEGER NOT NULL,
    "season_duration" INTEGER NOT NULL,
    "players" INTEGER NOT NULL,
    "total_unique_players" INTEGER NOT NULL,
    "missions" INTEGER NOT NULL,
    "successful_missions" INTEGER NOT NULL,
    "total_mission_difficulty" INTEGER NOT NULL,
    "completed_planets" INTEGER NOT NULL,
    "defend_events" INTEGER NOT NULL,
    "successful_defend_events" INTEGER NOT NULL,
    "attack_events" INTEGER NOT NULL,
    "successful_attack_events" INTEGER NOT NULL,
    "deaths" BIGINT NOT NULL,
    "kills" BIGINT NOT NULL,
    "accidentals" BIGINT NOT NULL,
    "shots" BIGINT NOT NULL,
    "hits" BIGINT NOT NULL,

    CONSTRAINT "h1_live_snapshot_pkey" PRIMARY KEY ("id")
);

-- Unique constraint (also serves as the primary lookup index)
CREATE UNIQUE INDEX "h1_live_snapshot_season_enemy_time_key" ON "h1_live_snapshot"("season", "enemy", "time");

-- Cross-faction time range queries
CREATE INDEX "h1_live_snapshot_season_time_idx" ON "h1_live_snapshot"("season", "time");

-- Foreign key to h1_season
ALTER TABLE "h1_live_snapshot" ADD CONSTRAINT "h1_live_snapshot_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerate Prisma client**

Run: `npx prisma generate`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260326000002_add_live_snapshot/ src/generated/prisma/
git commit -m "feat: add h1_live_snapshot table for time-series statistics"
```

---

## Task 5: Add `h1_event_snapshot` table

**Why:** `h1_event` upserts overwrite event progress. This table captures `(points, points_max)` at 10-minute intervals so event progression can be charted.

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260326000003_add_event_snapshot/migration.sql`

- [ ] **Step 1: Add model to Prisma schema**

Add after `h1_live_snapshot` in `prisma/schema.prisma`:

```prisma
model h1_event_snapshot {
    id         String @id @default(uuid(7))
    season     Int    // denormalized for efficient per-season queries
    type       String // 'attack' or 'defend' — enables FK to h1_event
    event_id   Int
    time       Int    // unix timestamp from API response
    points     Int
    points_max Int

    // FK to h1_event via (type, event_id) compound key
    linked_event h1_event? @relation("OneEventToManySnapshots", fields: [type, event_id], references: [type, event_id])
    linked_season h1_season? @relation("OneSeasonToManyEventSnapshots", fields: [season], references: [season])

    @@unique([type, event_id, time])
    @@index([season, time])
    @@index([event_id, time])
}
```

Key decisions from the debate:

- **`season` column added** (denormalized) — enables efficient "all event snapshots for season 153" queries needed by War History page (Phase 8). Without it, you'd need a full table scan + join.
- **`type` column added** — enables a proper FK to `h1_event` via `(type, event_id)`. The original spec omitted the FK claiming "events can span seasons" but they don't (`upsertEvent.mjs:15` skips cross-season events). The real blocker was that `event_id` alone isn't unique in `h1_event` — adding `type` solves that.
- **Unique on `(type, event_id, time)`** not `(event_id, time)` — because `event_id` is only unique within a type.
- **`points_max` kept per row** — KISS principle. Self-contained rows avoid JOINs for the most common query (charting progress). Negligible storage cost.

- [ ] **Step 2: Add back-references**

In `h1_event` model, add:

```prisma
    snapshots h1_event_snapshot[] @relation("OneEventToManySnapshots")
```

In `h1_season` model, add:

```prisma
    event_snapshots    h1_event_snapshot[]    @relation("OneSeasonToManyEventSnapshots")
```

- [ ] **Step 3: Create migration SQL**

Create `prisma/migrations/20260326000003_add_event_snapshot/migration.sql`:

```sql
-- Create h1_event_snapshot table for event progress tracking
CREATE TABLE "h1_event_snapshot" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "event_id" INTEGER NOT NULL,
    "time" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "points_max" INTEGER NOT NULL,

    CONSTRAINT "h1_event_snapshot_pkey" PRIMARY KEY ("id")
);

-- Unique constraint (prevents duplicate snapshots for same event at same time)
CREATE UNIQUE INDEX "h1_event_snapshot_type_event_id_time_key" ON "h1_event_snapshot"("type", "event_id", "time");

-- Per-season time range queries (War History page)
CREATE INDEX "h1_event_snapshot_season_time_idx" ON "h1_event_snapshot"("season", "time");

-- Per-event time range queries (event detail charts)
CREATE INDEX "h1_event_snapshot_event_id_time_idx" ON "h1_event_snapshot"("event_id", "time");

-- Foreign key to h1_event
ALTER TABLE "h1_event_snapshot" ADD CONSTRAINT "h1_event_snapshot_type_event_id_fkey" FOREIGN KEY ("type", "event_id") REFERENCES "h1_event"("type", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign key to h1_season
ALTER TABLE "h1_event_snapshot" ADD CONSTRAINT "h1_event_snapshot_season_fkey" FOREIGN KEY ("season") REFERENCES "h1_season"("season") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerate Prisma client**

Run: `npx prisma generate`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260326000003_add_event_snapshot/ src/generated/prisma/
git commit -m "feat: add h1_event_snapshot table for event progress tracking"
```

---

## Task 6: Create in-memory snapshot throttle

**Why:** The polling pipeline runs every ~20 seconds. Snapshot writes should happen at 15-min (stats) and 10-min (events) intervals. Querying `MAX(time)` from the DB every poll cycle is wasteful. An in-memory timer with DB fallback on cold start eliminates this overhead.

**Files:**

- Create: `src/update/snapshotTimers.mjs`

- [ ] **Step 1: Create the throttle module**

Create `src/update/snapshotTimers.mjs`:

```js
'use server';
import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';

// In-memory last-snapshot timestamps. Keyed by type.
// Seeded from DB on first check, updated in memory after each write.
let lastLiveSnapshotTime = null;
const lastEventSnapshotTimes = new Map(); // key: `${type}:${event_id}`, value: time

const LIVE_SNAPSHOT_INTERVAL = 900; // 15 minutes in seconds
const EVENT_SNAPSHOT_INTERVAL = 600; // 10 minutes in seconds

/**
 * Check if enough time has passed to take a live snapshot.
 * On first call (cold start), queries DB for the last snapshot time.
 * Returns true if a snapshot should be taken.
 */
export async function shouldTakeLiveSnapshot(season, apiTime) {
    if (lastLiveSnapshotTime === null) {
        // Cold start: seed from DB
        const { data: row, error } = await tryCatch(
            db.h1_live_snapshot.findFirst({
                where: { season },
                orderBy: { time: 'desc' },
                select: { time: true },
            }),
        );
        if (error) throw error;
        lastLiveSnapshotTime = row?.time ?? 0;
    }

    return apiTime - lastLiveSnapshotTime >= LIVE_SNAPSHOT_INTERVAL;
}

/**
 * Update the in-memory timer after a successful live snapshot write.
 */
export function recordLiveSnapshotTime(time) {
    lastLiveSnapshotTime = time;
}

/**
 * Check if enough time has passed to take an event snapshot.
 * On first call per event (cold start), queries DB.
 * Returns true if a snapshot should be taken.
 */
export async function shouldTakeEventSnapshot(type, eventId, apiTime) {
    const key = `${type}:${eventId}`;

    if (!lastEventSnapshotTimes.has(key)) {
        // Cold start: seed from DB
        const { data: row, error } = await tryCatch(
            db.h1_event_snapshot.findFirst({
                where: { type, event_id: eventId },
                orderBy: { time: 'desc' },
                select: { time: true },
            }),
        );
        if (error) throw error;
        lastEventSnapshotTimes.set(key, row?.time ?? 0);
    }

    return apiTime - lastEventSnapshotTimes.get(key) >= EVENT_SNAPSHOT_INTERVAL;
}

/**
 * Update the in-memory timer after a successful event snapshot write.
 */
export function recordEventSnapshotTime(type, eventId, time) {
    const key = `${type}:${eventId}`;
    lastEventSnapshotTimes.set(key, time);
}

/**
 * Reset all timers. Called if season changes.
 */
export function resetSnapshotTimers() {
    lastLiveSnapshotTime = null;
    lastEventSnapshotTimes.clear();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/update/snapshotTimers.mjs
git commit -m "feat: add in-memory snapshot throttle with DB cold-start fallback"
```

---

## Task 7: Create `createLiveSnapshots.mjs` query

**Why:** This is the DB write function for statistic snapshots. Uses `upsert` (not `createMany` with `skipDuplicates`) per the debate finding that `skipDuplicates` silently drops legitimate data when timestamps collide.

**Files:**

- Create: `src/db/queries/createLiveSnapshots.mjs`

- [ ] **Step 1: Create the query file**

Create `src/db/queries/createLiveSnapshots.mjs`:

```js
import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

/**
 * Insert live statistic snapshots for all 3 enemy factions.
 * Uses upsert to update if the same (season, enemy, time) already exists
 * (handles retries without silent data loss).
 *
 * @param {number} season - Current season number
 * @param {number} time - API server timestamp (fetchedData.time)
 * @param {Array} statistics - fetchedData.statistics array (3 entries, one per enemy)
 */
export async function queryCreateLiveSnapshots(season, time, statistics) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!time) throw new Error('time is missing');
    if (!statistics) throw new Error('statistics are missing');

    const results = [];

    for (const stats of statistics) {
        const enemy = stats.enemy;
        const { data: record, error } = await tryCatch(
            db.h1_live_snapshot.upsert({
                where: {
                    season_enemy_time: {
                        season: season,
                        enemy: enemy,
                        time: time,
                    },
                },
                update: {
                    season_duration: stats.season_duration,
                    players: stats.players,
                    total_unique_players: stats.total_unique_players,
                    missions: stats.missions,
                    successful_missions: stats.successful_missions,
                    total_mission_difficulty: stats.total_mission_difficulty,
                    completed_planets: stats.completed_planets,
                    defend_events: stats.defend_events,
                    successful_defend_events: stats.successful_defend_events,
                    attack_events: stats.attack_events,
                    successful_attack_events: stats.successful_attack_events,
                    deaths: stats.deaths,
                    kills: stats.kills,
                    accidentals: stats.accidentals,
                    shots: stats.shots,
                    hits: stats.hits,
                },
                create: {
                    season: season,
                    time: time,
                    enemy: enemy,
                    season_duration: stats.season_duration,
                    players: stats.players,
                    total_unique_players: stats.total_unique_players,
                    missions: stats.missions,
                    successful_missions: stats.successful_missions,
                    total_mission_difficulty: stats.total_mission_difficulty,
                    completed_planets: stats.completed_planets,
                    defend_events: stats.defend_events,
                    successful_defend_events: stats.successful_defend_events,
                    attack_events: stats.attack_events,
                    successful_attack_events: stats.successful_attack_events,
                    deaths: stats.deaths,
                    kills: stats.kills,
                    accidentals: stats.accidentals,
                    shots: stats.shots,
                    hits: stats.hits,
                },
            }),
        );

        if (error) throw error;
        results.push(record);
    }

    return { ms: performanceTime(start), query: results };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db/queries/createLiveSnapshots.mjs
git commit -m "feat: add createLiveSnapshots query for statistic time-series"
```

---

## Task 8: Create `createEventSnapshots.mjs` query

**Why:** This is the DB write function for event progress snapshots. Captures both active events and events that just transitioned to a terminal state (to avoid losing the final data point).

**Files:**

- Create: `src/db/queries/createEventSnapshots.mjs`

- [ ] **Step 1: Create the query file**

Create `src/db/queries/createEventSnapshots.mjs`:

```js
import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

/**
 * Insert a single event snapshot.
 * Uses upsert to update if the same (type, event_id, time) already exists.
 *
 * @param {number} season - Current season number
 * @param {string} type - 'defend' or 'attack'
 * @param {object} event - Event object with event_id, points, points_max
 * @param {number} time - API server timestamp (fetchedData.time)
 */
export async function queryCreateEventSnapshot(season, type, event, time) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!type) throw new Error('type is missing');
    if (!event) throw new Error('event is missing');
    if (!time) throw new Error('time is missing');

    // Skip cross-season events
    if (event.season !== season) return null;

    const { data: record, error } = await tryCatch(
        db.h1_event_snapshot.upsert({
            where: {
                type_event_id_time: {
                    type: type,
                    event_id: event.event_id,
                    time: time,
                },
            },
            update: {
                points: event.points,
                points_max: event.points_max,
            },
            create: {
                season: season,
                type: type,
                event_id: event.event_id,
                time: time,
                points: event.points,
                points_max: event.points_max,
            },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query: record };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db/queries/createEventSnapshots.mjs
git commit -m "feat: add createEventSnapshot query for event progress tracking"
```

---

## Task 9: Wire snapshot capture into `status.mjs`

**Why:** This is the integration point — connecting the snapshot queries and throttle logic into the existing polling pipeline.

**Files:**

- Modify: `src/update/status.mjs`

- [ ] **Step 1: Add imports**

At the top of `src/update/status.mjs`, add after the existing imports:

```js
import { queryCreateLiveSnapshots } from '@/db/queries/createLiveSnapshots';
import { queryCreateEventSnapshot } from '@/db/queries/createEventSnapshots';
import {
    shouldTakeLiveSnapshot,
    recordLiveSnapshotTime,
    shouldTakeEventSnapshot,
    recordEventSnapshotTime,
} from '@/update/snapshotTimers';
```

- [ ] **Step 2: Add event snapshot capture after step 6 (event upserts)**

After the attack events loop (after line 113 in current `status.mjs`), add a new step 6.5:

```js
//6.5 capture event snapshots (10-min throttle)
// Defend event snapshot
if (fetchedData.defend_event && fetchedData.defend_event.season === season) {
    const de = fetchedData.defend_event;
    // Snapshot if active OR if terminal (captures the final state)
    if (de.status === 'active' || de.status === 'success' || de.status === 'fail') {
        const { data: shouldSnapshot, error: timerError } = await tryCatch(
            shouldTakeEventSnapshot('defend', de.event_id, fetchedData.time),
        );
        if (timerError) {
            console.error('Event snapshot timer error:', timerError.message);
        } else if (shouldSnapshot) {
            const { error: snapError } = await tryCatch(
                queryCreateEventSnapshot(season, 'defend', de, fetchedData.time),
            );
            if (snapError) {
                console.error('Defend event snapshot error:', snapError.message);
            } else {
                recordEventSnapshotTime('defend', de.event_id, fetchedData.time);
            }
        }
    }
}

// Attack event snapshots
for (const event of fetchedData.attack_events) {
    if (event.season !== season) continue;
    if (
        event.status === 'active' ||
        event.status === 'success' ||
        event.status === 'fail'
    ) {
        const { data: shouldSnapshot, error: timerError } = await tryCatch(
            shouldTakeEventSnapshot('attack', event.event_id, fetchedData.time),
        );
        if (timerError) {
            console.error('Event snapshot timer error:', timerError.message);
        } else if (shouldSnapshot) {
            const { error: snapError } = await tryCatch(
                queryCreateEventSnapshot(
                    season,
                    'attack',
                    { ...event, region: 11 },
                    fetchedData.time,
                ),
            );
            if (snapError) {
                console.error('Attack event snapshot error:', snapError.message);
            } else {
                recordEventSnapshotTime('attack', event.event_id, fetchedData.time);
            }
        }
    }
}
```

Note: snapshots capture ALL event states (active, success, fail) — not just active. This captures the final data point when an event transitions to a terminal state. The throttle timer still prevents duplicate writes at the same timestamp.

Note: snapshot errors are logged but do NOT throw — snapshot failure should not break the core polling pipeline.

- [ ] **Step 3: Add live snapshot capture after step 8 (h1_live upsert loop)**

After the h1_live upsert loop (after line 151 in current `status.mjs`), add step 8.5:

```js
//8.5 capture live statistic snapshots (15-min throttle)
const { data: shouldSnapshot, error: liveTimerError } = await tryCatch(
    shouldTakeLiveSnapshot(season, fetchedData.time),
);
if (liveTimerError) {
    console.error('Live snapshot timer error:', liveTimerError.message);
} else if (shouldSnapshot) {
    const { error: liveSnapError } = await tryCatch(
        queryCreateLiveSnapshots(season, fetchedData.time, fetchedData.statistics),
    );
    if (liveSnapError) {
        console.error('Live snapshot error:', liveSnapError.message);
    } else {
        recordLiveSnapshotTime(fetchedData.time);
    }
}
```

- [ ] **Step 4: Verify the app starts and the pipeline runs**

Run: `npm run dev`

Watch worker logs. After 15+ minutes, verify:

- `h1_live_snapshot` has rows: check via Prisma Studio or direct DB query
- `h1_event_snapshot` has rows (if any events are active)

- [ ] **Step 5: Commit**

```bash
git add src/update/status.mjs
git commit -m "feat: wire snapshot capture into polling pipeline (15-min stats, 10-min events)"
```

---

## Task 10: Update TODO and spec

**Files:**

- Modify: `docs/TODO.md`
- Modify: `docs/superpowers/specs/2026-03-25-phase-2-time-series-snapshots.md`

- [ ] **Step 1: Update TODO.md Phase 2 section**

Replace the Phase 2 section in `docs/TODO.md`:

```markdown
## Phase 2 — Time-Series Snapshots

Capture how stats and events change over time. Depends on Phase 1 normalized tables.

> Spec: [`docs/superpowers/specs/2026-03-25-phase-2-time-series-snapshots.md`](superpowers/specs/2026-03-25-phase-2-time-series-snapshots.md)

- [ ] Drop `h1_snapshot.json` column (Phase 1 gap)
- [ ] Add `h1_live_snapshot` table (15-min interval stats from `h1_live`)
- [ ] Add `h1_event_snapshot` table (10-min event progress with FK to `h1_event`)
- [ ] Wire snapshot capture into polling pipeline (`status.mjs`)
- [ ] Fix `fetchStatus()` error swallowing
- [ ] Add timestamp range validation to Zod schema
```

- [ ] **Step 2: Commit**

```bash
git add docs/TODO.md
git commit -m "docs: update Phase 2 TODO items to match revised plan"
```

---

## Decisions Log

Issues identified in the four-way debate and how each is resolved:

| #   | Issue                                       | Resolution                                                                     |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Spec references dropped `h1_statistic`      | Renamed to `h1_live_snapshot`, sourced from `h1_live`/`fetchedData.statistics` |
| 2   | `season_duration` phantom field             | Kept — confirmed it exists in `isValidStatus.js:39` and `upsertLive.mjs:31`    |
| 3   | Prisma client may be stale                  | Task 3 includes `prisma generate`                                              |
| 4   | `skipDuplicates` silent data loss           | Changed to `upsert` pattern (update on conflict)                               |
| 5   | Active-to-inactive event transition gap     | Snapshot captures all event states, not just active                            |
| 6   | No timestamp validation                     | Task 2 adds `z.number().int().min().max()`                                     |
| 7   | Double-encoded JSON in `h1_snapshot.data`   | Out of scope — existing data issue, not Phase 2. Worth a future cleanup.       |
| 8   | Redundant `@@index` where `@@unique` exists | Removed from both new tables and from `h1_snapshot`                            |
| 9   | `h1_event_snapshot` missing `season` column | Added with `@@index([season, time])`                                           |
| 10  | Per-poll `MAX(time)` queries                | In-memory throttle with DB cold-start fallback (Task 6)                        |
| 11  | No FK on `h1_event_snapshot`                | Added FK via `(type, event_id)` compound key                                   |
| 12  | No retention policy                         | Acknowledged — deferred. Growth is ~1K rows/day, manageable for years          |
| 13  | Clock source ambiguity                      | All comparisons use `fetchedData.time` (API clock)                             |
| 14  | `fetchStatus()` swallows errors             | Task 1 fixes it                                                                |
| 15  | `upsertSnapshots.mjs` uses raw try/catch    | Task 3 converts to tryCatch wrapper                                            |
| 16  | "Populate h1_snapshot" TODO is already done | Removed from Phase 2 TODO                                                      |
