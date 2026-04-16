import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';
import { computeBucket } from '@/update/bucketing';

/**
 * Upsert a single h1_status row for one (season, enemy) at the bucket
 * computed from pollTime. Within an active bucket window, this updates
 * the existing row with latest values. At a bucket boundary, a new row
 * is inserted.
 *
 * @param {number} season     Current season number
 * @param {number} enemy      0=Bugs, 1=Cyborgs, 2=Illuminate
 * @param {number} pollTime   Unix timestamp from API response (fetchedData.time)
 * @param {object} campaign   campaign_status[enemy] — { points, points_taken, status }
 *                            (points_max and introduction_order are season-level, not stored here)
 */
export async function queryUpsertStatus(season, enemy, pollTime, campaign) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (enemy === undefined || enemy === null) throw new Error('enemy is missing');
    if (!pollTime) throw new Error('pollTime is missing');
    if (!campaign) throw new Error('campaign is missing');

    const bucket = computeBucket(pollTime);

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_status.upsert({
            where: {
                season_enemy_bucket: { season, enemy, bucket },
            },
            update: {
                time: pollTime,
                points: campaign.points,
                points_taken: campaign.points_taken,
                status: campaign.status,
            },
            create: {
                season,
                enemy,
                bucket,
                time: pollTime,
                points: campaign.points,
                points_taken: campaign.points_taken,
                status: campaign.status,
            },
        }),
    );

    if (error) throw error;
    return { ms: performanceTime(start), query: upsertRecord };
}
