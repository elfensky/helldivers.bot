import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

/**
 * Insert live statistic snapshots for all 3 enemy factions.
 * Uses upsert to update if the same (season, enemy, time) already exists
 * (handles retries without silent data loss).
 *
 * @param {number} season - Current season number
 * @param {number} time - API server timestamp (fetchedData.time)
 * @param {Array} statistics - fetchedData.statistics array (3 entries, one per enemy)
 */
export async function queryCreateLiveSnapshots(season, time, statistics) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!time) throw new Error('time is missing');
    if (!statistics) throw new Error('statistics are missing');

    const results = [];

    for (const stats of statistics) {
        const enemy = stats.enemy;
        const snapshotData = {
            season_duration: stats.season_duration,
            players: stats.players,
            total_unique_players: stats.total_unique_players,
            missions: stats.missions,
            successful_missions: stats.successful_missions,
            total_mission_difficulty: stats.total_mission_difficulty,
            completed_planets: stats.completed_planets,
            defend_events: stats.defend_events,
            successful_defend_events: stats.successful_defend_events,
            attack_events: stats.attack_events,
            successful_attack_events: stats.successful_attack_events,
            deaths: stats.deaths,
            kills: stats.kills,
            accidentals: stats.accidentals,
            shots: stats.shots,
            hits: stats.hits,
        };

        const { data: record, error } = await tryCatch(
            db.h1_live_snapshot.upsert({
                where: {
                    season_enemy_time: {
                        season: season,
                        enemy: enemy,
                        time: time,
                    },
                },
                update: snapshotData,
                create: { season, time, enemy, ...snapshotData },
            }),
        );

        if (error) throw error;
        results.push(record);
    }

    return { ms: performanceTime(start), query: results };
}
