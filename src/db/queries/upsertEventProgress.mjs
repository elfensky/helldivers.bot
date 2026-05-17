import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time.mjs';
import { computeBucket } from '@/shared/utils/bucketing.mjs';

/**
 * Upsert a single h1_event_progress row for one event at the bucket
 * computed from pollTime. Captures only `points` — the progression
 * signal. points_max is a constant set at event creation and lives on
 * h1_event; status is event-level final state and also lives on h1_event.
 *
 * @param {'attack' | 'defend'} type
 * @param {{ event_id: number, points: number }} event
 * @param {number} pollTime Unix timestamp from API response
 */
export async function queryUpsertEventProgress(type, event, pollTime) {
    'use server';
    const start = performance.now();

    if (!type) throw new Error('type is missing');
    if (!event) throw new Error('event is missing');
    if (!pollTime) throw new Error('pollTime is missing');

    const bucket = computeBucket(pollTime);

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_event_progress.upsert({
            where: {
                type_event_id_bucket: {
                    type,
                    event_id: event.event_id,
                    bucket,
                },
            },
            update: {
                time: pollTime,
                points: event.points,
            },
            create: {
                type,
                event_id: event.event_id,
                bucket,
                time: pollTime,
                points: event.points,
            },
        }),
    );

    if (error) throw error;
    return { ms: performanceTime(start), query: upsertRecord };
}
