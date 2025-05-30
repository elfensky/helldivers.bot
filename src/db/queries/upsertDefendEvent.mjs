import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertDefendEvent(event) {
    'use server';
    const start = performance.now();

    try {
        const now = new Date();

        const upsertRecord = await db.h1_defend_event.upsert({
            where: {
                event_id: event.event_id,
            },
            update: {
                season: event.season,
                // event_id: event.event_id,
                start_time: event.start_time,
                end_time: event.end_time,
                region: event.region,
                enemy: event.enemy,
                points_max: event.points_max,
                points: event.points,
                status: event.status,
            },
            create: {
                season: event.season,
                event_id: event.event_id,
                start_time: event.start_time,
                end_time: event.end_time,
                region: event.region,
                enemy: event.enemy,
                points_max: event.points_max,
                points: event.points,
                status: event.status,
            },
        });

        const response = {
            ms: performanceTime(start),
            query: upsertRecord,
        };

        return response;
    } catch (error) {
        console.error(error.message, {
            cause: '/src/db/queries/queryUpsertDefendEvent.mjs',
        });
        throw error;
    }
}
