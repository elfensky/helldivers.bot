'use client';
import { useCallback } from 'react';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';
import {
    CASCADE_SORT_ORDER_KEY,
    CASCADE_SORT_ORDER_DEFAULT,
} from '@/shared/preferences/sortOrder.mjs';

/**
 * Cookie-backed sort preference for the cascade log. Independent of the
 * dashboard event log's sort. Returns `[sortOrder, toggleSortOrder]`.
 *
 * @param {'worst'|'recent'} [initial] - Optional initial value
 */
export function useCascadeLogSort(initial = CASCADE_SORT_ORDER_DEFAULT) {
    const [sortOrder, setSortOrder] = usePersistedState(CASCADE_SORT_ORDER_KEY, initial);
    const toggleSortOrder = useCallback(() => {
        setSortOrder(sortOrder === 'worst' ? 'recent' : 'worst');
    }, [sortOrder, setSortOrder]);
    return [sortOrder, toggleSortOrder];
}
