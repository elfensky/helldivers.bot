import { EVENT_STATUS } from '@/shared/enums/events.mjs';

/**
 * @param {Array<{start_time: number}>} events - Events to sort
 * @returns {Array<{start_time: number}>}
 */
export function sortEventsByRecent(events) {
    return [...(events ?? [])].sort((a, b) => b.start_time - a.start_time);
}

/**
 * @param {Array<{status: string}>} events - Events to tally
 * @returns {{ wins: number, losses: number }}
 */
export function countOutcomes(events) {
    let wins = 0;
    let losses = 0;
    for (const e of events) {
        if (e.status === EVENT_STATUS.SUCCESS) wins++;
        else if (e.status === EVENT_STATUS.FAIL) losses++;
    }
    return { wins, losses };
}
