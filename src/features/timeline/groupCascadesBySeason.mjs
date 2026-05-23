import { compareCascades } from '@/shared/utils/game/seasonAnalytics.mjs';

/**
 * Group cascades by season, then sort groups + within-group cascades.
 *
 * - `sortOrder='worst'` (default) — groups ordered by each group's worst
 *   cascade (length DESC, then speed DESC). Cascades within a group are
 *   sorted length DESC, then speed DESC, then endTime DESC.
 * - `sortOrder='recent'` — groups ordered by season DESC. Cascades within
 *   a group are sorted by endTime DESC.
 *
 * The worst-first comparator is the same one used by getCascadeLeaderboard,
 * imported from seasonAnalytics so ranking stays consistent across views.
 *
 * @param {Array<object>} cascades - Each cascade includes `season`.
 * @param {object} [opts] - Grouping options
 * @param {'worst'|'recent'} [opts.sortOrder='worst'] - Sort order for groups
 * @returns {Array<{ season: number, cascades: Array<object> }>}
 */
export function groupCascadesBySeason(cascades, { sortOrder = 'worst' } = {}) {
    if (!cascades?.length) return [];

    const groups = new Map();
    for (const c of cascades) {
        if (!groups.has(c.season)) groups.set(c.season, []);
        groups.get(c.season).push(c);
    }

    const within =
        sortOrder === 'recent' ? (a, b) => b.endTime - a.endTime : compareCascades;
    for (const arr of groups.values()) arr.sort(within);

    const list = Array.from(groups, ([season, cs]) => ({ season, cascades: cs }));
    if (sortOrder === 'recent') {
        list.sort((a, b) => b.season - a.season);
    } else {
        list.sort((a, b) => compareCascades(a.cascades[0], b.cascades[0]));
    }
    return list;
}
