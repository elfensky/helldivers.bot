# Data Flow

Technical reference for how the helldivers.bot application fetches, validates, and persists data from the official Helldivers 1 API.

---

## 1. Overview

The full data pipeline from external API to stored records:

```
Official API (api.helldiversgame.com)
    |
    v
src/update/fetch.mjs          — HTTP layer (Axios POST, SSL bypass)
    |
    v
src/validators/               — Zod safeParse validation
    |
    v
rebroadcast_status            — Raw JSON, one row per season
rebroadcast_snapshot          — Raw JSON, one row per season
    |
    v
h1_season (unconfirmed)       — Season record, last_updated = null
    |
    v  [sequential]
h1_event                      — Unified defend/attack events
h1_event_snapshot             — Event progress snapshots (10-min throttle)
h1_introduction_order         — Derived from campaign_status
h1_points_max                 — Derived from campaign_status
h1_live                       — Per-faction live state with map overlay
h1_live_snapshot              — Live statistic snapshots (15-min throttle)
h1_snapshot                   — Historical snapshots (season pipeline only)
    |
    v
h1_season (confirmed)         — last_updated set only after all child writes succeed
```

There are two distinct pipelines that share this shape:

- **Status pipeline** (`updateStatus()`) — runs on every worker tick, updates the current campaign state. Writes `h1_event`, `h1_event_snapshot`, `h1_introduction_order`, `h1_points_max`, `h1_live`, and `h1_live_snapshot`.
- **Season pipeline** (`updateSeason(season)`) — runs on-demand when historical season data is needed. Writes `h1_event`, `h1_introduction_order`, `h1_points_max`, and `h1_snapshot`.

---

## 2. Worker Thread Lifecycle

Sources: `public/workers/cron.js`, `src/utils/initialize.worker.mjs`

### Startup

`initializeWorker()` is called from `src/instrumentation.js` during application bootstrap. It guards against non-Node.js runtimes before doing anything:

```js
if (process.env.NEXT_RUNTIME === 'nodejs') { ... }
```

This prevents the worker from being spawned in edge runtimes or during static builds.

The worker script path is resolved differently depending on environment:

| Environment              | Resolved path                                           |
| ------------------------ | ------------------------------------------------------- |
| `development`            | `path.resolve(process.cwd(), 'public/workers/cron.js')` |
| `production` / `staging` | `path.resolve('/app/public/workers/cron.js')`           |

After spawning, the parent sends a single initialization message to the worker:

```js
worker.postMessage({ key: key, interval: interval, port: port });
```

### Worker message loop

The worker listens for exactly one message from the parent. On receipt, it immediately starts the polling loop:

```js
parentPort.on('message', async (msg) => {
    const { key, interval, port } = msg;
    async function doWork() { ... }
    doWork();
});
```

`doWork()` constructs the internal update URL and fetches it:

```js
const url = `http://localhost:${port}/api/h1/update?key=${key}`;
const response = await fetch(url);
```

After each attempt — success or failure — the worker reports back to the parent:

- Success: `{ data: responseJson, time: new Date().toString() }`
- Error: `{ error: err.toString(), time: new Date().toString() }`

Errors do not stop the worker. The loop continues unconditionally.

### Sequential scheduling with `setTimeout`

The worker uses `setTimeout(doWork, interval * 1000)` at the end of `doWork()`, not `setInterval`. This is intentional: the next poll only starts after the current one fully resolves. If an update takes longer than the configured interval, requests will not overlap and database operations will not race.

### Parent-side message handling

The parent logs errors from worker messages and thread-level errors:

```js
worker.on('message', (data) => {
    if (data.error) console.error('Worker error:', data.error, 'at', data.time);
});
worker.on('error', (err) => console.error('Worker thread error:', err));
worker.on('exit', (code) => {
    console.log(`Worker stopped with exit code ${code}`);
    worker = null;
});
```

### Graceful shutdown

On `SIGINT` or `SIGTERM`, the parent terminates the worker before exiting:

```js
process.on('SIGINT', async () => {
    if (worker) await worker.terminate();
    process.exit();
});
```

---

## 3. Status Update Pipeline

Source: `src/update/status.mjs` — `updateStatus()`

This function is invoked by `GET /api/h1/update?key=...` on every worker tick. It fetches the current campaign state and persists it to both table families.

### Step-by-step

**Step 0 — Timing**

```js
const start = performance.now();
```

Execution time is measured from the very start and returned in the response as `ms`.

**Step 1 — Fetch**

```js
const { data: fetchedData, error: fetchedError } = await tryCatch(fetchStatus());
```

`fetchStatus()` POSTs `action=get_campaign_status` to the official API. It delegates to `fetchInvalidHttps()`, which throws on network failure or empty response. `tryCatch()` catches any thrown error and returns it in `error`. If `fetchedError` is set, `updateStatus()` throws immediately with a descriptive message and a `cause` pointing to the source location.

**Step 2 — Zod validation**

```js
const check = isValidStatus(fetchedData);
if (!check.success) throw new Error(...);
```

`isValidStatus` runs a Zod `safeParse` against the response. It validates the shape of `campaign_status[]`, `defend_event`, `attack_events[]`, and `statistics[]`. Validation failure throws before any database write occurs.

**Step 3 — Extract season**

```js
const season = getSeasonFromStatus(fetchedData);
```

`getSeasonFromStatus` reads the season number from `campaign_status`, `defend_event`, and `statistics`. It logs a warning if multiple different season values are present across those fields. Attack events are deliberately excluded here because they can belong to a prior season while the rest of the payload belongs to the current one.

**Step 4 — Write raw JSON (rebroadcast)**

```js
await tryCatch(queryUpsertRebroadcastStatus(season, fetchedData));
```

The complete, unmodified API response is stored in `rebroadcast_status`, keyed by `season`. This is an upsert — the row for that season is created or replaced.

**Step 5 — Create unconfirmed season record**

```js
await tryCatch(queryUpsertSeason(season, false));
```

A row for this season is created in `h1_season` with `last_updated` left as `null`. The `false` parameter signals that this is the initial, unconfirmed creation. See the Confirm Pattern section below.

**Step 6 — Upsert events**

```js
// Defend event (guard for null — API omits when no defend active)
if (fetchedData.defend_event) {
    await tryCatch(queryUpsertEvent(season, 'defend', fetchedData.defend_event));
}

// Attack events
for (const event of fetchedData.attack_events) {
    await tryCatch(queryUpsertEvent(season, 'attack', { ...event, region: 11 }));
}
```

Both defend and attack events are written through the unified `queryUpsertEvent(season, type, event)` function to the `h1_event` table. Key differences:

- `defend_event` is a single nullable object in the API response. It is guarded with an `if` check — the API omits this field when no defend event is active.
- `attack_events` is an array. Each event is spread with `region: 11` added, because attack events always target the enemy homeworld (region 11) and the API does not include the region field.

Events are written sequentially, not in parallel. Each error throws immediately.

**Step 6.5 — Event snapshot capture (10-min throttle)**

After upserting events, the pipeline captures time-series snapshots of event progress for active or terminal events:

```js
// For each defend/attack event where status is 'active', 'success', or 'fail':
const { data: shouldSnapshot } = await tryCatch(
    shouldTakeEventSnapshot(type, event.event_id, fetchedData.time),
);
if (shouldSnapshot) {
    await tryCatch(queryCreateEventSnapshot(season, type, event, fetchedData.time));
    recordEventSnapshotTime(type, event.event_id, fetchedData.time);
}
```

For each active or terminal event (defend and attack), the pipeline calls `shouldTakeEventSnapshot()` to check whether 10 minutes have elapsed since the last snapshot for that specific event. If yes, it writes a row to `h1_event_snapshot` and updates the in-memory timer. Terminal events (`success`/`fail`) are also snapshotted to capture the final state.

Snapshot errors are logged but do not throw — they are non-fatal to the pipeline. The update continues even if a snapshot write fails.

**Step 7 — Derive introduction_order and points_max**

```js
const introOrder = fetchedData.campaign_status.map((c) => c.introduction_order);
const pointsMax = fetchedData.campaign_status.map((c) => c.points_max);

await tryCatch(queryUpsertIntroductionOrder(season, introOrder));
await tryCatch(queryUpsertPointsMax(season, pointsMax));
```

These two values are derived from the `campaign_status` array by mapping each faction's entry. They are stored in their own tables (`h1_introduction_order` and `h1_points_max`) because they are season-level metadata, not per-tick data. Written sequentially; errors throw.

**Step 8 — Upsert h1_live (per-faction live state)**

```js
for (let enemy = 0; enemy < 3; enemy++) {
    const campaign = fetchedData.campaign_status[enemy];
    const stats = fetchedData.statistics[enemy];
    const factionMap = computeFactionMap(
        enemy,
        campaign,
        defendEvent,
        attackEvents,
        season,
    );
    await tryCatch(queryUpsertLive(season, enemy, campaign, stats, factionMap));
}
```

The pipeline loops over the three enemy factions (0, 1, 2). For each faction, it:

1. Extracts the campaign entry and statistics entry from the API arrays.
2. Computes a `factionMap` via `computeFactionMap()` — a deep-cloned map template from `src/enums/map` with live campaign data overlaid (points, percent, status) and event markers (`'defend'`/`'attack'`) applied to affected regions.
3. Upserts a row in `h1_live` containing the campaign data, statistics, and computed map.

The `computeFactionMap()` helper:

- Deep-clones the base map template for the given enemy.
- Sets `status` on all regions from the campaign.
- Sets `points`, `points_max`, and `percent` on region 11 (homeworld).
- Marks the region with `event: 'defend'` if a defend event targets that faction.
- Marks region 11 with `event: 'attack'` if any active attack event targets that faction.

**Step 8.5 — Live snapshot capture (15-min throttle)**

```js
const { data: shouldSnapshot } = await tryCatch(
    shouldTakeLiveSnapshot(season, fetchedData.time),
);
if (shouldSnapshot) {
    await tryCatch(
        queryCreateLiveSnapshots(season, fetchedData.time, fetchedData.statistics),
    );
    recordLiveSnapshotTime(fetchedData.time);
}
```

After all three factions are written, the pipeline checks `shouldTakeLiveSnapshot()` to determine if 15 minutes have elapsed since the last live snapshot. If yes, it writes all three factions' statistics to `h1_live_snapshot` in a single call and updates the in-memory timer.

Like event snapshots, live snapshot errors are logged but do not throw — they are non-fatal.

**Step 9 — Confirm season**

```js
await tryCatch(queryUpsertSeason(season, true));
```

`last_updated` is set only now, after all child writes have succeeded. See the Confirm Pattern section below.

**Return value**

```js
return { ms, season, confirmSeason };
```

`ms` is the raw execution time in milliseconds (via `performanceTime(start)`, not rounded). `confirmSeason` is the updated `h1_season` record.

### Confirm pattern

`queryUpsertSeason` is called twice in every pipeline run:

| Call                               | Parameter | Effect                                                             |
| ---------------------------------- | --------- | ------------------------------------------------------------------ |
| `queryUpsertSeason(season, false)` | `false`   | Creates or touches the season row; leaves `last_updated` as `null` |
| `queryUpsertSeason(season, true)`  | `true`    | Sets `last_updated` to the current timestamp                       |

The invariant this enforces: a season row with `last_updated !== null` has a complete, consistent set of child records. Any season row where `last_updated` is `null` was either just created and is mid-pipeline, or a previous pipeline run failed partway through. Consumers of the `h1_*` tables can filter on `last_updated IS NOT NULL` to read only confirmed seasons.

### Error handling

Every async operation is wrapped in `tryCatch()`, which returns `{ data, error }` instead of throwing. Errors surface as explicit `if (someError) throw new Error(...)` checks after each step, with a `cause` field that identifies the exact source file and operation. This makes stack traces actionable without relying on implicit propagation.

The exception is snapshot writes (Steps 6.5 and 8.5), which log errors with `console.error` instead of throwing. Snapshot failures are non-fatal — the pipeline completes and confirms the season even if individual snapshots fail to write.

---

## 4. Season Snapshot Pipeline

Source: `src/update/season.mjs` — `updateSeason(season)`

This function fetches the full historical snapshot data for a given season number. It is structurally similar to the status pipeline but operates on different data and does not write live state or throttled snapshots.

### Step-by-step

**Step 0 — Guard and timing**

```js
if (!season) throw new Error('season is missing');
const start = performance.now();
```

Season is required. If absent, the function throws before attempting any I/O.

**Step 1 — Fetch**

```js
const { data: fetchedData, error: fetchedError } = await tryCatch(fetchSeason(season));
```

`fetchSeason` validates the season parameter with `isValidNumber.safeParse`, then POSTs `action=get_snapshots&season=N`. Unlike `fetchStatus`, `fetchSeason` delegates directly to `fetchInvalidHttps` which re-throws on error — a failed season fetch is always a hard failure.

**Step 2 — Zod validation**

```js
const check = isValidSeason(fetchedData);
```

Validates the snapshot response shape. On failure, the individual Zod issues are logged before throwing.

**Step 3 — Cross-check season**

```js
const season2 = getSeasonFromSnapshot(fetchedData);
if (season !== season2) throw new Error('Invalid season');
```

The season number embedded in the response payload is compared against the requested season. A mismatch throws immediately, preventing data from being stored under the wrong season key.

**Step 4 — Write raw JSON (rebroadcast)**

```js
await tryCatch(queryUpsertRebroadcastSeason(season, fetchedData));
```

The complete response is stored in `rebroadcast_snapshot`, keyed by `season`.

**Step 5.1 — Create unconfirmed season record**

```js
await tryCatch(queryUpsertSeason(season, false));
```

Same confirm pattern as the status pipeline.

**Steps 5.2-5.4 — Parallel normalized writes**

```js
await Promise.all([
    tryCatch(queryUpsertIntroductionOrder(season, fetchedData.introduction_order)),
    tryCatch(queryUpsertPointsMax(season, fetchedData.points_max)),
    tryCatch(queryUpsertSnapshots(season, fetchedData.snapshots)),
]);
```

Three tables are written concurrently: `h1_introduction_order`, `h1_points_max`, and `h1_snapshot`. Each result is checked individually after `Promise.all` resolves; any error throws immediately.

**Step 5.5 — Upsert defend events**

```js
for (const event of fetchedData.defend_events) {
    await tryCatch(queryUpsertEvent(season, 'defend', event));
}
```

Defend events are iterated and each is written to `h1_event` via the unified `queryUpsertEvent` function. In the season pipeline, `defend_events` is an array (plural) because snapshot data contains full historical event lists rather than a single current event.

**Step 5.6 — Upsert attack events**

```js
for (const event of fetchedData.attack_events) {
    await tryCatch(queryUpsertEvent(season, 'attack', { ...event, region: 11 }));
}
```

Attack events are also iterated individually. Each event is spread with `region: 11` added, same as in the status pipeline.

**Step 6 — Confirm season**

```js
await tryCatch(queryUpsertSeason(season, true));
```

**Return value**

```js
return { ms, season, confirmSeason };
```

### On-demand invocation

`updateSeason()` is not called on a schedule. It is called reactively by API handlers when they cannot find the requested season in the local database:

- `GET /api/h1/campaign?season=N` — queries local `h1_*` tables first; calls `updateSeason(season)` if the season is missing.
- `POST /api/h1/rebroadcast` with `action=get_snapshots` — queries `rebroadcast_snapshot` first; calls `updateSeason(season)` if the row is absent.

After `updateSeason()` returns, the handler re-queries the database and returns the result. This means a cold request for an unknown season incurs one extra round-trip to the official API before responding.

### Frontend on-demand fetching

The `/war` history page also fetches seasons on-demand via `fetchAndSeedSeason()` (`src/db/queries/fetchAndSeedSeason.mjs`). When a user selects a season not yet in the database:

1. `getCampaign(season)` returns `null`
2. `fetchAndSeedSeason(season)` calls `fetchSeason(season)` (official API) and upserts into `h1_season`, `h1_event`, `h1_snapshot`, `h1_introduction_order`, `h1_points_max`
3. `getCampaign(season)` is re-queried and now returns the seeded data

The season selector on `/war` is derived from the current season number (`Array.from({length: activeSeason - 1}, ...)`), not from a database query. This ensures all past seasons are always selectable regardless of what exists in the DB.

---

## 5. Two-Table Strategy

Every pipeline run writes the same data twice: once as raw JSON, once as normalized relational rows.

### Rebroadcast tables

| Table                  | Populated by                   | Key               |
| ---------------------- | ------------------------------ | ----------------- |
| `rebroadcast_status`   | `queryUpsertRebroadcastStatus` | `season` (unique) |
| `rebroadcast_snapshot` | `queryUpsertRebroadcastSeason` | `season` (unique) |

These tables store the complete, unmodified API response as a JSON blob. There is one row per season. They exist to serve the `/api/h1/rebroadcast` endpoint, which mirrors the official API format exactly — clients that were already consuming the official API can point at this endpoint and receive the same payload structure without any transformation.

### H1 tables

| Table                   | Relationship                              | Written by           |
| ----------------------- | ----------------------------------------- | -------------------- |
| `h1_season`             | Root; one row per season                  | Both pipelines       |
| `h1_event`              | Many per season (defend + attack unified) | Both pipelines       |
| `h1_event_snapshot`     | Many per event (10-min intervals)         | Status pipeline only |
| `h1_live`               | Three per season (one per faction)        | Status pipeline only |
| `h1_live_snapshot`      | Many per season (15-min intervals)        | Status pipeline only |
| `h1_snapshot`           | Many per season                           | Season pipeline only |
| `h1_introduction_order` | One per season                            | Both pipelines       |
| `h1_points_max`         | One per season                            | Both pipelines       |

These tables store normalized, relational data keyed on `season`. They accumulate historical records across every update cycle, enabling structured queries, aggregations, and time-series analysis. They are used by the `/api/h1/campaign` endpoint and the frontend.

### Why both exist

The two representations serve different consumers with incompatible requirements:

- The rebroadcast endpoint must return the exact payload structure the official API produces. Reconstructing that structure from normalized rows on every request would be fragile and expensive.
- The campaign endpoint and frontend need to filter, join, and aggregate across seasons and time. Querying a JSON blob for that is impractical.

Storing both avoids the trade-off: the raw blob is always available for faithful reproduction, and the normalized rows are always available for structured access. The storage overhead is the duplicated JSON, which is acceptable given the relatively small payload sizes of the Helldivers 1 API.

---

## 6. Snapshot Throttle System

Source: `src/update/snapshotTimers.mjs`

The status pipeline runs on every worker tick (typically every few seconds), but writing a snapshot row on every tick would generate excessive data. The snapshot throttle system limits how often snapshots are written using in-memory timestamp tracking with a database cold-start fallback.

### Architecture

The module maintains three pieces of in-memory state:

```js
let currentSeason = null;
let lastLiveSnapshotTime = null; // single timestamp
const lastEventSnapshotTimes = new Map(); // key: `${type}:${event_id}`, value: time
```

All timestamps are API-provided Unix times (the `time` field from the status response), not wall-clock times. This ensures throttle intervals are based on game-time progression, not server clock.

### Intervals

| Snapshot type  | Interval | Constant                                  |
| -------------- | -------- | ----------------------------------------- |
| Live snapshot  | 15 min   | `LIVE_SNAPSHOT_INTERVAL = 900` (seconds)  |
| Event snapshot | 10 min   | `EVENT_SNAPSHOT_INTERVAL = 600` (seconds) |

### Live snapshot throttle

**`shouldTakeLiveSnapshot(season, apiTime)`** — Returns `true` if a live snapshot should be written.

On cold start (when `lastLiveSnapshotTime` is `null`), it queries the database for the most recent `h1_live_snapshot` row for the current season and seeds the in-memory timestamp from it. If no row exists, it defaults to `0`, which guarantees the first check passes.

On subsequent calls, it compares `apiTime - lastLiveSnapshotTime` against the 900-second interval purely in memory, with no database query.

**`recordLiveSnapshotTime(time)`** — Called after a successful snapshot write to update the in-memory timestamp. This must be called only after the database write succeeds to avoid the timer advancing past a failed write.

### Event snapshot throttle

**`shouldTakeEventSnapshot(type, eventId, apiTime)`** — Returns `true` if a snapshot should be written for the given event.

Works identically to the live snapshot throttle, but tracks each event independently using a `Map` keyed by `${type}:${event_id}` (e.g., `defend:42` or `attack:17`). On cold start for a given event, it queries `h1_event_snapshot` for that specific type and event_id.

**`recordEventSnapshotTime(type, eventId, time)`** — Updates the in-memory timestamp for a specific event after a successful write.

### Season change detection

**`resetIfSeasonChanged(season)`** — Called at the top of `shouldTakeLiveSnapshot()`. If the season number has changed since the last call, it clears all in-memory timestamps:

```js
if (currentSeason !== null && currentSeason !== season) {
    lastLiveSnapshotTime = null;
    lastEventSnapshotTimes.clear();
}
currentSeason = season;
```

This ensures that when a new season starts, the throttle system re-seeds from the database (which will find no rows for the new season) and immediately begins capturing snapshots.

**`resetSnapshotTimers()`** — A manual reset function that clears all in-memory state. Available for external callers but not currently used by the pipelines (season changes are detected automatically).

### Cold-start behavior

Because the worker thread restarts on every deployment (and the Next.js process may restart for other reasons), in-memory state is regularly lost. The cold-start fallback ensures the system recovers gracefully:

1. First tick after restart: `lastLiveSnapshotTime` is `null`, triggering a DB query.
2. DB returns the most recent snapshot time (or nothing if no snapshots exist yet).
3. The throttle check runs against the DB-seeded value.
4. All subsequent ticks use the in-memory value, avoiding repeated DB queries.

This design means the worst case on restart is one extra database read per snapshot type, not a gap or duplication in snapshot data.

---

## 7. Fetching Layer

Source: `src/update/fetch.mjs`

### `getApiURL()`

Returns the base URL for all environments:

| `NODE_ENV`    | URL                                   |
| ------------- | ------------------------------------- |
| `development` | `https://api.helldiversgame.com/1.0/` |
| `staging`     | `https://api.helldiversgame.com/1.0/` |
| `production`  | `https://api.helldiversgame.com/1.0/` |

All three environments target the same production API. A commented-out QA URL (`api-qa.helldiversgame.com`) exists in the source but is not active.

### `fetchInvalidHttps(url, formData)`

The core HTTP function used by both public fetchers. It creates an `https.Agent` with SSL certificate validation disabled:

```js
const agent = new https.Agent({ rejectUnauthorized: false });
```

This is required because the official Helldivers 1 API has certificate issues that would otherwise cause every request to fail. The agent is passed to Axios on every call.

The function uses `axios.post`. It throws in two cases:

- The response has no `data` field.
- Axios itself throws (network failure, non-2xx status, etc.) — the Axios error is wrapped with the HTTP status and message included.

### `fetchStatus()`

```js
export async function fetchStatus() { ... }
```

Posts `action=get_campaign_status`. Delegates directly to `fetchInvalidHttps` and returns the result. On error, the exception propagates to the caller (`updateStatus`) which handles it via `tryCatch`.

### `fetchSeason(season)`

```js
export async function fetchSeason(season) { ... }
```

Validates `season` with `isValidNumber.safeParse` before constructing the request. Posts `action=get_snapshots` with `season=N`. On validation failure, throws immediately before making any network request. On network error, the exception propagates from `fetchInvalidHttps`.

---

## Cross-references

- See [02-database-schema.md](02-database-schema.md) for table structures and column definitions.
- See [04-api-reference.md](04-api-reference.md) for the `/api/h1/update` endpoint that triggers the status pipeline on each worker tick.
- See [05-utilities-reference.md](05-utilities-reference.md) for `tryCatch`, `getSeasonFromStatus`, `getSeasonFromSnapshot`, and the Zod validation schemas.
