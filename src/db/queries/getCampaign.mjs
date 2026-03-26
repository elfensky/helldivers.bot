'use server';
import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function getCampaign(season = null) {
    const start = performance.now();

    const where = season === null ? { last_updated: { not: null } } : { season: season };

    const orderBy = season === null ? { season: 'desc' } : undefined;

    const { data, error } = await tryCatch(
        db.h1_season.findFirst({
            ...(orderBy && { orderBy }),
            where,
            select: {
                season: true,
                last_updated: true,
                // h1_live replaces campaigns + statistics
                live: {
                    select: {
                        enemy: true,
                        points: true,
                        points_taken: true,
                        points_max: true,
                        status: true,
                        introduction_order: true,
                        season_duration: true,
                        players: true,
                        total_unique_players: true,
                        missions: true,
                        successful_missions: true,
                        total_mission_difficulty: true,
                        completed_planets: true,
                        defend_events: true,
                        successful_defend_events: true,
                        attack_events: true,
                        successful_attack_events: true,
                        deaths: true,
                        kills: true,
                        accidentals: true,
                        shots: true,
                        hits: true,
                        map: true,
                    },
                },
                introduction_order: {
                    select: { order: true },
                },
                points_max: {
                    select: { points: true },
                },
                snapshots: {
                    select: { data: true, time: true },
                },
                // unified events replace defend_events + attack_events
                events: {
                    select: {
                        type: true,
                        event_id: true,
                        start_time: true,
                        end_time: true,
                        region: true,
                        enemy: true,
                        points_max: true,
                        points: true,
                        status: true,
                        players_at_start: true,
                    },
                },
            },
        }),
    );

    if (error) throw error;

    return data;
}
