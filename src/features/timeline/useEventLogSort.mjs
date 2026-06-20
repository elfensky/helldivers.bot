'use client';
import { useToggleSort } from '@/shared/hooks/useToggleSort.mjs';
import { SORT_ORDER_KEY } from '@/shared/preferences/sortOrder.mjs';

/**
 * Cookie-backed sort preference for the shared event log component.
 *
 * Takes the server-read initial value as a prop so the first render
 * matches the user's stored preference. Returns `[sortOrder, toggleSortOrder]`.
 */
export function useEventLogSort(initial) {
    return useToggleSort(SORT_ORDER_KEY, initial, ['desc', 'asc']);
}
