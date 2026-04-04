'use client';
import { useState, useEffect, useRef, startTransition } from 'react';

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

/**
 * Hook that connects to the SSE stream for live campaign data updates.
 *
 * First SSE message is treated as a silent baseline (no prevData set)
 * to avoid false change detection when SSR data is stale.
 *
 * Falls back to localStorage cache when SSR data is unavailable (offline PWA).
 *
 * @param {Object} initialData - Server-rendered campaign data (null if offline)
 * @param {Object} initialMapState - Server-rendered map state (null if offline)
 * @returns {{ data, mapState, status, prevData }}
 */
export function useLiveData(initialData, initialMapState) {
    const [data, setData] = useState(() => {
        if (initialData) return initialData;
        return loadCachedState()?.data ?? null;
    });
    const [mapState, setMapState] = useState(() => {
        if (initialMapState) return initialMapState;
        return loadCachedState()?.mapState ?? null;
    });
    const [status, setStatus] = useState('connecting');

    const prevDataRef = useRef(null);
    const isFirstMessage = useRef(true);
    const isLeaderRef = useRef(false);

    // BroadcastChannel leader election for Web Notifications
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') {
            isLeaderRef.current = true;
            return;
        }

        const channel = new BroadcastChannel('hd1-sse-leader');
        let electionTimeout;

        function claimLeadership() {
            isLeaderRef.current = true;
            channel.postMessage({ type: 'leader-claim' });
        }

        function startElection() {
            isLeaderRef.current = false;
            electionTimeout = setTimeout(claimLeadership, Math.random() * 500);
        }

        channel.onmessage = (e) => {
            if (e.data.type === 'leader-claim' && !isLeaderRef.current) {
                clearTimeout(electionTimeout);
                isLeaderRef.current = false;
            }
            if (e.data.type === 'leader-ping') {
                if (isLeaderRef.current) {
                    channel.postMessage({ type: 'leader-claim' });
                }
            }
        };

        startElection();

        return () => {
            clearTimeout(electionTimeout);
            channel.close();
        };
    }, []);

    // SSE connection
    useEffect(() => {
        let closed = false;
        const es = new EventSource('/api/h1/stream');

        es.onopen = () => {
            setStatus('live');
        };

        es.onmessage = (event) => {
            if (closed) return;
            const parsed = JSON.parse(event.data);

            // Cache for offline use (always, even if state update is deferred)
            saveCachedState(parsed.data, parsed.mapState);

            // Defer state updates to avoid interfering with RSC flight stream
            // processing during client-side navigation. setTimeout pushes to
            // the next event loop tick; startTransition marks as low-priority.
            setTimeout(() => {
                if (closed) return;
                startTransition(() => {
                    if (isFirstMessage.current) {
                        isFirstMessage.current = false;
                        setData(parsed.data);
                        setMapState(parsed.mapState);
                        return;
                    }

                    setData((current) => {
                        prevDataRef.current = current;
                        return parsed.data;
                    });
                    setMapState(parsed.mapState);
                });
            }, 0);
        };

        es.onerror = () => {
            setStatus((current) => (current === 'live' ? 'reconnecting' : current));
        };

        // Close SSE before client-side navigation starts to prevent state
        // updates from corrupting the RSC flight stream.
        function closeSSE() {
            closed = true;
            es.close();
        }

        // Navigation API (Chrome 102+) catches all navigation types
        // including router.push, link clicks, and back/forward.
        function handleNavigate(e) {
            if (e.navigationType !== 'reload') closeSSE();
        }
        const hasNavAPI = typeof navigation !== 'undefined';
        if (hasNavAPI) {
            navigation.addEventListener('navigate', handleNavigate);
        }

        // Fallback: capture-phase click handler for link clicks (all browsers)
        function handleNavClick(e) {
            const anchor = e.target.closest?.('a[href]');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (href && href.startsWith('/') && href !== window.location.pathname) {
                closeSSE();
            }
        }
        if (!hasNavAPI) {
            document.addEventListener('click', handleNavClick, true);
        }

        return () => {
            closeSSE();
            if (hasNavAPI) {
                navigation.removeEventListener('navigate', handleNavigate);
            } else {
                document.removeEventListener('click', handleNavClick, true);
            }
        };
    }, []);

    return {
        data,
        mapState,
        status,
        prevData: prevDataRef.current,
        isLeader: isLeaderRef.current,
    };
}
