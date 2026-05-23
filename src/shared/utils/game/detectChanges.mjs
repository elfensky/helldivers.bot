import { EVENT_STATUS } from '@/shared/enums/events.mjs';

/** @typedef {import('@/shared/enums/events.mjs').Event} Event */

/**
 * Detect event transitions between two campaign states.
 *
 * `catch_up` is intentionally not emitted here — that variant belongs to
 * page-load synthesis in `LiveToasts`, not poll-to-poll diff detection.
 *
 * @param {ReadonlyArray<Event> | null} prevEvents - Previous event array (null on first call).
 * @param {ReadonlyArray<Event>} nextEvents - Current event array.
 * @returns {Array<{kind: 'event_started'|'event_won'|'event_lost', event: Event}>}
 */
export function detectChanges(prevEvents, nextEvents) {
    if (!prevEvents || !nextEvents) return [];

    const changes = [];

    for (const next of nextEvents) {
        const prev = prevEvents.find(
            (e) => e.event_id === next.event_id && e.type === next.type,
        );

        if (!prev) {
            changes.push({ kind: 'event_started', event: next });
        } else if (
            prev.status === EVENT_STATUS.ACTIVE &&
            next.status === EVENT_STATUS.SUCCESS
        ) {
            changes.push({ kind: 'event_won', event: next });
        } else if (
            prev.status === EVENT_STATUS.ACTIVE &&
            next.status === EVENT_STATUS.FAIL
        ) {
            changes.push({ kind: 'event_lost', event: next });
        }
    }

    return changes;
}
