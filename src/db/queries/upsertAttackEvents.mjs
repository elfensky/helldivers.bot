import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { zodIsNumber } from '@/validators/isNumber';

export async function queryUpsertAttackEvents(events) {
    'use server';
    const start = performance.now();

    try {
        const now = new Date();

        const upsertRecords = [];
        for (const event of events) {
            const upsertRecord = await db.h1_attack_event.upsert({
                where: {
                    event_id: event.event_id,
                },
                update: {
                    season: event.season,
                    // event_id: event.event_id,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    enemy: event.enemy,
                    points_max: event.points_max,
                    points: event.points,
                    status: event.status,
                    players_at_start: event.players_at_start,
                },
                create: {
                    season: event.season,
                    event_id: event.event_id,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    enemy: event.enemy,
                    points_max: event.points_max,
                    points: event.points,
                    status: event.status,
                    players_at_start: event.players_at_start,
                },
            });
            upsertRecords.push(upsertRecord);
        }

        const response = {
            ms: performanceTime(start),
            query: upsertRecords,
        };

        return response;
    } catch (error) {
        console.error(error.message, {
            cause: '/src/db/queries/queryUpsertAttackEvents.mjs',
        });
        throw error;
    }
}
