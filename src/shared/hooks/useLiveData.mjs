'use client';
import { useSyncExternalStore } from 'react';

const CACHE_KEY = 'hd1-live-cache';

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

// --- External Store (module-level singleton) ---
//
// SSE data lives outside React's state system to avoid collisions with
// the RSC Flight stream during client-side navigation. React pulls
// snapshots via useSyncExternalStore when safe to render, rather than
// having startTransition push updates into the Fiber queue mid-flight.

const INITIAL_STORE = Object.freeze({
    data: null,
    mapState: null,
    status: 'connecting',
    prevData: null,
    isLeader: false,
});

let store = INITIAL_STORE;
let listeners = new Set();
let es = null;
let isFirstMessage = true;
let leaderChannel = null;
let leaderTimeout = null;

/** Notify all useSyncExternalStore subscribers that the store changed. */
function emit() {
    for (const listener of listeners) {
        listener();
    }
}

function getSnapshot() {
    return store;
}

function getServerSnapshot() {
    return INITIAL_STORE;
}

// --- SSE Connection ---

/**
 * Opens an EventSource to /api/h1/stream. Guarded — no-ops if already connected.
 *
 * onopen resets isFirstMessage so the first message after every (re)connection
 * is treated as a silent baseline, preventing false change detection.
 *
 * onmessage parses with try/catch — malformed data is silently dropped
 * rather than killing the handler permanently.
 */
function connect() {
    if (es) return;
    isFirstMessage = true;

    es = new EventSource('/api/h1/stream');

    es.onopen = () => {
        isFirstMessage = true;
        store = { ...store, status: 'live' };
        emit();
    };

    es.onmessage = (event) => {
        let parsed;
        try {
            parsed = JSON.parse(event.data);
        } catch {
            return;
        }
        saveCachedState(parsed.data, parsed.mapState);

        if (isFirstMessage) {
            isFirstMessage = false;
            store = { ...store, data: parsed.data, mapState: parsed.mapState };
        } else {
            store = {
                ...store,
                prevData: store.data,
                data: parsed.data,
                mapState: parsed.mapState,
            };
        }
        emit();
    };

    es.onerror = () => {
        if (store.status === 'live') {
            store = { ...store, status: 'reconnecting' };
            emit();
        }
    };
}

/** Close EventSource, reset store to initial state, and notify listeners. */
function disconnect() {
    if (es) {
        es.close();
        es = null;
    }
    store = INITIAL_STORE;
    emit();
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

// --- Subscribe / Unsubscribe ---

/**
 * useSyncExternalStore subscribe function. Connects on first subscriber,
 * disconnects when the last subscriber leaves.
 * @param {Function} listener - React's re-render trigger
 * @returns {Function} Unsubscribe callback
 */
function subscribe(listener) {
    listeners.add(listener);
    if (listeners.size === 1) {
        connect();
        setupLeader();
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            disconnect();
            teardownLeader();
        }
    };
}

// --- Hook ---

/**
 * Hook that connects to the SSE stream for live campaign data updates.
 *
 * Architecture: useSyncExternalStore with a module-level singleton store.
 * SSE data lives outside React — React pulls snapshots when safe to render.
 * This eliminates the enqueueModel crash caused by startTransition racing
 * with RSC Flight stream processing during client-side navigation.
 *
 * Key behaviors:
 * - First SSE message after each (re)connection is a silent baseline —
 *   prevData is not set, preventing false change detection from stale SSR.
 * - Malformed SSE messages are silently dropped (JSON.parse failure).
 * - BroadcastChannel leader election ensures only one tab fires OS
 *   notifications. Leaders yield on conflicting claims to prevent dupes.
 * - Falls back to localStorage cache when SSR data unavailable (offline PWA).
 * - Fallback chain: live SSE → server-rendered → localStorage cache → null.
 *
 * @param {Object} initialData - Server-rendered campaign data (null if offline)
 * @param {Object} initialMapState - Server-rendered map state (null if offline)
 * @returns {{ data: Object, mapState: Object, status: string, prevData: Object, isLeader: boolean }}
 */
export function useLiveData(initialData, initialMapState) {
    const snapshot = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot,
    );

    return {
        data: snapshot.data ?? initialData ?? cachedState?.data ?? null,
        mapState:
            snapshot.mapState ??
            initialMapState ??
            cachedState?.mapState ??
            null,
        status: snapshot.status,
        prevData: snapshot.prevData,
        isLeader: snapshot.isLeader,
    };
}
