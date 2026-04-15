import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';
import { computeBucket } from '@/update/bucketing';

/**
 * Upsert a single h1_statistic row for one (season, enemy) at the bucket
 * computed from pollTime. Captures the 4 signal fields (players,
 * total_unique_players, kills, deaths) — the other 12 stats fields from
 * the API are intentionally dropped (end-state lives in... nowhere now,
 * since h1_live is gone; aggregated stats are derivable from h1_event
 * counts or simply not surfaced anywhere).
 *
 * @param {number} season   Current season number
 * @param {number} enemy    0=Bugs, 1=Cyborgs, 2=Illuminate
 * @param {number} pollTime Unix timestamp from API response
 * @param {object} stats    statistics[enemy] from get_campaign_status
 */
export async function queryUpsertStatistic(season, enemy, pollTime, stats) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (enemy === undefined || enemy === null) throw new Error('enemy is missing');
    if (!pollTime) throw new Error('pollTime is missing');
    if (!stats) throw new Error('stats is missing');

    const bucket = computeBucket(pollTime);

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_statistic.upsert({
            where: {
                season_enemy_bucket: { season, enemy, bucket },
            },
            update: {
                time: pollTime,
                players: stats.players,
                total_unique_players: stats.total_unique_players,
                kills: stats.kills,
                deaths: stats.deaths,
            },
            create: {
                season,
                enemy,
                bucket,
                time: pollTime,
                players: stats.players,
                total_unique_players: stats.total_unique_players,
                kills: stats.kills,
                deaths: stats.deaths,
            },
        }),
    );

    if (error) throw error;
    return { ms: performanceTime(start), query: upsertRecord };
}
