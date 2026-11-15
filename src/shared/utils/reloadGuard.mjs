import { getLocalStorage } from './storage.mjs';

export const GUARD_KEY = 'hd-reload-guard';
const GUARD_TTL = 30_000;
const MAX_RELOADS = 3;

/**
 * Reloads the page unless the circuit breaker has tripped (3 reloads in 30 s).
 * Without storage the breaker cannot count across page loads, so no reload
 * runs (fails closed): an unbounded reload loop is worse than a stale tab.
 *
 * @param {string} reason - Recorded in the guard value, e.g. 'version' or 'chunk'.
 */
export function guardedReload(reason) {
    if (typeof window === 'undefined') return;
    const storage = getLocalStorage();
    if (!storage) return;

    let prevAttempts = 0;
    const raw = storage.getItem(GUARD_KEY);
    if (raw) {
        const [, ts, count] = raw.split(':');
        const elapsed = Date.now() - parseInt(ts, 10);
        if (elapsed < GUARD_TTL) {
            prevAttempts = parseInt(count, 10) || 0;
            if (prevAttempts >= MAX_RELOADS) return;
        }
        // else: TTL elapsed — treat as a fresh attempt window
    }

    storage.setItem(GUARD_KEY, `${reason}:${Date.now()}:${prevAttempts + 1}`);
    window.location.reload();
}

export function clearReloadGuard() {
    if (typeof window === 'undefined') return;
    getLocalStorage()?.removeItem(GUARD_KEY);
}
