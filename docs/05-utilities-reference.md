# Utilities & Validators Reference

**Audience:** Project owner and AI assistants
**Purpose:** Lookup reference for all shared utility functions and validation schemas — signatures, behavior, edge cases, and source locations.

---

## Table of Contents

1. [Error Handling — `tryCatch`](#1-error-handling--trycatch)
2. [Response Helpers](#2-response-helpers)
3. [Time Utilities](#3-time-utilities)
4. [Season Extraction](#4-season-extraction)
5. [Formatting](#5-formatting)
6. [Other Utilities](#6-other-utilities)
7. [War Outcome — `getWarOutcome`](#7-war-outcome--getwaroutcome)
8. [Shared Map Data — `mapPaths`](#8-shared-map-data--mappaths)
9. [Validation Schemas](#9-validation-schemas)
10. [Snapshot Throttle Timers](#10-snapshot-throttle-timers)

---

## 1. Error Handling — `tryCatch`

**Source:** `src/utils/tryCatch.mjs`

```js
export async function tryCatch(promise) {
    try {
        const data = await promise;
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}
```

### Behavior

Wraps any `Promise` and returns a two-field result object instead of throwing. This is the project-wide substitute for `try/catch` blocks; every async operation in the codebase goes through this wrapper.

| Field   | On success     | On failure            |
| ------- | -------------- | --------------------- |
| `data`  | Resolved value | `null`                |
| `error` | `null`         | Caught `Error` object |

### Usage pattern

```js
const { data, error } = await tryCatch(someAsyncOp());
if (error) {
    // handle error
}
// use data
```

### Called from

`src/update/status.mjs`, `src/update/season.mjs`, `src/instrumentation.js`, API route handlers, page-level server components.

---

## 2. Response Helpers

**Source:** `src/utils/responses.mjs`

Both helpers return a `NextResponse.json()` with a consistent envelope shape and include elapsed time via `performanceTime(start)`.

### `errorResponse(code, start, error?)`

```ts
errorResponse(code: number, start: number, error?: any): NextResponse
```

**Behavior:**

- Throws `Error('Invalid error code')` if `code` starts with `'1'`, `'2'`, or `'3'` — callers must pass a 4xx or 5xx code.
- Returns `NextResponse.json({ time, code, message, error }, { status: code })`.
- `error` parameter defaults to `null` when omitted.
- Unknown codes fall through to the `default` branch: message becomes `'Unknown error'` and HTTP status is overridden to `500`.

**Response envelope:**

```json
{
  "time": <number>,
  "code": <number>,
  "message": "<string>",
  "error": <any | null>
}
```

**Supported codes:**

| Code      | Message                                   |
| --------- | ----------------------------------------- |
| 400       | Bad Request                               |
| 401       | Unauthorized                              |
| 403       | Forbidden                                 |
| 404       | Not found                                 |
| 405       | Method not allowed                        |
| 418       | I'm a teapot                              |
| 429       | Too many requests                         |
| 451       | Unavailable for legal reasons             |
| 500       | Internal server error                     |
| 501       | Not implemented                           |
| 502       | Bad gateway                               |
| 503       | Service unavailable                       |
| _(other)_ | Unknown error — HTTP status forced to 500 |

> **Note:** Code 401 means "I don't know who you are." Code 403 means "I know who you are but you're still not allowed." Code 502 is used specifically when the upstream official Helldivers API is unreachable.

---

### `successResponse(code, start, data)`

```ts
successResponse(code: number, start: number, data: any): NextResponse
```

**Behavior:**

- Throws `Error('Invalid success code')` if `code` does not start with `'2'`.
- Returns `NextResponse.json({ time, code, message, data }, { status: code })`.
- Unknown 2xx codes fall through to the `default` branch: message becomes `'Unknown'` and HTTP status is overridden to `200`.

**Response envelope:**

```json
{
  "time": <number>,
  "code": <number>,
  "message": "<string>",
  "data": <any>
}
```

**Supported codes:**

| Code          | Message                             |
| ------------- | ----------------------------------- |
| 200           | OK                                  |
| 201           | Created                             |
| 202           | Accepted                            |
| 203           | Non-authoritative information       |
| 204           | No content                          |
| _(other 2xx)_ | Unknown — HTTP status forced to 200 |

---

## 3. Time Utilities

**Source:** `src/utils/time.mjs`

### Performance measurement (server-side)

| Function                 | Signature                  | Returns    | Description                                                                                                                                                                                                                                    |
| ------------------------ | -------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `performanceTime`        | `(start: number) → number` | Elapsed ms | `performance.now() - start`. Used directly inside `responses.mjs` for the `time` field on every API response.                                                                                                                                  |
| `roundedPerformanceTime` | `(start: number) → number` | Rounded ms | Rounds elapsed time up to the nearest 50ms using `Math.ceil(elapsed / 50) * 50`. Examples: 33ms → 50, 60ms → 100, 111ms → 150. Purpose: coarse bucketing for Umami analytics events so individual requests don't create unbounded cardinality. |

### Relative and formatted time (UI helpers)

| Function     | Signature               | Returns                      | Description                                                                                                                                                                               |
| ------------ | ----------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeSince`  | `(date: Date) → string` | `"X minutes/hours/days ago"` | Converts a past date to a human-readable relative string. Threshold: < 60 min → minutes, < 24 h → hours, otherwise days. Pluralization handled (e.g., "1 minute ago" vs "2 minutes ago"). |
| `formatDate` | `(date: Date) → string` | `"YYYY-MM-DD HH:MM:SS"`      | Zero-pads all components. Uses local time (not UTC). Used wherever consistent date display is needed.                                                                                     |

### Elapsed time computations

| Function            | Signature                            | Returns                             | Description                                                                                                                                                                            |
| ------------------- | ------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elapsedSeconds`    | `(past: Date) → number`              | Integer seconds                     | `Math.floor((now - past) / 1000)`.                                                                                                                                                     |
| `elapsedDateTime`   | `(past: Date) → number`              | Milliseconds                        | Raw `now - past` with no rounding.                                                                                                                                                     |
| `elapsedSeasonTime` | `(season_duration: number) → object` | `{ days, hours, minutes, seconds }` | Breaks a total-seconds value into human-readable components. Input is the `season_duration` integer from the statistics table. All components use `Math.floor` with modulo arithmetic. |

#### `elapsedSeasonTime` decomposition

```
days    = Math.floor(season_duration / 86400)
hours   = Math.floor((season_duration % 86400) / 3600)
minutes = Math.floor((season_duration % 3600) / 60)
seconds = season_duration % 60
```

---

## 4. Season Extraction

**Source:** `src/utils/getSeason.mjs`

Both functions extract the current season number from an already-validated API response object. They throw synchronously on error — callers must handle or wrap with `tryCatch`.

---

### `getSeasonFromStatus(data)`

```ts
getSeasonFromStatus(data: object): number
```

**Sources consulted:**

| Field                      | Included                        |
| -------------------------- | ------------------------------- |
| `campaign_status[].season` | Yes                             |
| `defend_event.season`      | Yes (single object, not array)  |
| `statistics[].season`      | Yes                             |
| `attack_events[].season`   | **No** — intentionally excluded |

**Why `attack_events` is excluded:** Attack events can reference an old season when the current season has no recorded attacks yet. Including them would produce a false season mismatch.

**Algorithm:**

1. Collect seasons from included sources into a flat array.
2. Deduplicate with `new Set`.
3. If zero unique values → throw `Error('No seasons found in status data')`.
4. If more than one unique value → `console.warn` (does not throw; uses the first).
5. Validate the first value with `isValidNumber.safeParse` → throw `Error('Invalid Current Season')` on failure.
6. Return `Number(uniqueSeasons[0])`.

**Throws on:**

- `data` is falsy → `Error('status is missing')`
- No seasons found → `Error('No seasons found in status data')`
- Season value fails `isValidNumber` → `Error('Invalid Current Season')`

---

### `getSeasonFromSnapshot(data)`

```ts
getSeasonFromSnapshot(data: object): number
```

**Sources consulted:**

| Field                    | Included |
| ------------------------ | -------- |
| `snapshots[].season`     | Yes      |
| `defend_events[].season` | Yes      |
| `attack_events[].season` | Yes      |

Snapshot data includes attack events because historical season data is already fully resolved — the old-season contamination risk present in live status does not apply here.

**Algorithm:** Identical to `getSeasonFromStatus` once sources are gathered. Same deduplication, warn-on-multiple, and `isValidNumber` validation.

**Throws on:** Same conditions as `getSeasonFromStatus`.

---

## 5. Formatting

**Source:** `src/utils/utils.mjs`

### `formatNumber(num)`

```ts
formatNumber(num: number | bigint): string
```

**Behavior:**

1. If input is `bigint`, converts to `Number` first (note: precision loss possible for very large values).
2. `>= 1,000,000` → `Math.round(num / 1_000_000) + 'M'`
3. `>= 1,000` → `Math.round(num / 1_000) + 'K'`
4. Otherwise → `num.toString()`

**Examples:** `1500000` → `"2M"`, `1499` → `"1K"`, `999` → `"999"`.

---

### `addOrdinalSuffix(num)`

```ts
addOrdinalSuffix(num: number): string
```

**Behavior:** Appends the English ordinal suffix to an integer. Handles the teen exception (11th, 12th, 13th) by checking `num % 100` before `num % 10`.

| Condition        | Suffix |
| ---------------- | ------ |
| `% 100` in 11–13 | `th`   |
| `% 10 === 1`     | `st`   |
| `% 10 === 2`     | `nd`   |
| `% 10 === 3`     | `rd`   |
| otherwise        | `th`   |

**Examples:** `1` → `"1st"`, `11` → `"11th"`, `21` → `"21st"`, `112` → `"112th"`.

---

## 6. Other Utilities

### `formDataToObject(formData)`

**Source:** `src/utils/formdata.mjs`

```ts
formDataToObject(formData: FormData): Record<string, string>
```

Iterates `formData.entries()` and builds a plain object. The result is what gets passed to `isValidFormData` for Zod validation in the rebroadcast endpoint. No type coercion is performed here — that is the validator's job.

---

### `getGravatarUrl(email)`

**Source:** `src/utils/gravatar.mjs`

```ts
getGravatarUrl(email: string): string
```

**Behavior:**

1. Normalizes email: `email.trim().toLowerCase()`.
2. MD5-hashes the normalized string using Node's built-in `crypto.createHash('md5')`.
3. Returns `https://www.gravatar.com/avatar/{hash}?s=64`.

Size parameter is hardcoded to 64px. Used in dashboard UI to display user avatars.

---

### `umamiTrackPage(title, url)`

**Source:** `src/utils/umami.mjs`

```ts
umamiTrackPage(title: string, url: string): Promise<void>
```

**Behavior:**

- **Production-only.** Returns immediately (no-op) if `NODE_ENV !== 'production'`.
- POSTs a page-view event to `https://{UMAMI_SITE_URL}/api/send`.
- Uses a hardcoded macOS Chrome User-Agent string (required by Umami's bot-detection).
- Payload includes `website` (from `UMAMI_SITE_ID`), `hostname` (from `getHostname()`), `screen: '1x1'`, `language: 'en'`, `title`, `url`.
- Errors are caught and logged to `console.error`; failures do not propagate.

---

### `umamiTrackEvent(title, url, name, data?)`

**Source:** `src/utils/umami.mjs`

```ts
umamiTrackEvent(title: string, url: string, name: string, data?: object): Promise<void>
```

**Behavior:**

- **Production-only.** Same early-return guard as `umamiTrackPage`.
- Identical POST structure but adds `name` (event name) and `data` (optional custom properties object, defaults to `{}`) to the payload.
- Uses `language: 'en-US'` (differs from `umamiTrackPage` which uses `'en'`).
- Called from API routes via Next.js `after()` hook so analytics does not block the response.

---

### `getHostname()` (internal)

**Source:** `src/utils/umami.mjs` — not exported

```ts
function getHostname(): string;
```

Maps `NODE_ENV` to hostname:

| `NODE_ENV`        | Returns                            |
| ----------------- | ---------------------------------- |
| `'development'`   | `'localhost'`                      |
| `'staging'`       | `'staging.helldivers.bot'`         |
| `'production'`    | `'helldivers.bot'`                 |
| _(anything else)_ | throws `Error('Unknown NODE_ENV')` |

---

## 7. War Outcome — `getWarOutcome`

**Source:** `src/utils/getWarOutcome.mjs`

```ts
getWarOutcome(data: { snapshots?, events?, live? }): { outcome: 'victory'|'defeat', reason: string } | null
```

Determines whether a war ended in victory or defeat. Extracted from `War.jsx` for reuse.

**Decision tree:**
1. No data (all arrays empty) → `null`
2. All 3 live factions `status === 'defeated'` → `{ outcome: 'victory' }` (early return)
3. Victory signal: any snapshot shows all 3 defeated, OR all 3 homeworlds captured via attack events
4. Defeat signal: last region-0 defend event has `status === 'fail'`
5. Victory AND no defeat → victory. Defeat signal → defeat. No victory signal → defeat.

**Consumers:** `War.jsx` (UI banner), potentially future features. Note: the OG image route does NOT use this — it derives status directly from events.

**Tests:** `src/__tests__/unit/utils/getWarOutcome.test.mjs` (8 cases)

---

## 8. Shared Map Data — `mapPaths`

**Source:** `src/enums/mapPaths.mjs`

Shared SVG path geometry for the Galaxy map. Single source of truth consumed by both `Map.jsx` (CSS class styling) and the OG image route (inline styling).

**Exports:**
- `viewBox` — `'0 0 806.93 868.81'`
- `bugPaths` — `Array<{ id, sector, d }>` (11 items, sectors 1-11)
- `cyborgPaths` — same structure (11 items)
- `illuminatePaths` — same structure (11 items)
- `superEarthCircle` — `{ id, cx, cy, r }`
- `factionIcons` — `Array<{ id, href, x, y, width, height }>` (4 items: bugs, cyborgs, illuminate, superearth)

The `sector` field is a number to avoid string parsing from `id`.

---

## 9. Validation Schemas

**Source:** `src/validators/`

All schemas use Zod v4 (`"zod": "^4.3.6"` in `package.json`). Every validator imports from `'zod'`, which is the standard import path for Zod v4.

---

### `isValidStatus`

**Source:** `src/validators/isValidStatus.js`
**Zod import:** `import { z } from 'zod'` (Zod v4)
**Export type:** Function — `(data: unknown) => SafeParseReturnType`

Validates the official API `get_campaign_status` response.

**Root schema fields:**

| Field             | Type                                           |
| ----------------- | ---------------------------------------------- |
| `time`            | `number`                                       |
| `error_code`      | `number`                                       |
| `campaign_status` | `campaignStatusSchema[]`                       |
| `defend_event`    | `defendEventSchema` (single object, not array) |
| `attack_events`   | `attackEventSchema[]`                          |
| `statistics`      | `statisticsSchema[]`                           |

**`campaignStatusSchema`:**

| Field                | Type                                       |
| -------------------- | ------------------------------------------ |
| `season`             | `number`                                   |
| `points`             | `number`                                   |
| `points_taken`       | `number`                                   |
| `points_max`         | `number`                                   |
| `status`             | `enum: 'active' \| 'defeated' \| 'hidden'` |
| `introduction_order` | `number`                                   |

**`defendEventSchema`:**

| Field        | Type                                    |
| ------------ | --------------------------------------- |
| `season`     | `number`                                |
| `event_id`   | `number`                                |
| `start_time` | `number`                                |
| `end_time`   | `number`                                |
| `region`     | `number`                                |
| `enemy`      | `number`                                |
| `points_max` | `number`                                |
| `points`     | `number`                                |
| `status`     | `enum: 'active' \| 'success' \| 'fail'` |

**`attackEventSchema`:** Same as defend event but **without** `region`, and with two additional fields:

| Additional field   | Type     |
| ------------------ | -------- |
| `players_at_start` | `number` |
| `max_event_id`     | `number` |

**`statisticsSchema`:**

| Field                      | Type     |
| -------------------------- | -------- |
| `season`                   | `number` |
| `season_duration`          | `number` |
| `enemy`                    | `number` |
| `players`                  | `number` |
| `total_unique_players`     | `number` |
| `missions`                 | `number` |
| `successful_missions`      | `number` |
| `total_mission_difficulty` | `number` |
| `completed_planets`        | `number` |
| `defend_events`            | `number` |
| `successful_defend_events` | `number` |
| `attack_events`            | `number` |
| `successful_attack_events` | `number` |
| `deaths`                   | `number` |
| `kills`                    | `number` |
| `accidentals`              | `number` |
| `shots`                    | `number` |
| `hits`                     | `number` |

---

### `isValidSeason`

**Source:** `src/validators/isValidSeason.js`
**Zod import:** `import { z } from 'zod'` (Zod v4)
**Export type:** Function — `(data: unknown) => SafeParseReturnType`

Validates the official API `get_snapshots` response.

**Root schema fields:**

| Field                | Type                                              |
| -------------------- | ------------------------------------------------- |
| `time`               | `number`                                          |
| `error_code`         | `number`                                          |
| `introduction_order` | `number[]`                                        |
| `points_max`         | `number[]`                                        |
| `snapshots`          | `snapshotSchema[]`                                |
| `defend_events`      | `eventSchema[]` (refined: must have `region`)     |
| `attack_events`      | `eventSchema[]` (refined: must not have `region`) |

**`snapshotSchema`:**

| Field    | Type     | Notes                                                                                           |
| -------- | -------- | ----------------------------------------------------------------------------------------------- |
| `season` | `number` |                                                                                                 |
| `time`   | `number` |                                                                                                 |
| `data`   | `string` | Stringified JSON. Validated by parsing and checking each item against `snapshotDataItemSchema`. |

`snapshotDataItemSchema` (not exported):

| Field          | Type                                       |
| -------------- | ------------------------------------------ |
| `points`       | `number`                                   |
| `points_taken` | `number`                                   |
| `status`       | `enum: 'hidden' \| 'active' \| 'defeated'` |

**`eventSchema`** (shared base for defend and attack events):

| Field              | Required | Type                        |
| ------------------ | -------- | --------------------------- |
| `season`           | Yes      | `number`                    |
| `event_id`         | Yes      | `number`                    |
| `start_time`       | Yes      | `number`                    |
| `end_time`         | Yes      | `number`                    |
| `enemy`            | Yes      | `number`                    |
| `points_max`       | Yes      | `number`                    |
| `points`           | Yes      | `number`                    |
| `status`           | Yes      | `enum: 'fail' \| 'success'` |
| `players_at_start` | Yes      | `number`                    |
| `region`           | No       | `number` (optional)         |

The distinction between defend and attack events is enforced via `.refine()`:

- `defend_events` entries: `region` must be **present** (not `undefined`).
- `attack_events` entries: `region` must be **absent** (`undefined`).

> **Note:** Unlike `isValidStatus`'s `attackEventSchema`, `isValidSeason`'s event status enum only includes `'fail' | 'success'` — there is no `'active'` status in historical snapshot data.

---

### `isValidFormData`

**Source:** `src/validators/isValidFormData.js`
**Zod import:** `import { z } from 'zod'` (Zod v4)
**Export type:** Zod schema object (not a function) — call `.safeParse(data)` directly

Discriminated union on the `action` field. Used by the `/api/h1/rebroadcast` endpoint after `formDataToObject` converts the request body.

**Actions and their required/optional fields:**

| `action` value               | Required fields                  | Optional fields             | Extra keys         |
| ---------------------------- | -------------------------------- | --------------------------- | ------------------ |
| `get_campaign_status`        | _(none beyond action)_           | —                           | Forbidden (strict) |
| `get_snapshots`              | `season` (via `schemaNumber`)    | —                           | Allowed            |
| `get_available_entitlements` | _(none beyond action)_           | —                           | Forbidden (strict) |
| `get_leaderboards`           | `network` (steam\|psn), `season` | `count`, `users` (string[]) | Allowed            |
| `get_usernames`              | `network` (steam\|psn), `count`  | —                           | Allowed            |

**`schemaNumber`** (also exported separately):

```ts
export const schemaNumber = z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.number().int().positive(),
);
```

Preprocesses a string to a number before validation. Used for form fields where numeric values arrive as strings. Validates: integer and positive (> 0).

---

### `isValidContentType`

**Source:** `src/validators/isValidContentType.js`
**Zod import:** `import { z } from 'zod'` (Zod v4)
**Export type:** Zod schema object — call `.safeParse(value)` directly

```ts
export const isValidContentType = z
    .string()
    .refine(
        (val) =>
            val.includes('multipart/form-data') ||
            val.includes('application/x-www-form-urlencoded'),
        { message: 'Invalid content type' },
    );
```

Validates the `Content-Type` request header. Uses `.includes()` (not exact match) so boundary parameters in `multipart/form-data` headers do not cause false failures. Used exclusively by the `/api/h1/rebroadcast` endpoint.

---

### `isValidNumber`

**Source:** `src/validators/isValidNumber.mjs`
**Zod import:** `import { z } from 'zod'` (Zod v4)
**Export type:** Zod schema object — call `.safeParse(value)` directly

```ts
export const isValidNumber = z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.number().int().positive(),
);
```

Identical preprocessing behavior to `schemaNumber` in `isValidFormData.js` — converts string to number then validates integer and positive. Used specifically for season number validation in `getSeason.mjs` and query parameter validation on the `/api/h1/campaign` endpoint.

> **Note:** `isValidNumber` and `schemaNumber` are functionally identical schemas defined in separate files. `isValidNumber` is in `src/validators/`, `schemaNumber` is co-located in `isValidFormData.js` and exported from there.

---

## 10. Snapshot Throttle Timers

**Source:** `src/update/snapshotTimers.mjs`

In-memory throttle layer that prevents the status pipeline from writing snapshots too frequently. Each function checks whether enough time has elapsed since the last snapshot before allowing a new write. On cold start (first call after process boot), the timers seed themselves from the database so restarts do not lose track of the last write time.

Called from `src/update/status.mjs` during the status update pipeline.

### Constants

| Constant                  | Value | Meaning                                          |
| ------------------------- | ----- | ------------------------------------------------ |
| `LIVE_SNAPSHOT_INTERVAL`  | `900` | Minimum seconds between live snapshots (15 min)  |
| `EVENT_SNAPSHOT_INTERVAL` | `600` | Minimum seconds between event snapshots (10 min) |

### In-memory state

| Variable                 | Type                  | Description                                         |
| ------------------------ | --------------------- | --------------------------------------------------- |
| `currentSeason`          | `number \| null`      | Tracks the current season; triggers reset on change |
| `lastLiveSnapshotTime`   | `number \| null`      | Epoch-seconds of the most recent live snapshot      |
| `lastEventSnapshotTimes` | `Map<string, number>` | Key: `${type}:${event_id}`, value: epoch-seconds    |

---

### `shouldTakeLiveSnapshot(season, apiTime)`

```ts
shouldTakeLiveSnapshot(season: number, apiTime: number): Promise<boolean>
```

**Behavior:**

1. Calls `resetIfSeasonChanged(season)` — if the season has changed since the last call, clears all in-memory state.
2. If `lastLiveSnapshotTime` is `null` (cold start), queries `h1_live_snapshot` for the most recent snapshot time for the given season. Seeds the in-memory timer with the result (or `0` if no rows exist).
3. Returns `true` if `apiTime - lastLiveSnapshotTime >= 900`.

**Throws:** Re-throws any Prisma error from the cold-start query.

---

### `recordLiveSnapshotTime(time)`

```ts
recordLiveSnapshotTime(time: number): Promise<void>
```

Updates `lastLiveSnapshotTime` in memory. Called after a successful live snapshot database write to advance the throttle window.

---

### `shouldTakeEventSnapshot(type, eventId, apiTime)`

```ts
shouldTakeEventSnapshot(type: string, eventId: number, apiTime: number): Promise<boolean>
```

**Behavior:**

1. Builds a lookup key as `${type}:${eventId}`.
2. If the key is not in `lastEventSnapshotTimes` (cold start for this event), queries `h1_event_snapshot` for the most recent snapshot time matching `type` and `event_id`. Seeds the map entry with the result (or `0` if no rows exist).
3. Returns `true` if `apiTime - lastEventSnapshotTimes.get(key) >= 600`.

**Throws:** Re-throws any Prisma error from the cold-start query.

---

### `recordEventSnapshotTime(type, eventId, time)`

```ts
recordEventSnapshotTime(type: string, eventId: number, time: number): Promise<void>
```

Updates the `lastEventSnapshotTimes` map entry for the given `${type}:${eventId}` key. Called after a successful event snapshot database write.

---

### `resetSnapshotTimers()`

```ts
resetSnapshotTimers(): Promise<void>
```

Clears all in-memory state: sets `lastLiveSnapshotTime` to `null` and clears the `lastEventSnapshotTimes` map. Not called internally — `resetIfSeasonChanged` performs its own inline reset. Exported for external callers that need a full manual reset.

---

## Cross-References

- See [04-api-reference.md](04-api-reference.md) for where these utilities are used in route handlers.
- See [03-data-flow.md](03-data-flow.md) for how `isValidStatus` and `isValidSeason` fit into the update pipeline.
