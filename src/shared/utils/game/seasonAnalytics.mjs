import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events';
import factions from '@/shared/enums/factions.mjs';

/**
 * Detect the worst cascade failure in a season — the longest sequence
 * of consecutive failed defenses for a single faction with decreasing
 * region numbers (enemy pushing through territories).
 *
 * @param {Array} events - h1_event records
 * @returns {{ length: number, faction: string, regions: number[], firstEvent: object }|null}
 */
export function findWorstCascade(events) {
    if (!events?.length) return null;

    const failedDefends = events
        .filter((e) => e.type === EVENT_TYPE.DEFEND && e.status === EVENT_STATUS.FAIL)
        .sort((a, b) => a.end_time - b.end_time);

    if (failedDefends.length < 2) return null;

    let bestCascade = null;

    // Track per-faction cascades
    const currentByFaction = {};

    for (const e of failedDefends) {
        const key = e.enemy;
        const current = currentByFaction[key];

        if (current && e.region < current.regions[current.regions.length - 1]) {
            // Continues the cascade — region number decreased
            current.regions.push(e.region);
        } else {
            // Start new cascade for this faction
            currentByFaction[key] = { enemy: key, regions: [e.region], firstEvent: e };
        }

        const cascade = currentByFaction[key];
        if (cascade.regions.length >= 2) {
            if (!bestCascade || cascade.regions.length > bestCascade.regions.length) {
                bestCascade = { ...cascade };
            }
        }
    }

    if (!bestCascade) return null;

    return {
        length: bestCascade.regions.length,
        faction: factions[bestCascade.enemy]?.name ?? 'Unknown',
        regions: bestCascade.regions,
        firstEvent: bestCascade.firstEvent,
    };
}
