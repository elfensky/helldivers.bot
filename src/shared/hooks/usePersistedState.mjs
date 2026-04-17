'use client';
import { useState, useCallback } from 'react';
import { setPreferenceCookie } from '@/shared/utils/cookies.mjs';

/**
 * Scalar state persisted to a cookie under `key`. The `initial` value
 * comes from the server (read from `cookies()` in the page component
 * and forwarded as a prop), so the first client render matches what
 * the server rendered — no hydration mismatch, no post-hydration flash.
 *
 * The write side updates React state and the cookie in one call.
 * Values are stored as raw strings; validate at the server boundary
 * before passing initial in (see `src/shared/preferences/*`).
 */
export function usePersistedState(key, initial) {
    const [value, setValue] = useState(initial);

    const update = useCallback(
        (next) => {
            setValue(next);
            setPreferenceCookie(key, next);
        },
        [key],
    );

    return [value, update];
}
