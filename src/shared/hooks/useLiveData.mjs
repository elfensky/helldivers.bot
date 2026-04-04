'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that connects to the SSE stream for live campaign data updates.
 *
 * First SSE message is treated as a silent baseline (no prevData set)
 * to avoid false change detection when SSR data is stale.
 *
 * @param {Object} initialData - Server-rendered campaign data
 * @param {Object} initialMapState - Server-rendered map state
 * @returns {{ data, mapState, status, prevData }}
 */
export function useLiveData(initialData, initialMapState) {
    const [data, setData] = useState(initialData);
    const [mapState, setMapState] = useState(initialMapState);
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
        const es = new EventSource('/api/h1/stream');

        es.onopen = () => {
            setStatus('live');
        };

        es.onmessage = (event) => {
            const parsed = JSON.parse(event.data);

            if (isFirstMessage.current) {
                // Silent baseline — don't set prevData to avoid false diffs
                isFirstMessage.current = false;
                setData(parsed.data);
                setMapState(parsed.mapState);
                return;
            }

            // Store previous data for change detection
            setData((current) => {
                prevDataRef.current = current;
                return parsed.data;
            });
            setMapState(parsed.mapState);
        };

        es.onerror = () => {
            setStatus((current) => (current === 'live' ? 'reconnecting' : current));
        };

        return () => {
            es.close();
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
