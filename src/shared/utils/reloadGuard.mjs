export const GUARD_KEY = 'hd-reload-guard';
const GUARD_TTL = 30_000;
const MAX_RELOADS = 3;

export function guardedReload(reason) {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(GUARD_KEY);
    if (raw) {
        const [, ts, count] = raw.split(':');
        const elapsed = Date.now() - parseInt(ts, 10);
        const attempts = parseInt(count, 10) || 0;
        if (elapsed < GUARD_TTL) return;
        if (attempts >= MAX_RELOADS) return;
        localStorage.setItem(GUARD_KEY, `${reason}:${Date.now()}:${attempts + 1}`);
    } else {
        localStorage.setItem(GUARD_KEY, `${reason}:${Date.now()}:1`);
    }
    window.location.reload();
}

export function clearReloadGuard() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(GUARD_KEY);
}
