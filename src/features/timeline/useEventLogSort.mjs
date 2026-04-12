'use client';
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'event-log-sort';

/**
 * localStorage-backed sort preference for the shared event log component.
 *
 * Returns `[sortOrder, toggleSortOrder]`. Default is `'desc'` (newest first).
 * State is seeded after hydration via useEffect to avoid SSR mismatch —
 * matches the pattern used by other preference hooks in the archives feature.
 */
export function useEventLogSort() {
    const [sortOrder, setSortOrder] = useState('desc');

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === 'asc' || stored === 'desc') {
                setSortOrder(stored);
            }
        } catch {
            // localStorage unavailable — keep default
        }
    }, []);

    const toggleSortOrder = useCallback(() => {
        setSortOrder((prev) => {
            const next = prev === 'desc' ? 'asc' : 'desc';
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch {
                // localStorage unavailable — still update state in memory
            }
            return next;
        });
    }, []);

    return [sortOrder, toggleSortOrder];
}
