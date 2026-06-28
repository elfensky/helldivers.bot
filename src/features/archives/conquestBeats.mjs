import factions from '@/shared/enums/factions.mjs';
import { PHRASES, pickVariant } from '@/features/archives/narrativePhrasing.mjs';

const GATES_THRESHOLD = 0.9; // "at the gates" — homeworld-assault range

function factionName(enemy) {
    return (factions[enemy]?.name ?? 'Unknown forces').replace(/^The\s+/i, '');
}

/**
 * Offensive conquest milestones from the campaign snapshots. `points/points_max`
 * is Super Earth's conquest progress toward the enemy homeworld (high = SE
 * winning — verified vs computeMapState + the HD1 API). Emits at most two beats:
 *   - breakthrough: first time any faction's frac first crosses GATES_THRESHOLD
 *   - first homeworld falls: first time any faction first reads 'defeated'
 *
 * @param {Array<{ time:number, data:Array<{ enemy:number, points:number, status:string }> }>} snapshots - Campaign snapshots with time and faction state data
 * @param {{ points:number[] }} pointsMax - Maximum points array indexed by faction
 * @param {number} season - Season number for narrative phrase selection
 * @param {number} warStart - Unix-seconds anchor for day 1 (war start).
 * @returns {Array<{ time:number, day:number, kind:'conquest', text:string }>} Conquest milestone beats
 */
export function buildConquestBeats(snapshots, pointsMax, season, warStart) {
    const snaps = snapshots ?? [];
    const maxes = pointsMax?.points ?? [];
    if (snaps.length === 0) return [];

    const dayOf = (time) => Math.max(1, Math.floor((time - warStart) / 86400) + 1);

    let breakthrough = null; // first snapshot any faction crosses the gates
    let firstFall = null; // first snapshot any faction is defeated

    for (const snap of snaps) {
        for (const s of snap.data ?? []) {
            const max = maxes[s.enemy] || 0;
            const frac =
                s.status === 'defeated' ? 1
                : max > 0 ? s.points / max
                : 0;
            if (!breakthrough && frac >= GATES_THRESHOLD) {
                breakthrough = { time: snap.time, enemy: s.enemy };
            }
            if (!firstFall && s.status === 'defeated') {
                firstFall = { time: snap.time, enemy: s.enemy };
            }
        }
        if (breakthrough && firstFall) break;
    }

    /** @type {Array<{ time:number, day:number, kind:'conquest', text:string }>} */
    const beats = [];
    if (breakthrough) {
        beats.push({
            time: breakthrough.time,
            day: dayOf(breakthrough.time),
            kind: 'conquest',
            text: pickVariant(
                PHRASES.breakthrough,
                season,
                breakthrough.enemy,
            )(factionName(breakthrough.enemy)),
        });
    }
    if (firstFall) {
        beats.push({
            time: firstFall.time,
            day: dayOf(firstFall.time),
            kind: 'conquest',
            text: pickVariant(
                PHRASES.homeworldFalls,
                season,
                firstFall.enemy + 10,
            )(factionName(firstFall.enemy)),
        });
    }

    // Dedupe: same faction reaching the gates and falling on the same day reads
    // as one moment — keep the "falls" beat.
    if (
        beats.length === 2 &&
        breakthrough &&
        firstFall &&
        breakthrough.enemy === firstFall.enemy &&
        beats[0].day === beats[1].day
    ) {
        return [beats[1]];
    }
    return beats;
}
