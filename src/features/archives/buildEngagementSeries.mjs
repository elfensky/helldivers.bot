// Faction palette mirrors FactionHealthChart so /archives reads as one visual
// language. Each faction's events become one colored scatter series.
const FACTIONS = [
    { enemy: 0, name: 'Bugs', color: '#e8822a' },
    { enemy: 1, name: 'Cyborgs', color: '#8b2d2d' },
    { enemy: 2, name: 'Illuminate', color: '#7ec8e3' },
];

/**
 * Build `{ x: day-into-war, y: players_at_start }` scatter points grouped per
 * faction. `warStart` anchors day 0, falling back to the earliest event when
 * absent. Events with no positive player count carry no engagement signal and
 * are dropped — so a season without player data yields an empty series and the
 * chart (and its section) hides.
 *
 * @param {Array<{enemy:number, start_time:number, players_at_start:number, region:number, type:string}>} events - The season's events.
 * @param {number|null|undefined} warStart - Unix-seconds anchor for day 0.
 * @returns {Array<{enemy:number, name:string, color:string, points:Array<object>}>}
 */
export function buildEngagementSeries(events, warStart) {
    const withPlayers = (events ?? []).filter((e) => (e.players_at_start ?? 0) > 0);
    if (withPlayers.length === 0) return [];

    // reduce, not Math.min(...spread): spreading a large array as call arguments
    // can throw RangeError once it exceeds the engine's arg-count limit.
    const anchor =
        warStart ?? withPlayers.reduce((m, e) => Math.min(m, e.start_time), Infinity);

    return FACTIONS.map(({ enemy, name, color }) => ({
        enemy,
        name,
        color,
        points: withPlayers
            .filter((e) => e.enemy === enemy)
            .map((e) => ({
                x: (e.start_time - anchor) / 86400,
                y: e.players_at_start,
                region: e.region,
                type: e.type,
            })),
    })).filter((s) => s.points.length > 0);
}
