'use client';
import { useState, useEffect } from 'react';

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

// --- Module-level singleton store ---
//
// SSE data lives in a module-level store shared across all hook instances.
// React subscribes via useState + useEffect — setState is batched by React
// 18+ and only processed when the scheduler is idle, preventing collisions
// with RSC Flight stream processing during client-side navigation.

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

/** Notify all React subscribers with the current store value. */
function emit() {
    for (const listener of listeners) {
        listener(store);
    }
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

/** Close EventSource and reset store to initial state. */
function disconnect() {
    if (es) {
        es.close();
        es = null;
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
 * Hook that connects to the SSE stream for live campaign data updates.
 *
 * Architecture: module-level singleton store with React useState + useEffect.
 * SSE mutates the store, then calls listeners which invoke setState.
 *
 * Note: react-server-dom-turbopack has a bug where any concurrent React
 * activity during RSC Flight stream processing crashes with "enqueueModel
 * is not a function" (vercel/next.js#92362). This affects Turbopack dev
 * only — production builds use Webpack and are unaffected. The app uses
 * native <a> links (not Next.js <Link>) to avoid client-side RSC
 * navigation entirely until the upstream bug is fixed.
 *
 * Key behaviors:
 * - First SSE message after each (re)connection is a silent baseline —
 *   prevData is not set, preventing false change detection.
 * - Malformed SSE messages are silently dropped (JSON.parse failure).
 * - BroadcastChannel leader election ensures only one tab fires OS
 *   notifications. Leaders yield on conflicting claims to prevent dupes.
 * - Fallback chain: live SSE → server-rendered → localStorage cache → null.
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
