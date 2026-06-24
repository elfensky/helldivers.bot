/**
 * Derive the combat-telemetry vizzes (#178 — Friendly Fire, Accuracy,
 * Shots-per-Planet) from `getCrossSeasonStats`' `perSeason` rows.
 *
 * Telemetry (kills/shots/hits/accidentals) only exists for seasons the bot has
 * polled live — historical wars predate collection and carry `0n` — so every
 * series filters to telemetry-bearing seasons. That set grows as the worker
 * keeps polling.
 *
 * BigInt sums are narrowed to `Number` here (magnitudes are well under 2^53) so
 * the result is plain and safe to pass across the server→client boundary to the
 * chart components — BigInt can't be serialized as a client-component prop.
 *
 * @param {Array<{season:number, kills:bigint, accidentals:bigint, shots:bigint, hits:bigint, completed_planets:number}>} perSeason - Per-season aggregates from getCrossSeasonStats.
 * @returns {{ friendlyFire: Array<{season:number, value:number}>, accuracy: Array<{season:number, value:number}>, shotsPerPlanet: number|null, seasonsWithTelemetry: number }}
 */
export function computeTelemetryStats(perSeason) {
    const rows = (perSeason ?? []).filter(
        (s) => Number(s.shots) > 0 || Number(s.kills) > 0,
    );

    // Friendly Fire Index — accidentals as a percentage of total kills.
    const friendlyFire = rows
        .filter((s) => Number(s.kills) > 0)
        .map((s) => ({
            season: s.season,
            value: (Number(s.accidentals) / Number(s.kills)) * 100,
        }));

    // Accuracy Trend — hits as a percentage of shots fired.
    const accuracy = rows
        .filter((s) => Number(s.shots) > 0)
        .map((s) => ({
            season: s.season,
            value: (Number(s.hits) / Number(s.shots)) * 100,
        }));

    // Shots per Planet — one all-time "big number", aggregated across telemetry
    // seasons so a single contributing season still yields a stable figure.
    const totalShots = rows.reduce((sum, s) => sum + Number(s.shots), 0);
    const totalPlanets = rows.reduce((sum, s) => sum + Number(s.completed_planets), 0);
    const shotsPerPlanet = totalPlanets > 0 ? totalShots / totalPlanets : null;

    return {
        friendlyFire,
        accuracy,
        shotsPerPlanet,
        seasonsWithTelemetry: rows.length,
    };
}
