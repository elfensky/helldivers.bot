import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertLive(season, enemy, campaign, stats, factionMap) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (enemy === undefined || enemy === null) throw new Error('enemy is missing');
    if (!campaign) throw new Error('campaign is missing');
    if (!stats) throw new Error('stats is missing');

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_live.upsert({
            where: {
                season_enemy: {
                    season: season,
                    enemy: enemy,
                },
            },
            update: {
                // campaign_status fields
                points: campaign.points,
                points_taken: campaign.points_taken,
                points_max: campaign.points_max,
                status: campaign.status,
                introduction_order: campaign.introduction_order,
                // statistics fields
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
                // computed map
                map: factionMap ?? null,
            },
            create: {
                season: season,
                enemy: enemy,
                // campaign_status fields
                points: campaign.points,
                points_taken: campaign.points_taken,
                points_max: campaign.points_max,
                status: campaign.status,
                introduction_order: campaign.introduction_order,
                // statistics fields
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
                // computed map
                map: factionMap ?? null,
            },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query: upsertRecord };
}
