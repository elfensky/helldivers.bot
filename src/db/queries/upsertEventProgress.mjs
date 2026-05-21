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
 * Skips if the event's season does not match the active season, matching
 * upsertEvent's cross-season guard — protects against API lag leaking
 * stale events into the new season's bucket after a transition.
 *
 * @param {number} season  Active season the worker is writing for
 * @param {'attack' | 'defend'} type   Event slot the row belongs to
 * @param {{ event_id: number, season?: number, points: number }} event   Event row from the HD1 API
 * @param {number} pollTime Unix timestamp from API response
 */
export async function upsertEventProgress(season, type, event, pollTime) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!type) throw new Error('type is missing');
    if (!event) throw new Error('event is missing');
    if (!pollTime) throw new Error('pollTime is missing');

    if (event.season !== undefined && event.season !== season) {
        return { ms: 0, query: null, skipped: true };
    }

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
