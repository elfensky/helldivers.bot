import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';

const MAX_GAP_SEC = 3600; // 1 hour

/**
 * Find the worst cascade failure in a season — the longest sequence of
 * consecutive failed defenses for a single faction with decreasing region
 * numbers. Legacy single-result helper, kept until Task 2 of the cascade
 * leaderboard implementation removes it.
 *
 * @deprecated Use {@link findAllCascades} instead.
 * @param {Array} events
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

/**
 * Return every cascade in `events`, sorted by length DESC, then by speed
 * (regions per hour) DESC, then by `end_time` DESC. A cascade is a sequence
 * of failed defenses for one faction with strictly decreasing region numbers
 * and consecutive events within `MAX_GAP_SEC` (1 hour).
 *
 * @param {Array} events - h1_event records (any type, any status)
 * @param {object} [opts]
 * @param {number} [opts.minLength=3] - Inclusive minimum cascade length
 * @returns {Array<{
 *   length: number,
 *   faction: string,
 *   factionIndex: number,
 *   regions: number[],
 *   startTime: number,
 *   endTime: number,
 *   durationSec: number,
 *   firstEvent: object,
 *   lastEvent: object,
 *   events: object[],
 * }>}
 */
export function findAllCascades(events, { minLength = 3 } = {}) {
    if (!events?.length) return [];

    const failedDefends = events
        .filter((e) => e.type === EVENT_TYPE.DEFEND && e.status === EVENT_STATUS.FAIL)
        .sort((a, b) => a.end_time - b.end_time);

    if (failedDefends.length < minLength) return [];

    const cascades = [];
    const open = new Map(); // factionIndex → { events: [] }

    for (const e of failedDefends) {
        const cur = open.get(e.enemy);
        if (cur) {
            const last = cur.events[cur.events.length - 1];
            const decreasing = e.region < last.region;
            const inWindow = e.start_time - last.end_time <= MAX_GAP_SEC;
            if (decreasing && inWindow) {
                cur.events.push(e);
                continue;
            }
            if (cur.events.length >= minLength) cascades.push(emit(cur));
        }
        open.set(e.enemy, { events: [e] });
    }
    for (const cur of open.values()) {
        if (cur.events.length >= minLength) cascades.push(emit(cur));
    }

    cascades.sort(compareCascades);
    return cascades;
}

function emit({ events }) {
    const first = events[0];
    const last = events[events.length - 1];
    return {
        length: events.length,
        factionIndex: first.enemy,
        faction: factions[first.enemy]?.name ?? 'Unknown',
        regions: events.map((e) => e.region),
        startTime: first.start_time,
        endTime: last.end_time,
        durationSec: last.end_time - first.start_time,
        firstEvent: first,
        lastEvent: last,
        events,
    };
}

function compareCascades(a, b) {
    if (b.length !== a.length) return b.length - a.length;
    const aSpeed = a.length / (a.durationSec / 3600);
    const bSpeed = b.length / (b.durationSec / 3600);
    if (bSpeed !== aSpeed) return bSpeed - aSpeed;
    return b.endTime - a.endTime;
}
