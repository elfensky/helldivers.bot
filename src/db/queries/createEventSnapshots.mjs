import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';

/**
 * Insert a single event snapshot.
 * Uses upsert to update if the same (type, event_id, time) already exists.
 *
 * @param {number} season - Current season number
 * @param {string} type - 'defend' or 'attack'
 * @param {object} event - Event object with event_id, points, points_max
 * @param {number} time - API server timestamp (fetchedData.time)
 */
export async function queryCreateEventSnapshot(season, type, event, time) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!type) throw new Error('type is missing');
    if (!event) throw new Error('event is missing');
    if (!time) throw new Error('time is missing');

    // Skip cross-season events
    if (event.season !== season) return { ms: 0, query: null, skipped: true };

    const { data: record, error } = await tryCatch(
        db.h1_event_snapshot.upsert({
            where: {
                type_event_id_time: {
                    type: type,
                    event_id: event.event_id,
                    time: time,
                },
            },
            update: {
                points: event.points,
                points_max: event.points_max,
            },
            create: {
                season: season,
                type: type,
                event_id: event.event_id,
                time: time,
                points: event.points,
                points_max: event.points_max,
            },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query: record };
}
