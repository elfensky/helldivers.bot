import { FACTION_SLUG_BY_ID } from '@/shared/enums/factions.mjs';

/**
 * Parse + validate the season endpoint's query string. `season` may repeat
 * (`?season=1&season=2`); each value is `current` or a positive integer.
 * With no `season` param, defaults to `['current']`.
 *
 * @param {URLSearchParams} searchParams - The request's query parameters.
 * @returns {{ success: true, data: { seasons: Array<number | 'current'> } } | { success: false, message: string }}
 */
export function parseSeasonQuery(searchParams) {
    const raw = searchParams.getAll('season');
    const values = raw.length === 0 ? ['current'] : raw;
    /** @type {Array<number | 'current'>} */
    const seasons = [];
    for (const value of values) {
        if (value === 'current') {
            seasons.push('current');
            continue;
        }
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) {
            return {
                success: false,
                message: `Invalid query: season — must be 'current' or a positive integer (got "${value}")`,
            };
        }
        seasons.push(n);
    }
    return { success: true, data: { seasons } };
}

/**
 * Faction slugs in introduction order. `introduction_order` is indexed by enemy
 * id with the value being that faction's order rank, so we sort the faction ids
 * by their rank and map to slugs.
 *
 * @param {number[]} introOrder - Per-faction introduction-order ranks.
 * @returns {string[]} faction slugs in introduction order.
 */
function introductionOrderSlugs(introOrder) {
    return [0, 1, 2]
        .slice()
        .sort((a, b) => (introOrder[a] ?? 0) - (introOrder[b] ?? 0))
        .map((id) => FACTION_SLUG_BY_ID[id]);
}

/**
 * Project season-metadata rows into the public, human-readable shape.
 *
 * @param {Array<{ season: number, last_updated: Date | null, introduction_order: number[], points_max: number[], season_duration: number }>} rows - Season rows.
 * @param {number} current - The current (latest) season number.
 * @returns {Array<object>} projected season metadata.
 */
export function projectSeasons(rows, current) {
    return rows.map((r) => ({
        season: r.season,
        isCurrent: r.season === current,
        lastUpdated: r.last_updated ? r.last_updated.toISOString() : null,
        introductionOrder: introductionOrderSlugs(r.introduction_order ?? []),
        pointsMax: {
            bugs: r.points_max?.[0] ?? 0,
            cyborgs: r.points_max?.[1] ?? 0,
            illuminate: r.points_max?.[2] ?? 0,
        },
        seasonDuration: r.season_duration ?? 0,
    }));
}
