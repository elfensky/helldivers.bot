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
    v  [parallel]
h1_campaign                   — Normalized campaign data
h1_defend_event               — Normalized defend event
h1_attack_event               — Normalized attack events
h1_statistic                  — Normalized statistics
h1_introduction_order         — Season introduction order (snapshots only)
h1_points_max                 — Season points max (snapshots only)
h1_snapshot                   — Historical snapshots (snapshots only)
    |
    v
h1_season (confirmed)         — last_updated set only after all child writes succeed
```

There are two distinct pipelines that share this shape:

- **Status pipeline** (`updateStatus()`) — runs on every worker tick, updates the current campaign state.
- **Season pipeline** (`updateSeason(season)`) — runs on-demand when historical season data is needed.

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

| Environment | Resolved path |
|---|---|
| `development` | `path.resolve(__dirname, '../../public/workers/cron.js')` |
| `production` / `staging` | `path.resolve('/app/public/workers/cron.js')` |

After spawning, the parent sends a single initialization message to the worker:

```js
worker.postMessage({ key: UPDATE_KEY, interval: UPDATE_INTERVAL, port: PORT || 3000 });
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

`fetchStatus()` POSTs `action=get_campaign_status` to the official API. On network failure it logs and returns `undefined` without re-throwing. `tryCatch()` catches any thrown error and returns it in `error`. If `fetchedError` is set, `updateStatus()` throws immediately with a descriptive message and a `cause` pointing to the source location.

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

**Step 5.1 — Create unconfirmed season record**

```js
await tryCatch(queryUpsertSeason(season, false));
```

A row for this season is created in `h1_season` with `last_updated` left as `null`. The `false` parameter signals that this is the initial, unconfirmed creation. See the Confirm Pattern section below.

**Steps 5.2–5.5 — Parallel normalized writes**

```js
await Promise.all([
    tryCatch(queryUpsertCampaigns(season, fetchedData.campaign_status)),
    tryCatch(queryUpsertDefendEvent(season, fetchedData.defend_event)),
    tryCatch(queryUpsertAttackEvents(season, fetchedData.attack_events)),
    tryCatch(queryUpsertStatistics(season, fetchedData.statistics)),
]);
```

All four child tables are written concurrently. Note the naming asymmetry:

- `queryUpsertDefendEvent` (singular) — `defend_event` is a single object in the API response.
- `queryUpsertAttackEvents` (plural) — `attack_events` is an array.

Each result is checked individually after `Promise.all` resolves; any error throws immediately.

**Step 6 — Confirm season**

```js
await tryCatch(queryUpsertSeason(season, true));
```

`last_updated` is set only now, after all child writes have succeeded. See the Confirm Pattern section below.

**Return value**

```js
return { ms, season, confirmSeason };
```

`ms` is the rounded execution time in milliseconds. `confirmSeason` is the updated `h1_season` record.

### Confirm pattern

`queryUpsertSeason` is called twice in every pipeline run:

| Call | Parameter | Effect |
|---|---|---|
| `queryUpsertSeason(season, false)` | `false` | Creates or touches the season row; leaves `last_updated` as `null` |
| `queryUpsertSeason(season, true)` | `true` | Sets `last_updated` to the current timestamp |

The invariant this enforces: a season row with `last_updated !== null` has a complete, consistent set of child records. Any season row where `last_updated` is `null` was either just created and is mid-pipeline, or a previous pipeline run failed partway through. Consumers of the `h1_*` tables can filter on `last_updated IS NOT NULL` to read only confirmed seasons.

### Error handling

Every async operation is wrapped in `tryCatch()`, which returns `{ data, error }` instead of throwing. Errors surface as explicit `if (someError) throw new Error(...)` checks after each step, with a `cause` field that identifies the exact source file and operation. This makes stack traces actionable without relying on implicit propagation.

---

## 4. Season Snapshot Pipeline

Source: `src/update/season.mjs` — `updateSeason(season)`

This function fetches the full historical snapshot data for a given season number. It is structurally identical to the status pipeline but operates on different data.

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

`fetchSeason` validates the season parameter with `isValidNumber`, then POSTs `action=get_snapshots&season=N`. Unlike `fetchStatus`, `fetchSeason` re-throws on error — a failed season fetch is always a hard failure.

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

**Steps 5.2–5.6 — Parallel normalized writes**

```js
await Promise.all([
    tryCatch(queryUpsertIntroductionOrder(season, fetchedData.introduction_order)),
    tryCatch(queryUpsertPointsMax(season, fetchedData.points_max)),
    tryCatch(queryUpsertSnapshots(season, fetchedData.snapshots)),
    tryCatch(queryUpsertDefendEvents(season, fetchedData.defend_events)),
    tryCatch(queryUpsertAttackEvents(season, fetchedData.attack_events)),
]);
```

Five tables are written concurrently. Note that in this pipeline both `defend_events` and `attack_events` are arrays (plural forms), because snapshot data contains full historical event lists rather than a single current event.

**Step 6 — Confirm season**

```js
await tryCatch(queryUpsertSeason(season, true));
```

**Return value**

```js
return { ms, season, confirmSeason };
```

### On-demand invocation

`updateSeason()` is not called on a schedule. It is called reactively by two API handlers when they cannot find the requested season in the local database:

- `GET /api/h1/campaign?season=N` — queries local `h1_*` tables first; calls `updateSeason(season)` if the season is missing.
- `POST /api/h1/rebroadcast` with `action=get_snapshots` — queries `rebroadcast_snapshot` first; calls `updateSeason(season)` if the row is absent.

After `updateSeason()` returns, the handler re-queries the database and returns the result. This means a cold request for an unknown season incurs one extra round-trip to the official API before responding.

---

## 5. Two-Table Strategy

Every pipeline run writes the same data twice: once as raw JSON, once as normalized relational rows.

### Rebroadcast tables

| Table | Populated by | Key |
|---|---|---|
| `rebroadcast_status` | `queryUpsertRebroadcastStatus` | `season` (unique) |
| `rebroadcast_snapshot` | `queryUpsertRebroadcastSeason` | `season` (unique) |

These tables store the complete, unmodified API response as a JSON blob. There is one row per season. They exist to serve the `/api/h1/rebroadcast` endpoint, which mirrors the official API format exactly — clients that were already consuming the official API can point at this endpoint and receive the same payload structure without any transformation.

### H1 tables

| Table | Relationship |
|---|---|
| `h1_season` | Root; one row per season |
| `h1_campaign` | Many per season |
| `h1_defend_event` | Many per season |
| `h1_attack_event` | Many per season |
| `h1_statistic` | Many per season |
| `h1_snapshot` | Many per season |
| `h1_introduction_order` | One per season |
| `h1_points_max` | One per season |

These tables store normalized, relational data keyed on `season`. They accumulate historical records across every update cycle, enabling structured queries, aggregations, and time-series analysis. They are used by the `/api/h1/campaign` endpoint and the frontend.

### Why both exist

The two representations serve different consumers with incompatible requirements:

- The rebroadcast endpoint must return the exact payload structure the official API produces. Reconstructing that structure from normalized rows on every request would be fragile and expensive.
- The campaign endpoint and frontend need to filter, join, and aggregate across seasons and time. Querying a JSON blob for that is impractical.

Storing both avoids the trade-off: the raw blob is always available for faithful reproduction, and the normalized rows are always available for structured access. The storage overhead is the duplicated JSON, which is acceptable given the relatively small payload sizes of the Helldivers 1 API.

---

## 6. Fetching Layer

Source: `src/update/fetch.mjs`

### `getApiURL()`

Returns the base URL for all environments:

| `NODE_ENV` | URL |
|---|---|
| `development` | `https://api.helldiversgame.com/1.0/` |
| `staging` | `https://api.helldiversgame.com/1.0/` |
| `production` | `https://api.helldiversgame.com/1.0/` |

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

Posts `action=get_campaign_status`. On error, it logs the message and returns `undefined` without re-throwing. The caller (`updateStatus`) handles the `undefined` case via `tryCatch` and throws with context.

### `fetchSeason(season)`

```js
export async function fetchSeason(season) { ... }
```

Validates `season` with `isValidNumber.safeParse` before constructing the request. Posts `action=get_snapshots` with `season=N`. On error, it logs and **re-throws** — unlike `fetchStatus`, a season fetch failure is always propagated to the caller.

---

## Cross-references

- See [database-schema.md](database-schema.md) for table structures and column definitions.
- See [api-reference.md](api-reference.md) for the `/api/h1/update` endpoint that triggers the status pipeline on each worker tick.
- See [utilities-reference.md](utilities-reference.md) for `tryCatch`, `getSeasonFromStatus`, `getSeasonFromSnapshot`, and the Zod validation schemas.
