# SSE to Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SSE (EventSource) live data transport with stateless `setInterval` + `fetch` polling to eliminate RSC Flight stream conflicts.

**Architecture:** New lightweight `GET /api/h1/live` route serves `{ data, mapState }` JSON. The `useLiveData` hook replaces EventSource with `setInterval` polling at 10s intervals plus a `visibilitychange` listener for immediate refresh on tab focus. All server-side SSE infrastructure (sseManager, pg LISTEN/NOTIFY, stream route) is deleted. Consumer components unchanged.

**Tech Stack:** Next.js 16, Prisma 7, Vitest, existing `getCampaign` + `computeMapState` utilities

**Spec:** `docs/superpowers/specs/2026-04-07-sse-to-polling-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/h1/live/route.js` | Polling endpoint — getCampaign + computeMapState → JSON |
| Create | `src/__tests__/unit/app/api/h1/live.test.mjs` | Unit tests for the live route |
| Rewrite | `src/shared/hooks/useLiveData.mjs` | EventSource → setInterval + fetch + visibilitychange |
| Modify | `src/app/api/h1/update/route.js` | Remove `notifyUpdate()` call + import |
| Modify | `src/shared/utils/api/openapi.registry.mjs` | Replace `/api/h1/stream` with `/api/h1/live` |
| Modify | `src/__tests__/unit/shared/utils/api/openapiRegistry.test.mjs` | Update test expectations |
| Modify | `src/shared/components/StatusDot.jsx` | Update JSDoc (status values changed) |
| Modify | `CLAUDE.md` | Replace SSE architecture description with polling |
| Delete | `src/shared/utils/sse/sseManager.mjs` | SSE manager singleton |
| Delete | `src/app/api/h1/stream/route.js` | SSE HTTP endpoint |
| Delete | `src/update/notifyClient.mjs` | pg.Client for NOTIFY |

---

### Task 1: Create `/api/h1/live` Route

**Files:**
- Create: `src/app/api/h1/live/route.js`
- Reference: `src/shared/utils/sse/sseManager.mjs:95-112` (bigint serialization pattern)
- Reference: `src/shared/utils/api/responses.mjs` (errorResponse/successResponse)

- [ ] **Step 1: Create the route file**

```js
// src/app/api/h1/live/route.js
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { errorResponse } from '@/shared/utils/api/responses';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed';
import { getCampaign } from '@/db/queries/getCampaign';
import { computeMapState } from '@/shared/utils/game/computeMapState';
import { EVENT_STATUS } from '@/shared/enums/events';

export async function GET() {
    const start = performance.now();

    const { data, error } = await tryCatch(getCampaign());
    if (error || !data) {
        return errorResponse(500, start, error?.message ?? 'No campaign data');
    }

    const activeEvents = (data.events ?? []).filter(
        (e) => e.status === EVENT_STATUS.ACTIVE,
    );
    const mapState = computeMapState(data.live, activeEvents);

    const json = JSON.stringify({ data, mapState }, (_, v) =>
        typeof v === 'bigint' ? Number(v) : v,
    );

    return new Response(json, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors referencing the new route.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/h1/live/route.js
git commit -m "feat: add /api/h1/live polling endpoint"
```

---

### Task 2: Create Unit Tests for `/api/h1/live`

**Files:**
- Create: `src/__tests__/unit/app/api/h1/live.test.mjs`
- Reference: `src/app/api/h1/live/route.js`

- [ ] **Step 1: Write the test file**

```js
// src/__tests__/unit/app/api/h1/live.test.mjs
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before import
vi.mock('@/db/queries/getCampaign', () => ({
    getCampaign: vi.fn(),
}));
vi.mock('@/shared/utils/game/computeMapState', () => ({
    computeMapState: vi.fn(),
}));

const { getCampaign } = await import('@/db/queries/getCampaign');
const { computeMapState } = await import('@/shared/utils/game/computeMapState');
const { GET, POST, PUT, DELETE, PATCH, OPTIONS } = await import(
    '@/app/api/h1/live/route'
);

describe('/api/h1/live', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('GET returns campaign data with mapState', async () => {
        const mockCampaign = {
            season: 1,
            events: [
                { event_id: 1, type: 'defend', status: 'active' },
                { event_id: 2, type: 'attack', status: 'success' },
            ],
            live: [{ enemy: 'bugs', points: 50, points_max: 100 }],
        };
        const mockMapState = [0.5];

        getCampaign.mockResolvedValue(mockCampaign);
        computeMapState.mockReturnValue(mockMapState);

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(body.data).toEqual(mockCampaign);
        expect(body.mapState).toEqual(mockMapState);

        // computeMapState should only receive active events
        expect(computeMapState).toHaveBeenCalledWith(
            mockCampaign.live,
            [mockCampaign.events[0]], // only the active one
        );
    });

    test('GET returns 500 when getCampaign fails', async () => {
        getCampaign.mockRejectedValue(new Error('DB connection failed'));
        computeMapState.mockReturnValue([]);

        const response = await GET();
        expect(response.status).toBe(500);
    });

    test('GET returns 500 when getCampaign returns null', async () => {
        getCampaign.mockResolvedValue(null);
        computeMapState.mockReturnValue([]);

        const response = await GET();
        expect(response.status).toBe(500);
    });

    test('GET serializes bigint values as numbers', async () => {
        const mockCampaign = {
            season: 1,
            events: [],
            live: [],
            big_id: 9007199254740993n,
        };
        getCampaign.mockResolvedValue(mockCampaign);
        computeMapState.mockReturnValue([]);

        const response = await GET();
        const text = await response.text();

        // bigint should be serialized as number, not throw
        expect(text).toContain('9007199254740992'); // Number() truncation
        expect(text).not.toContain('n');
    });

    test.each([
        ['POST', POST],
        ['PUT', PUT],
        ['DELETE', DELETE],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])('%s returns 405', async (_, handler) => {
        const response = await handler();
        expect(response.status).toBe(405);
    });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test:unit -- src/__tests__/unit/app/api/h1/live.test.mjs`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/app/api/h1/live.test.mjs
git commit -m "test: add unit tests for /api/h1/live route"
```

---

### Task 3: Rewrite `useLiveData` Hook

**Files:**
- Rewrite: `src/shared/hooks/useLiveData.mjs`

This is the core change. Replace EventSource with `setInterval` + `fetch`. Keep: module singleton, leader election, localStorage cache, prevData tracking.

- [ ] **Step 1: Rewrite the hook**

```js
// src/shared/hooks/useLiveData.mjs
'use client';
import { useState, useEffect } from 'react';

const CACHE_KEY = 'hd1-live-cache';
const POLL_INTERVAL = 10_000;

function loadCachedState() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function saveCachedState(data, mapState) {
    try {
        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data, mapState, ts: Date.now() }),
        );
    } catch {
        // localStorage full or unavailable — ignore
    }
}

// Cache loaded once for offline PWA fallback
const cachedState = typeof window !== 'undefined' ? loadCachedState() : null;

// --- Module-level singleton store ---
//
// Live data lives in a module-level store shared across all hook instances.
// React subscribes via useState + useEffect — setState is batched by React
// 18+ and only processed when the scheduler is idle.

const INITIAL_STORE = Object.freeze({
    data: null,
    mapState: null,
    status: 'live', // optimistic — first poll completes within ~100ms
    prevData: null,
    isLeader: false,
});

let store = INITIAL_STORE;
let listeners = new Set();
let pollTimer = null;
let isFirstMessage = true;
let leaderChannel = null;
let leaderTimeout = null;
let visibilityHandler = null;

/** Notify all React subscribers with the current store value. */
function emit() {
    for (const listener of listeners) {
        listener(store);
    }
}

// --- Polling ---

/**
 * Fetch live campaign data from the polling endpoint.
 * On success: update store, cache to localStorage, emit to React.
 * On failure: set status to 'offline', emit.
 */
async function poll() {
    try {
        const res = await fetch('/api/h1/live');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = await res.json();

        saveCachedState(parsed.data, parsed.mapState);

        if (isFirstMessage) {
            isFirstMessage = false;
            store = { ...store, data: parsed.data, mapState: parsed.mapState, status: 'live' };
        } else {
            store = {
                ...store,
                prevData: store.data,
                data: parsed.data,
                mapState: parsed.mapState,
                status: 'live',
            };
        }
        emit();
    } catch {
        if (store.status !== 'offline') {
            store = { ...store, status: 'offline' };
            emit();
        }
    }
}

/**
 * Start polling. First fetch fires immediately, then every POLL_INTERVAL ms.
 * Also registers a visibilitychange listener for immediate refresh on tab focus
 * (browsers throttle setInterval to ~1min in background tabs).
 */
function connect() {
    if (pollTimer) return;
    isFirstMessage = true;

    // First poll immediately
    poll();

    // Start interval
    pollTimer = setInterval(poll, POLL_INTERVAL);

    // Refresh on tab focus
    visibilityHandler = () => {
        if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', visibilityHandler);
}

/** Stop polling and reset store. */
function disconnect() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
    }
    store = INITIAL_STORE;
}

// --- BroadcastChannel Leader Election ---

/**
 * Elect one browser tab as leader for Web Notifications.
 *
 * Uses random-timeout election: each tab sets a random delay (0-500ms).
 * First to fire claims leadership via BroadcastChannel. Other tabs
 * cancel their timeouts on receiving the claim.
 *
 * Race resolution: if a leader receives another tab's claim, it yields
 * and re-enters the election to ensure exactly one leader.
 */
function setupLeader() {
    if (leaderChannel) return;

    if (typeof BroadcastChannel === 'undefined') {
        store = { ...store, isLeader: true };
        return;
    }

    leaderChannel = new BroadcastChannel('hd1-sse-leader');

    function claimLeadership() {
        store = { ...store, isLeader: true };
        leaderChannel.postMessage({ type: 'leader-claim' });
        emit();
    }

    function startElection() {
        store = { ...store, isLeader: false };
        leaderTimeout = setTimeout(claimLeadership, Math.random() * 500);
    }

    leaderChannel.onmessage = (e) => {
        if (e.data.type === 'leader-claim') {
            clearTimeout(leaderTimeout);
            if (store.isLeader) {
                // Yield to the other tab's claim — re-elect
                store = { ...store, isLeader: false };
                leaderTimeout = setTimeout(claimLeadership, Math.random() * 500);
                emit();
            }
        }
        if (e.data.type === 'leader-ping' && store.isLeader) {
            leaderChannel.postMessage({ type: 'leader-claim' });
        }
    };

    startElection();
}

function teardownLeader() {
    clearTimeout(leaderTimeout);
    leaderTimeout = null;
    if (leaderChannel) {
        leaderChannel.close();
        leaderChannel = null;
    }
}

// --- Hook ---

/**
 * Hook that polls for live campaign data updates.
 *
 * Architecture: module-level singleton store with React useState + useEffect.
 * A setInterval + fetch polls /api/h1/live, then calls listeners which invoke
 * setState. A visibilitychange listener fires an immediate poll on tab focus.
 *
 * Key behaviors:
 * - First successful poll is a silent baseline — prevData is not set,
 *   preventing false change detection.
 * - Malformed responses are treated as poll failures (status → 'offline').
 * - BroadcastChannel leader election ensures only one tab fires OS
 *   notifications. Leaders yield on conflicting claims to prevent dupes.
 * - Fallback chain: live poll → server-rendered → localStorage cache → null.
 *
 * @param {Object} initialData - Server-rendered campaign data (null if offline)
 * @param {Object} initialMapState - Server-rendered map state (null if offline)
 * @returns {{ data: Object, mapState: Object, status: string, prevData: Object, isLeader: boolean }}
 */
export function useLiveData(initialData, initialMapState) {
    const [snapshot, setSnapshot] = useState(INITIAL_STORE);

    useEffect(() => {
        // Seed from localStorage cache (runs after hydration — no SSR mismatch)
        if (cachedState?.data && !store.data) {
            store = { ...store, data: cachedState.data, mapState: cachedState.mapState };
            setSnapshot(store);
        }

        // Subscribe: setState is batched by React — safe during Flight processing
        function onStoreChange(next) {
            setSnapshot(next);
        }
        listeners.add(onStoreChange);
        if (listeners.size === 1) {
            connect();
            setupLeader();
        }

        return () => {
            listeners.delete(onStoreChange);
            if (listeners.size === 0) {
                disconnect();
                teardownLeader();
            }
        };
    }, []);

    return {
        data: snapshot.data ?? initialData ?? cachedState?.data ?? null,
        mapState: snapshot.mapState ?? initialMapState ?? cachedState?.mapState ?? null,
        status: snapshot.status,
        prevData: snapshot.prevData,
        isLeader: snapshot.isLeader,
    };
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds. The hook is consumed by `LiveDataProvider` which is unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/shared/hooks/useLiveData.mjs
git commit -m "feat: replace EventSource with setInterval polling in useLiveData"
```

---

### Task 4: Remove `notifyUpdate()` from Update Route

**Files:**
- Modify: `src/app/api/h1/update/route.js:11,71`

- [ ] **Step 1: Remove the import and call**

In `src/app/api/h1/update/route.js`:

Remove import line 11:
```js
import { notifyUpdate } from '@/update/notifyClient';
```

Remove lines 70-71:
```js
    // Notify SSE clients that data has been updated
    await notifyUpdate();
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no references to `notifyUpdate`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/h1/update/route.js
git commit -m "refactor: remove notifyUpdate from update route"
```

---

### Task 5: Delete SSE Infrastructure Files

**Files:**
- Delete: `src/shared/utils/sse/sseManager.mjs`
- Delete: `src/app/api/h1/stream/route.js`
- Delete: `src/update/notifyClient.mjs`

- [ ] **Step 1: Delete the three files**

```bash
git rm src/shared/utils/sse/sseManager.mjs
git rm src/app/api/h1/stream/route.js
git rm src/update/notifyClient.mjs
```

- [ ] **Step 2: Check for any remaining imports**

Run: `grep -r "sseManager\|notifyClient\|/api/h1/stream" src/ --include="*.mjs" --include="*.js" --include="*.jsx" -l`

Expected: Only hits in documentation/diagram files (NotificationFlowDiagram.jsx, openapi.registry.mjs, docs pages, test files). No import statements in route handlers or hooks.

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds. No broken imports.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: delete SSE infrastructure (sseManager, stream route, notifyClient)"
```

---

### Task 6: Update OpenAPI Registry and Tests

**Files:**
- Modify: `src/shared/utils/api/openapi.registry.mjs:280-304`
- Modify: `src/__tests__/unit/shared/utils/api/openapiRegistry.test.mjs:18,22-25`

- [ ] **Step 1: Replace `/api/h1/stream` entry with `/api/h1/live` in registry**

In `src/shared/utils/api/openapi.registry.mjs`, replace lines 280-304:

```js
// /api/h1/stream - GET (SSE)
registry.registerPath({
    method: 'get',
    path: '/api/h1/stream',
    summary: 'Subscribe to real-time campaign updates via Server-Sent Events',
    description:
        'Opens a persistent SSE connection that pushes `campaign_update` events whenever the campaign state changes. Connect using the browser `EventSource` API or the `useLiveData` hook.',
    responses: {
        200: {
            description:
                'SSE stream opened. Events are pushed as `event: campaign_update` with JSON data.',
            content: {
                'text/event-stream': {
                    schema: z.string().openapi({
                        description:
                            'Server-Sent Events stream. Each event: `event: campaign_update\\ndata: {…}\\n\\n`',
                    }),
                },
            },
        },
        503: {
            description: 'SSE service is unhealthy or unavailable.',
        },
    },
});
```

With:

```js
// /api/h1/live - GET (polling)
registry.registerPath({
    method: 'get',
    path: '/api/h1/live',
    summary: 'Get current campaign state for live polling',
    description:
        'Lightweight endpoint returning the current campaign data and computed map state. Designed for client-side polling via `useLiveData` hook at 10-second intervals.',
    responses: {
        200: {
            description: 'Current campaign state with computed map ownership.',
            content: {
                'application/json': {
                    schema: z.object({
                        data: z.any().openapi({ description: 'Full campaign object' }),
                        mapState: z.array(z.any()).openapi({ description: 'Sector ownership array' }),
                    }),
                },
            },
        },
        500: {
            description: 'Database error fetching campaign data.',
        },
    },
});
```

- [ ] **Step 2: Update test expectations**

In `src/__tests__/unit/shared/utils/api/openapiRegistry.test.mjs`:

Replace line 18:
```js
        expect(spec.paths).toHaveProperty('/api/h1/stream');
```
With:
```js
        expect(spec.paths).toHaveProperty('/api/h1/live');
```

Replace lines 22-25:
```js
    test('/api/h1/stream has GET with text/event-stream response', () => {
        const stream = spec.paths['/api/h1/stream'].get;
        expect(stream.responses['200'].content).toHaveProperty('text/event-stream');
    });
```
With:
```js
    test('/api/h1/live has GET with application/json response', () => {
        const live = spec.paths['/api/h1/live'].get;
        expect(live.responses['200'].content).toHaveProperty('application/json');
    });
```

- [ ] **Step 3: Run the tests**

Run: `npm run test:unit -- src/__tests__/unit/shared/utils/api/openapiRegistry.test.mjs`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/shared/utils/api/openapi.registry.mjs src/__tests__/unit/shared/utils/api/openapiRegistry.test.mjs
git commit -m "refactor: replace /api/h1/stream with /api/h1/live in OpenAPI registry"
```

---

### Task 7: Update StatusDot JSDoc

**Files:**
- Modify: `src/shared/components/StatusDot.jsx`

- [ ] **Step 1: Update the JSDoc comment**

In `src/shared/components/StatusDot.jsx`, replace the JSDoc block:

```jsx
/**
 * Small connection-status dot that reads SSE status from LiveDataContext.
 * Used by HeaderNav and BottomNav to show real connection state.
 *
 * Two states: green (live) or red (anything else — connecting, reconnecting, offline).
 */
```

With:

```jsx
/**
 * Small connection-status dot that reads poll status from LiveDataContext.
 * Used by HeaderNav and BottomNav to show real connection state.
 *
 * Two states: green (live — last poll succeeded) or red (offline — last poll failed).
 */
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/components/StatusDot.jsx
git commit -m "docs: update StatusDot JSDoc for polling status model"
```

---

### Task 8: Update CLAUDE.md Architecture Section

**Files:**
- Modify: `CLAUDE.md:126`

- [ ] **Step 1: Replace the SSE bullet point**

In `CLAUDE.md`, replace line 126:

```markdown
- **SSE live updates:** Worker polls API → DB write → `pg NOTIFY campaign_update` → SSE manager (`src/shared/utils/sse/sseManager.mjs`) broadcasts full campaign state via `/api/h1/stream` → `useLiveData` hook (`src/shared/hooks/useLiveData.mjs`) replaces React state. Postgres LISTEN/NOTIFY bridges worker thread and Next.js process (Prisma doesn't support LISTEN/NOTIFY — uses dedicated `pg.Client`).
```

With:

```markdown
- **Live polling:** `useLiveData` hook (`src/shared/hooks/useLiveData.mjs`) polls `GET /api/h1/live` every 10 seconds via `setInterval` + `fetch`. A `visibilitychange` listener fires an immediate poll on tab focus. Status is `'live'` (last poll succeeded) or `'offline'` (last poll failed). Module-level singleton ensures one connection per tab. BroadcastChannel leader election for Web Notifications.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md architecture for polling"
```

---

### Task 9: Full Verification

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All tests pass. No broken imports or references to deleted files.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds cleanly.

- [ ] **Step 3: Verify no dangling references**

Run: `grep -r "sseManager\|EventSource\|notifyClient\|LISTEN\|NOTIFY" src/ --include="*.mjs" --include="*.js" --include="*.jsx" -l`

Expected: Only documentation files (NotificationFlowDiagram.jsx, docs pages). No functional code references. The notification docs and flow diagram are informational and can be updated in a follow-up if desired.

- [ ] **Step 4: Manual smoke test**

Ask the user to:
1. Start the dev server (`npm run dev`)
2. Open the dashboard — verify data loads within ~1 second
3. Check the status dot shows green
4. Wait 10+ seconds — verify data refreshes (check Network tab for `/api/h1/live` requests)
5. Switch to another tab for 30 seconds, switch back — verify immediate refresh on return
6. Check toast notifications still fire on event transitions

- [ ] **Step 5: Commit any fixes from verification**

If any issues found, fix and commit before proceeding.
