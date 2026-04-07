# Replace SSE with Polling

**Date:** 2026-04-07
**Status:** Draft
**Motivation:** SSE (EventSource) fires browser-level events outside React's control, causing `enqueueModel` crashes when concurrent activity occurs during RSC Flight stream processing (`vercel/next.js#92362`). This forced the app to use `<a>` tags instead of `<Link>` (since restored). Removing SSE eliminates the conflict class entirely — a periodic `fetch` updates state through normal `setState`, which React batches safely.

## Requirements

- Replace SSE with main-thread `setInterval` + `fetch` polling at 10-second intervals
- Keep polling in `LiveDataProvider` (layout-level) so all pages receive live data and notifications
- Remove all server-side SSE infrastructure: sseManager, `/api/h1/stream`, notifyClient, pg LISTEN/NOTIFY
- Keep all notification features: Sonner toasts, browser Notifications API, Web Push, BroadcastChannel leader election
- Keep `LiveDataProvider`, `LiveDataContext`, and `useLiveDataContext()` interface unchanged
- Status indicator: green on last poll success, red on last poll failure, optimistic green on initial load

## Approach

Stateless polling via a new lightweight API route. The client fetches on an interval; no persistent connections, no server-side connection tracking, no heartbeats.

### 1. New Route: `GET /api/h1/live`

**File:** `src/app/api/h1/live/route.js`

Lightweight endpoint returning the same payload shape the SSE stream currently delivers:

```json
{ "data": { /* campaign object */ }, "mapState": [ /* sector ownership */ ] }
```

**Logic:**
1. Call `getCampaign()` (no season param — current season only). Note: `getCampaign` is wrapped in React's `cache()`, which deduplicates within a single request context — safe for API routes, each request gets its own call.
2. Filter active events from `data.events`
3. Call `computeMapState(data.live, activeEvents)`
4. Serialize with bigint handling using the same `JSON.stringify` replacer pattern from `sseManager._fetchAndCache()`: `JSON.stringify({ data, mapState }, (_, v) => typeof v === 'bigint' ? Number(v) : v)`
5. Return with `Cache-Control: no-store`

**Not included:** No analytics tracking, no `?season` parameter, no remote-fetch fallback. This is an internal polling endpoint, not a public API.

**Error handling:** On DB error, return `500` with `errorResponse()`. The client treats any non-OK response as a failed poll (status → `'offline'`).

### 2. Rewritten `useLiveData` Hook

**File:** `src/shared/hooks/useLiveData.mjs`

Replace `EventSource` with `setInterval` + `fetch`. Everything else stays.

**Unchanged:**
- Module-level singleton store shared across all hook instances
- `listeners` Set + `emit()` for React state sync
- BroadcastChannel leader election (all logic unchanged)
- localStorage cache (`hd1-live-cache` key, same read/write pattern)
- `prevData` tracking with first-message baseline (first successful poll is silent — no `prevData` set, preventing false change detection on page load)
- Fallback chain: live poll → server-rendered `initialData` → localStorage cache → null

**Changed:**
- `connect()`: executes first `fetch('/api/h1/live')` immediately, then starts `setInterval` at `POLL_INTERVAL` (10000ms). Also registers a `visibilitychange` listener that fires an immediate poll when the tab becomes visible — browsers throttle `setInterval` to ~1min in background tabs, so this ensures fresh data on tab focus.
- `disconnect()`: calls `clearInterval`, removes `visibilitychange` listener, resets store to `INITIAL_STORE`
- On fetch success: parse JSON, update store `data`/`mapState`, handle `prevData` (same first-message logic), set `status: 'live'`, call `saveCachedState()`, `emit()`
- On fetch failure (network error or non-OK status): set `status: 'offline'`, `emit()`. Interval keeps firing — next success transitions back to `'live'`.
- No reconnection/backoff logic needed. Each poll is independent.

**Status model simplified:**
- `'live'` — last poll succeeded (also the initial state, optimistic)
- `'offline'` — last poll failed

**Constant:** `const POLL_INTERVAL = 10_000;`

### 3. Files to Delete

| File | Purpose |
|------|---------|
| `src/shared/utils/sse/sseManager.mjs` | SSE manager singleton, pg LISTEN, broadcast, heartbeat, rate limiting |
| `src/app/api/h1/stream/route.js` | SSE HTTP endpoint |
| `src/update/notifyClient.mjs` | Dedicated pg.Client for pg NOTIFY |

### 4. Files to Modify

**`src/app/api/h1/update/route.js`:**
- Remove `notifyUpdate()` call and its import from `notifyClient.mjs`
- Everything else stays: HD1 API fetch, DB write, `checkAndNotify()` for Web Push

**`src/shared/hooks/useLiveData.mjs`:**
- Full rewrite of connection logic (EventSource → setInterval + fetch)
- Remove stale JSDoc about `vercel/next.js#92362` and `<a>` tag workaround

### 5. Files Unchanged

- `src/shared/providers/LiveDataProvider.jsx` — calls `useLiveData()`, same interface
- `src/shared/providers/LiveDataContext.mjs` — context + `useLiveDataContext()` hook
- `src/features/notifications/LiveToasts.jsx` — consumes `prevData`/`data`/`isLeader`, unchanged
- `src/shared/components/StatusDot.jsx` — checks `status === 'live'`, works with new status model
- `src/shared/utils/game/detectChanges.mjs` — pure function, no transport dependency
- `src/features/dashboard/DashboardClient.jsx` — consumes context, unchanged
- `public/sw.js` — service worker handles push independently
- `public/workers/cron.js` — worker polls HD1 API on its own interval

### 6. Documentation Updates

- **`CLAUDE.md`:** Replace SSE pipeline description in Architecture section with polling description. Remove references to sseManager, pg LISTEN/NOTIFY, stream route. Update the SSE bullet point under "Architecture — Stack".
- **`useLiveData.mjs` JSDoc:** Remove references to enqueueModel bug, `<a>` tag workaround, Turbopack.

## Data Flow (After)

```
Worker Thread (cron.js)
    ↓ polls HD1 API every ~20s
HTTP POST /api/h1/update
    ↓ writes to DB, fires Web Push via checkAndNotify()
    (no more pg NOTIFY)

Client (every 10s):
fetch GET /api/h1/live
    ↓ getCampaign() + computeMapState()
    ↓ JSON response
useLiveData (setInterval callback)
    ↓ update store, emit()
React Components
    ├─ DashboardClient (map + events)
    └─ LiveToasts
        ├─ detectChanges(prevData, data)
        ├─ Sonner Toast (all tabs)
        └─ Web Notification (leader tab only)
```

## What This Eliminates

- `EventSource` persistent connection (the source of RSC Flight conflicts)
- Server-side connection tracking, heartbeats, IP rate limiting, dedup window
- Dedicated `pg.Client` for LISTEN/NOTIFY
- ~300 lines of server-side SSE infrastructure

## What This Preserves

- All notification features (toasts, browser notifications, Web Push, leader election)
- localStorage offline fallback for PWA
- Module-level singleton pattern (no duplicate connections across components)
- `prevData` change detection with first-message baseline
- `LiveDataProvider` / `LiveDataContext` interface (zero consumer changes)
