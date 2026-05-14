'use client';
import { useState, useEffect } from 'react';
import { guardedReload, clearReloadGuard } from '@/shared/utils/reloadGuard.mjs';

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
    status: 'polling', // safe default for SSR — connect() checks navigator.onLine
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
let emitScheduled = false;

/**
 * Notify all React subscribers with the current store value.
 *
 * Deferred to requestIdleCallback (setTimeout fallback) to prevent
 * setState from firing during RSC Flight stream processing, which
 * causes `chunk.reason.enqueueModel is not a function` crashes
 * (vercel/next.js#92362). Coalesces rapid-fire calls so listeners
 * always receive the latest store snapshot.
 */
function emit() {
    if (emitScheduled) return;
    emitScheduled = true;
    const schedule =
        typeof requestIdleCallback === 'function' ? requestIdleCallback : setTimeout;
    schedule(() => {
        emitScheduled = false;
        for (const listener of listeners) {
            listener(store);
        }
    });
}

// --- Polling ---

/**
 * Fetch live campaign data from the polling endpoint.
 * On success: update store, cache to localStorage, emit to React.
 * On failure: set status to 'offline', emit.
 */
async function poll() {
    if (store.status !== 'polling') {
        store = { ...store, status: 'polling' };
        emit();
    }

    try {
        const res = await fetch('/api/h1/live');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const parsed = await res.json();

        if (parsed.appVersion) {
            if (parsed.appVersion !== process.env.NEXT_PUBLIC_APP_VERSION) {
                guardedReload('version');
                return;
            }
            clearReloadGuard();
        }

        saveCachedState(parsed.data, parsed.mapState);

        if (isFirstMessage) {
            isFirstMessage = false;
            store = {
                ...store,
                data: parsed.data,
                mapState: parsed.mapState,
                status: 'live',
            };
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
    emitScheduled = false;
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
                leaderTimeout = setTimeout(
                    claimLeadership,
                    Math.random() * 500,
                );
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
 * Status tri-state: 'polling' (request in flight), 'live' (last poll succeeded),
 * 'offline' (last poll failed or navigator.onLine is false at init).
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
            store = {
                ...store,
                data: cachedState.data,
                mapState: cachedState.mapState,
            };
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
        mapState:
            snapshot.mapState ?? initialMapState ?? cachedState?.mapState ?? null,
        status: snapshot.status,
        prevData: snapshot.prevData,
        isLeader: snapshot.isLeader,
    };
}
