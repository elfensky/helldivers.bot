const STORAGE_KEY = 'dismissed-toast-events';

/**
 * localStorage-backed record of dismissed toasts, keyed by event id with the
 * event's status at time of dismissal as the value. The status pairing lets
 * us fully suppress dismissed toasts until their status changes.
 *
 * Shape: `Record<string, 'active'|'success'|'fail'>`.
 *
 * Legacy format (array of ids) is migrated in-place on read — dismissed ids
 * with no recorded status default to 'active' since that's the only status a
 * user could realistically have dismissed before the migration.
 */
export function getDismissedEvents() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return Object.fromEntries(parsed.map((id) => [String(id), 'active']));
        }
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function addDismissedEvent(eventId, status) {
    try {
        const record = getDismissedEvents();
        record[String(eventId)] = status;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
        // localStorage unavailable — silently skip
    }
}

/**
 * Returns true if the event was dismissed at its current status. Dismissals
 * for a different (earlier) status return false so the caller re-shows the
 * toast on a real status change.
 */
export function isDismissedAtStatus(eventId, status) {
    const record = getDismissedEvents();
    return record[String(eventId)] === status;
}
