'use client';
import { useCallback } from 'react';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';

/**
 * Cookie-backed two-value sort preference. Wraps `usePersistedState` and
 * returns `[value, toggle]`, where `toggle` flips between the two values
 * `a` and `b`.
 *
 * @param {string} key - Cookie key for the persisted preference.
 * @param {string} initial - Server-read initial value (forwarded as a prop).
 * @param {[string, string]} pair - The two values to toggle between.
 * @returns {[string, () => void]}
 */
export function useToggleSort(key, initial, [a, b]) {
    const [value, setValue] = usePersistedState(key, initial);

    const toggle = useCallback(() => {
        setValue(value === a ? b : a);
    }, [value, setValue, a, b]);

    return [value, toggle];
}
