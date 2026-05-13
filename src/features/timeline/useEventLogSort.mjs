'use client';
import { useCallback } from 'react';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';
import { SORT_ORDER_KEY } from '@/shared/preferences/sortOrder.mjs';

/**
 * Cookie-backed sort preference for the shared event log component.
 *
 * Takes the server-read initial value as a prop so the first render
 * matches the user's stored preference. Returns `[sortOrder, toggleSortOrder]`.
 */
export function useEventLogSort(initial) {
    const [sortOrder, setSortOrder] = usePersistedState(SORT_ORDER_KEY, initial);

    const toggleSortOrder = useCallback(() => {
        setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    }, [sortOrder, setSortOrder]);

    return [sortOrder, toggleSortOrder];
}
