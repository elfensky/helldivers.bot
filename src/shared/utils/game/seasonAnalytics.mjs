import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';

const MAX_GAP_SEC = 3600; // 1 hour

/**
 * Return every cascade in `events`, sorted by length DESC, then by speed
 * (regions per hour) DESC, then by `end_time` DESC. A cascade is a sequence
 * of failed defenses for one faction with strictly decreasing region numbers
 * and consecutive events within `MAX_GAP_SEC` (1 hour).
 *
 * @param {Array} events - h1_event records (any type, any status)
 * @param {object} [opts] - Optional configuration.
 * @param {number} [opts.minLength=4] - Inclusive minimum cascade length. Default
 *   4: a shorter run is too common to be noteworthy (was 3 — too noisy).
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
export function findAllCascades(events, { minLength = 4 } = {}) {
    if (!events?.length) return [];

    // end_time alone is a partial order: on a tie, cascade membership would depend on
    // the caller's incoming array order, and /stats (getCascadeLeaderboard) and
    // /archives (getCampaign) could then disagree. event_id is unique per type and this
    // list is pre-filtered to DEFEND, so it is a total order here — do not lift this
    // comparator onto a mixed-type event list.
    const failedDefends = events
        .filter((e) => e.type === EVENT_TYPE.DEFEND && e.status === EVENT_STATUS.FAIL)
        .sort((a, b) => a.end_time - b.end_time || a.event_id - b.event_id);

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

export function compareCascades(a, b) {
    if (b.length !== a.length) return b.length - a.length;
    const aSpeed = a.length / (a.durationSec / 3600);
    const bSpeed = b.length / (b.durationSec / 3600);
    if (bSpeed !== aSpeed) return bSpeed - aSpeed;
    return b.endTime - a.endTime;
}
