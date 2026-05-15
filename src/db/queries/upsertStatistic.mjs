import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';
import { computeBucket } from '@/shared/utils/bucketing';

/**
 * Upsert a single h1_statistic row for one (season, enemy) at the bucket
 * computed from pollTime. Captures 11 per-faction stats fields from
 * statistics[enemy] in get_campaign_status — each is a monotonic counter
 * (except `players`, which fluctuates) so all belong in the timeseries.
 *
 * Five upstream fields are intentionally NOT written here:
 *   - season_duration — moved to h1_season as a scalar (per-season state,
 *     not per-faction; handled by queryUpsertSeason).
 *   - defend_events / successful_defend_events / attack_events /
 *     successful_attack_events — derivable from h1_event counts
 *     (COUNT(*) WHERE type=... AND status=... AND season=X).
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

    const statsFields = {
        players: stats.players,
        total_unique_players: stats.total_unique_players,
        missions: stats.missions,
        successful_missions: stats.successful_missions,
        total_mission_difficulty: stats.total_mission_difficulty,
        completed_planets: stats.completed_planets,
        kills: stats.kills,
        deaths: stats.deaths,
        accidentals: stats.accidentals,
        shots: stats.shots,
        hits: stats.hits,
    };

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_statistic.upsert({
            where: {
                season_enemy_bucket: { season, enemy, bucket },
            },
            update: {
                time: pollTime,
                ...statsFields,
            },
            create: {
                season,
                enemy,
                bucket,
                time: pollTime,
                ...statsFields,
            },
        }),
    );

    if (error) throw error;
    return { ms: performanceTime(start), query: upsertRecord };
}
