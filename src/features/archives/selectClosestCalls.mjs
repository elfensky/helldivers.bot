import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';

/**
 * Select a season's "closest calls" — the defend events that came nearest to
 * flipping outcome.
 *
 * Only DEFEND fails carry a clean margin signal: `points / points_max` is the
 * fraction of the defense bar filled before the planet fell, so a fail near 1.0
 * is a heartbreaking near-hold. Wins all sit at ~1.0 with no sub-threshold
 * signal, and attack point semantics are unreliable (some "successes" record a
 * ~0 ratio), so both are excluded. Returns up to `limit` events with
 * `ratio >= minRatio`, narrowest loss first.
 *
 * @param {Array<{type:string, status:string, region:number, enemy:number, points:number, points_max:number}>} events - The season's events.
 * @param {{limit?:number, minRatio?:number}} [opts] - `limit` (default 3) and `minRatio` (default 0.9) tuning.
 * @returns {Array<{region:number, enemy:number, ratio:number}>} Narrowest defend losses, closest first.
 */
export function selectClosestCalls(events, { limit = 3, minRatio = 0.9 } = {}) {
    return (events ?? [])
        .filter(
            (e) =>
                e.type === EVENT_TYPE.DEFEND &&
                e.status === EVENT_STATUS.FAIL &&
                e.points_max > 0,
        )
        .map((e) => ({
            region: e.region,
            enemy: e.enemy,
            ratio: e.points / e.points_max,
        }))
        .filter((e) => e.ratio >= minRatio && e.ratio < 1)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, limit);
}
