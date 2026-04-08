/**
 * Filters an event array to only those with status 'active'.
 * @param {Array<{status: string}>} events
 * @returns {Array<{status: string}>}
 */
export function getActiveEvents(events) {
    return events?.filter((e) => e.status === 'active') ?? [];
}

/**
 * Returns a copy of the events array sorted by start_time descending (newest first).
 * @param {Array<{start_time: number}>} events
 * @returns {Array<{start_time: number}>}
 */
export function sortEventsByRecent(events) {
    return [...(events ?? [])].sort((a, b) => b.start_time - a.start_time);
}

/**
 * Counts wins (status 'success') and losses (status 'fail') in an event array.
 * @param {Array<{status: string}>} events
 * @returns {{ wins: number, losses: number }}
 */
export function countOutcomes(events) {
    let wins = 0;
    let losses = 0;
    for (const e of events) {
        if (e.status === 'success') wins++;
        else if (e.status === 'fail') losses++;
    }
    return { wins, losses };
}
