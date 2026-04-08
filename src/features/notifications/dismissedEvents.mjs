const STORAGE_KEY = 'dismissed-toast-events';

export function getDismissedEvents() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

export function addDismissedEvent(eventId) {
    try {
        const set = getDismissedEvents();
        set.add(String(eventId));
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
        // localStorage unavailable — silently skip
    }
}
