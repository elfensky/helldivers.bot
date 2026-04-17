'use client';
import { useCallback } from 'react';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';

/**
 * localStorage-backed sort preference for the shared event log component.
 *
 * Returns `[sortOrder, toggleSortOrder]`. Default is `'desc'` (newest first).
 * Backed by the generic `usePersistedState` so the persistence machinery
 * stays centralized.
 */
export function useEventLogSort() {
    const [sortOrder, setSortOrder] = usePersistedState(
        'event-log-sort',
        'desc',
        (v) => v === 'asc' || v === 'desc',
    );

    const toggleSortOrder = useCallback(() => {
        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    }, [sortOrder, setSortOrder]);

    return [sortOrder, toggleSortOrder];
}
