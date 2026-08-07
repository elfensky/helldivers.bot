import { cache } from 'react';
import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { groupBy } from '@/shared/utils/groupBy.mjs';
import {
    findAllCascades,
    compareCascades,
} from '@/shared/utils/game/seasonAnalytics.mjs';

/**
 * Cross-season cascade leaderboard. One DB read, then per-season cascade
 * detection. Sorted globally by length DESC, then speed (regions per hour)
 * DESC, then endTime DESC.
 *
 * Returns `[]` on any DB error so the page can still render without the
 * cascade section.
 *
 * @returns {Promise<Array<{
 *   season: number,
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
 * }>>}
 */
export const getCascadeLeaderboard = cache(async () => {
    const { data: events, error } = await tryCatch(
        db.h1_event.findMany({
            where: { type: 'defend', status: 'fail' },
            select: {
                season: true,
                type: true,
                status: true,
                enemy: true,
                region: true,
                start_time: true,
                end_time: true,
                event_id: true,
            },
            orderBy: [{ season: 'asc' }, { end_time: 'asc' }],
        }),
    );
    if (error || !events) return [];

    const bySeason = groupBy(events, (e) => e.season);
    const all = [];
    for (const [season, seasonEvents] of bySeason) {
        for (const cascade of findAllCascades(seasonEvents)) {
            all.push({ season, ...cascade });
        }
    }
    all.sort(compareCascades);
    return all;
});
