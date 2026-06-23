import { EVENT_STATUS } from '@/shared/enums/events.mjs';

const STORAGE_KEY = 'dismissed-toast-events';
const MAX_ENTRIES = 200;

/**
 * localStorage-backed record of dismissed toasts, keyed by event id.
 *
 * Shape: `Record<string, { status: 'active'|'success'|'fail', ts: number }>`.
 *
 * Legacy formats are migrated in-place on read:
 *   - Array of ids → `{ status: 'active', ts: 0 }`
 *   - Plain string values → `{ status: value, ts: 0 }`
 */
export function getDismissedEvents() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return Object.fromEntries(
                parsed.map((id) => [String(id), { status: EVENT_STATUS.ACTIVE, ts: 0 }]),
            );
        }
        if (!parsed || typeof parsed !== 'object') return {};
        const migrated = {};
        for (const [id, val] of Object.entries(parsed)) {
            migrated[id] = typeof val === 'string' ? { status: val, ts: 0 } : val;
        }
        return migrated;
    } catch {
        return {};
    }
}

export function addDismissedEvent(eventId, status) {
    try {
        const record = getDismissedEvents();
        record[String(eventId)] = { status, ts: Date.now() };
        const entries = Object.entries(record);
        if (entries.length > MAX_ENTRIES) {
            entries.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
            const pruned = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.debug('[dismissedEvents] localStorage write failed:', message);
    }
}
