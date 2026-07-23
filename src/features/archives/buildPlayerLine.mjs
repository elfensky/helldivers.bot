import { FACTION_INDEX } from '@/shared/enums/factions.mjs';
import { dayFraction, resolveWarStart } from '@/shared/utils/game/warClock.mjs';

/**
 * @typedef {object} PlayerTimeseriesEntry
 * @property {number} time - Unix-seconds of the bucket (latest poll within it).
 * @property {number} day - 1-based day into the war.
 * @property {number} total - Sum of all three faction player counts.
 * @property {number} bugs - Bugs player count at this bucket.
 * @property {number} cyborgs - Cyborgs player count at this bucket.
 * @property {number} illuminate - Illuminate player count at this bucket.
 */

/**
 * @typedef {object} LinePoint
 * @property {number} x - Day into war.
 * @property {number} y - Player count on the selected line at that day.
 */

/**
 * @typedef {object} EventDot
 * @property {number} x - Day into war the event started.
 * @property {number} y - The selected line's value at the nearest bucket.
 * @property {number} enemy - Faction id (0=Bugs, 1=Cyborgs, 2=Illuminate).
 * @property {string} type - 'defend' / 'attack'.
 * @property {number} region - Region id.
 * @property {string} status - Event outcome ('active' / 'success' / 'fail').
 */

/**
 * Map a `faction` toggle value to the timeseries field whose player count the
 * line plots. `global` selects the summed `total`; a faction slug selects that
 * faction's own count.
 *
 * @param {string} faction - 'global' | 'bugs' | 'cyborgs' | 'illuminate'.
 * @returns {'total'|'bugs'|'cyborgs'|'illuminate'}
 */
function lineField(faction) {
    return faction === 'global' ? 'total' : (
            /** @type {'bugs'|'cyborgs'|'illuminate'} */ (faction)
        );
}

/**
 * Build the single player-count line + its event dots for the archives
 * "Players over time" chart, driven by the shared faction toggle.
 *
 * One line at a time:
 *   - `global` → the total-players line; dots for ALL events.
 *   - a faction → that faction's player line; dots only for that faction's events.
 *
 * Each dot sits on the line at the nearest bucket to the event's start time,
 * so it reads as "this event kicked off here, when N players were online".
 *
 * The x-axis is CONTINUOUS days-since-war-start (fractional), not the integer
 * day: many hourly buckets share one calendar day, so rounding x to the day
 * would collapse them onto a single column and draw a vertical stack instead of
 * a time series. Fractional x gives each bucket its own position, so the line
 * reads as real slopes and cliffs over time. It is 0-based (day 0 = war start)
 * to align with FactionHealthChart (Conquest Progress) so the two charts can be
 * read against each other day-for-day.
 *
 * @param {Array<PlayerTimeseriesEntry>|null|undefined} playerTimeseries - From getCampaign.
 * @param {Array<{enemy:number, start_time:number, region:number, type:string, status:string}>|null|undefined} events - The season's events.
 * @param {string} faction - 'global' | 'bugs' | 'cyborgs' | 'illuminate'.
 * @param {number} [warStart] - Unix-seconds anchor for day 0. Falls back to the earliest bucket time.
 * @returns {{ points: Array<LinePoint>, dots: Array<EventDot> }}
 */
export function buildPlayerLine(playerTimeseries, events, faction, warStart) {
    const series = playerTimeseries ?? [];
    if (series.length === 0) return { points: [], dots: [] };

    const field = lineField(faction);

    // Anchor day 0 to war_start; fall back to the earliest bucket.
    const anchor = resolveWarStart(
        warStart,
        series.map((e) => e.time),
    );
    // Continuous (fractional) days since war start, 0-based to match Conquest.
    const dayInto = (time) => dayFraction(time, anchor);

    const points = series.map((entry) => ({
        x: dayInto(entry.time),
        y: entry[field] ?? 0,
    }));

    // Faction filter: 'global' keeps every event; a faction keeps only its own.
    const enemyId = faction === 'global' ? null : FACTION_INDEX[faction];
    const matched = (events ?? []).filter((e) => enemyId === null || e.enemy === enemyId);

    const dots = matched.map((e) => {
        const nearest = nearestEntry(series, e.start_time);
        return {
            x: dayInto(e.start_time),
            y: nearest[field] ?? 0,
            enemy: e.enemy,
            type: e.type,
            region: e.region,
            status: e.status,
        };
    });

    return { points, dots };
}

/**
 * The timeseries entry whose bucket time is closest to `target`.
 *
 * @param {Array<PlayerTimeseriesEntry>} series - Non-empty, ascending by time.
 * @param {number} target - Unix-seconds to match against.
 * @returns {PlayerTimeseriesEntry}
 */
function nearestEntry(series, target) {
    let best = series[0];
    let bestDist = Math.abs(series[0].time - target);
    for (let i = 1; i < series.length; i++) {
        const dist = Math.abs(series[i].time - target);
        if (dist < bestDist) {
            best = series[i];
            bestDist = dist;
        }
    }
    return best;
}
