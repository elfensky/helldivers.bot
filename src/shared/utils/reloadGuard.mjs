export const GUARD_KEY = 'hd-reload-guard';
const GUARD_TTL = 30_000;
const MAX_RELOADS = 3;

export function guardedReload(reason) {
    if (typeof window === 'undefined') return;

    let prevAttempts = 0;
    const raw = localStorage.getItem(GUARD_KEY);
    if (raw) {
        const [, ts, count] = raw.split(':');
        const elapsed = Date.now() - parseInt(ts, 10);
        if (elapsed < GUARD_TTL) {
            prevAttempts = parseInt(count, 10) || 0;
            if (prevAttempts >= MAX_RELOADS) return;
        }
        // else: TTL elapsed — treat as a fresh attempt window
    }

    localStorage.setItem(GUARD_KEY, `${reason}:${Date.now()}:${prevAttempts + 1}`);
    window.location.reload();
}

export function clearReloadGuard() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(GUARD_KEY);
}
