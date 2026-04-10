import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events';
import factions from '@/shared/enums/factions.mjs';
import map from '@/shared/enums/map.mjs';

/**
 * Find the narrowest win and narrowest loss from a season's events.
 *
 * - Narrowest win: successful defense where enemy pushed furthest (highest points/points_max)
 * - Narrowest loss: failed attack where players got closest to winning (highest points/points_max)
 *
 * @param {Array} events - h1_event records
 * @returns {{ narrowestWin: object|null, narrowestLoss: object|null }}
 */
export function findClosestCalls(events) {
    if (!events?.length) return { narrowestWin: null, narrowestLoss: null };

    let narrowestWin = null;
    let narrowestLoss = null;

    for (const e of events) {
        if (!e.points_max || e.points_max === 0) continue;
        const ratio = e.points / e.points_max;

        if (
            e.type === EVENT_TYPE.DEFEND &&
            e.status === EVENT_STATUS.SUCCESS &&
            ratio > 0.5
        ) {
            if (!narrowestWin || ratio > narrowestWin.ratio) {
                narrowestWin = {
                    ratio,
                    region: map[e.enemy]?.[e.region]?.region ?? 'Unknown',
                    faction: factions[e.enemy]?.name ?? 'Unknown',
                    event: e,
                };
            }
        }

        if (
            e.type === EVENT_TYPE.ATTACK &&
            e.status === EVENT_STATUS.FAIL &&
            ratio > 0.5
        ) {
            if (!narrowestLoss || ratio > narrowestLoss.ratio) {
                narrowestLoss = {
                    ratio,
                    region: map[e.enemy]?.[e.region]?.region ?? 'Unknown',
                    faction: factions[e.enemy]?.name ?? 'Unknown',
                    event: e,
                };
            }
        }
    }

    return { narrowestWin, narrowestLoss };
}

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
        .filter(
            (e) =>
                e.type === EVENT_TYPE.DEFEND &&
                e.status === EVENT_STATUS.FAIL,
        )
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
