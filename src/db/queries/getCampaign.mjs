import { cache } from 'react';
import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';

/**
 * Fetch the campaign data for a season (or the latest season if null).
 *
 * Returns a shape compatible with the legacy getCampaign output:
 *   { season, last_updated, live, introduction_order, points_max, snapshots, events }
 *
 * - `live`       — 3 rows from h1_status, one per faction, latest bucket each.
 *                  Consumers cast this as an array of faction states. Task 14
 *                  will rename the field to `status` in both this query and
 *                  its consumers.
 * - `snapshots`  — full h1_status history for the season, returned as a
 *                  shape compatible with the legacy h1_snapshot output:
 *                  [{ time, data: [faction0, faction1, faction2] }, ...]
 *                  The archives chart readers iterate this list and access
 *                  data[enemy] for each time point.
 * - `introduction_order` / `points_max` — read from the new h1_season
 *                  columns as shape `{ order: number[] }` / `{ points: number[] }`
 *                  to stay API-compatible with the legacy 1:1 relations.
 */
export const getCampaign = cache(async function getCampaign(season = null) {
    'use server';
    const start = performance.now();

    // Step 1: Find the target season row.
    const seasonRow = await _findSeason(season);
    if (!seasonRow) return null;

    const targetSeason = seasonRow.season;

    // Step 2: Latest h1_status row per faction (via $queryRaw DISTINCT ON).
    // Prisma's generated client doesn't express DISTINCT ON, so we use raw SQL.
    const liveRows = await db.$queryRaw`
        SELECT DISTINCT ON (enemy) *
        FROM h1_status
        WHERE season = ${targetSeason}
        ORDER BY enemy ASC, bucket DESC
    `;

    // Step 3: Full history for the archives chart.
    const allStatusRows = await db.h1_status.findMany({
        where: { season: targetSeason },
        orderBy: [{ bucket: 'asc' }, { enemy: 'asc' }],
    });

    // Group full history by bucket into the legacy snapshot shape.
    // Each snapshot has { time, data: [f0, f1, f2] } — the consumer pattern
    // for archives charts (FactionHealthChart, getWarOutcome, etc.).
    const snapshots = _groupByBucket(allStatusRows);

    // Step 4: Events for the season.
    const events = await db.h1_event.findMany({
        where: { season: targetSeason },
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
    });

    return {
        season: seasonRow.season,
        last_updated: seasonRow.last_updated,
        live: liveRows, // Task 14 will rename to `status`.
        introduction_order: { order: seasonRow.intro_order_array ?? [] },
        points_max: { points: seasonRow.points_max_array ?? [] },
        snapshots,
        events,
    };
});

async function _findSeason(season) {
    const where = season === null ? { last_updated: { not: null } } : { season };
    const orderBy = season === null ? { season: 'desc' } : undefined;

    const { data, error } = await tryCatch(
        db.h1_season.findFirst({
            ...(orderBy && { orderBy }),
            where,
            select: {
                season: true,
                last_updated: true,
                intro_order_array: true,
                points_max_array: true,
            },
        }),
    );

    if (error) throw error;
    return data;
}

function _groupByBucket(statusRows) {
    // Group rows by bucket. Within each bucket, order by enemy so data[0]
    // is Bugs, data[1] is Cyborgs, data[2] is Illuminate — matches the
    // legacy h1_snapshot.data array layout.
    const byBucket = new Map();
    for (const row of statusRows) {
        if (!byBucket.has(row.bucket)) {
            byBucket.set(row.bucket, { time: row.time, buckets: [null, null, null] });
        }
        const entry = byBucket.get(row.bucket);
        entry.buckets[row.enemy] = {
            points: row.points,
            points_taken: row.points_taken,
            status: row.status,
        };
        // The `time` field is the latest poll time within the bucket, which
        // drifts as the row gets upserted. Use the max across enemies for
        // the snapshot's representative time.
        if (row.time > entry.time) entry.time = row.time;
    }

    return Array.from(byBucket.entries())
        .sort(([a], [b]) => a - b)
        .map(([, { time, buckets }]) => ({ time, data: buckets }));
}
