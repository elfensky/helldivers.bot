'use client';

import { useCallback } from 'react';

/**
 * Client-side Umami tracking hook. Returns a stable callback that
 * calls `window.umami.track()` if the tracker script is loaded.
 * Silently no-ops when blocked by ad blockers or in dev mode.
 *
 * For tracking inside useEffect callbacks (where hooks can't be called),
 * use `window.umami?.track()` directly instead.
 *
 * @returns {(eventName: string, data?: object) => void}
 *
 * @example
 * const track = useTrack();
 * <button onClick={() => track('faction-tab-switch', { faction: 'bugs' })}>
 */
export function useTrack() {
    return useCallback((eventName, data) => {
        if (typeof window !== 'undefined' && window.umami) {
            window.umami.track(eventName, data);
        }
    }, []);
}
