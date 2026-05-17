import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time.mjs';

/**
 * Upsert a single h1_event row keyed by (type, event_id). Skips if the
 * event's season does not match the active season — cross-season events
 * lag in the API response for a few minutes after a season transition,
 * and we don't want them to leak into the new season's bucket.
 *
 * @param {number} season  Active season the worker is writing for
 * @param {'attack' | 'defend'} type
 * @param {object} event   Event row from the HD1 API
 */
export async function upsertEvent(season, type, event) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!type) throw new Error('type is missing');
    if (!event) throw new Error('event is missing');

    // Skip if data is not from current season (cross-season events lag in the API response)
    if (event.season !== season) return { ms: 0, query: null, skipped: true };

    const updateData = {
        season: event.season,
        start_time: event.start_time,
        end_time: event.end_time,
        region: event.region,
        enemy: event.enemy,
        points_max: event.points_max,
        points: event.points,
        status: event.status,
    };

    // Null-protection: only set players_at_start on UPDATE if we have a value.
    // The get_snapshots endpoint sometimes omits this field on historical reseeds;
    // we don't want those reseeds to clobber a value captured at real event-start
    // time by the get_campaign_status poll.
    if (event.players_at_start !== null && event.players_at_start !== undefined) {
        updateData.players_at_start = event.players_at_start;
    }

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_event.upsert({
            where: {
                type_event_id: {
                    type: type,
                    event_id: event.event_id,
                },
            },
            update: updateData,
            create: {
                season: event.season,
                type: type,
                event_id: event.event_id,
                start_time: event.start_time,
                end_time: event.end_time,
                region: event.region,
                enemy: event.enemy,
                points_max: event.points_max,
                points: event.points,
                status: event.status,
                players_at_start: event.players_at_start ?? null,
            },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query: upsertRecord };
}
