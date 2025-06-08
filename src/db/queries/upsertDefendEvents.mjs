import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { isValidNumber } from '@/validators/isValidNumber';

export async function queryUpsertDefendEvents(season, events) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!events) throw new Error('defend events are missing');

    try {
        let skipped = false;
        const now = new Date();
        const upsertRecords = [];

        for (const event of events) {
            if (event?.season !== season) {
                skipped = true;
                continue; //skip if data is not from current season
            }

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
                    players_at_start: event.players_at_start,
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
                    players_at_start: event.players_at_start,
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
            cause: '/src/db/queries/queryUpsertDefendEvents.mjs',
        });
        throw error;
    }
}
