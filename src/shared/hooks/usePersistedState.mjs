'use client';
import { useState, useEffect, useCallback } from 'react';

/**
 * Scalar state persisted to localStorage under `key`. Initial render uses
 * `defaultValue` to keep SSR and hydration identical — the persisted value
 * is applied in a mount effect, so any SSR'd markup matches the client's
 * first paint.
 *
 * Values are stored as raw strings. `isValid` (optional) filters out
 * stale or garbage values from localStorage, falling back to `defaultValue`
 * if the stored value fails the check.
 *
 * Wrap for each preference concept (see `useFactionPreference`,
 * `useRegionsView`, `useEventLogSort`) so call sites stay concept-named
 * rather than passing raw keys + validators inline.
 */
export function usePersistedState(key, defaultValue, isValid) {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(key);
            if (saved !== null && (!isValid || isValid(saved))) {
                setValue(saved);
            }
        } catch {
            // localStorage unavailable — keep default
        }
    }, [key]);

    const update = useCallback(
        (next) => {
            setValue(next);
            try {
                localStorage.setItem(key, next);
            } catch {
                // ignore
            }
        },
        [key],
    );

    return [value, update];
}
