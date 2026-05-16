import { EVENT_STATUS } from '@/shared/enums/events.mjs';

/**
 * Detect event transitions between two campaign states.
 *
 * @param {Array} prevEvents - Previous event array (may be null on first call)
 * @param {Array} nextEvents - Current event array
 * @returns {Array<{ kind: string, event: Object }>}
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
