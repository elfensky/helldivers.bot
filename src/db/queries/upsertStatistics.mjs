import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertStatistics(season, statistics) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!statistics) throw new Error('statistics are missing');
    // return 1;
    try {
        let skipped = false;
        const now = new Date();
        const upsertRecords = [];

        for (const statistic of statistics) {
            if (statistic?.season !== season) {
                skipped = true;
                continue; //skip if data is not from current season
            }

            const upsertRecord = await db.h1_statistic.upsert({
                where: {
                    season_enemy: {
                        season: statistic.season,
                        enemy: statistic.enemy,
                    },
                },
                update: {
                    // season: statistic.season,
                    season_duration: statistic.season_duration,
                    // enemy: statistic.enemy,
                    players: statistic.players,
                    total_unique_players: statistic.total_unique_players,
                    missions: statistic.missions,
                    successful_missions: statistic.successful_missions,
                    total_mission_difficulty: statistic.total_mission_difficulty,
                    completed_planets: statistic.completed_planets,
                    defend_events: statistic.defend_events,
                    successful_defend_events: statistic.successful_defend_events,
                    attack_events: statistic.attack_events,
                    successful_attack_events: statistic.successful_attack_events,
                    deaths: statistic.deaths,
                    kills: statistic.kills,
                    accidentals: statistic.accidentals,
                    shots: statistic.shots,
                    hits: statistic.hits,
                },
                create: {
                    season: statistic.season,
                    season_duration: statistic.season_duration,
                    enemy: statistic.enemy,
                    players: statistic.players,
                    total_unique_players: statistic.total_unique_players,
                    missions: statistic.missions,
                    successful_missions: statistic.successful_missions,
                    total_mission_difficulty: statistic.total_mission_difficulty,
                    completed_planets: statistic.completed_planets,
                    defend_events: statistic.defend_events,
                    successful_defend_events: statistic.successful_defend_events,
                    attack_events: statistic.attack_events,
                    successful_attack_events: statistic.successful_attack_events,
                    deaths: statistic.deaths,
                    kills: statistic.kills,
                    accidentals: statistic.accidentals,
                    shots: statistic.shots,
                    hits: statistic.hits,
                },
            });

            upsertRecords.push(upsertRecord);
            skipped = false;
        }

        const response = {
            ms: performanceTime(start),
            query: upsertRecords || skipped,
        };

        return response;
    } catch (error) {
        console.error(error.message, {
            cause: 'db/queries/queryUpsertStatistics.mjs',
        });
        throw error;
    }
}
