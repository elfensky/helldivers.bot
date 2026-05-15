import { cache } from 'react';
import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { groupStatusByBucket } from '@/shared/utils/bucketing';

/**
 * Fetch the campaign data for a season (or the latest season if null).
 *
 * @returns {Promise<Object|null>} Campaign data, or null if no season exists
 *
 * Returns a shape compatible with the legacy getCampaign output:
 *   { season, last_updated, status, introduction_order, points_max, snapshots, events }
 *
 * - `status`     — 3 rows from h1_status, one per faction, latest bucket each.
 *                  Consumers cast this as an array of faction states.
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
    const rawLiveRows = await db.$queryRaw`
        SELECT DISTINCT ON (enemy) *
        FROM h1_status
        WHERE season = ${targetSeason}
        ORDER BY enemy ASC, bucket DESC
    `;

    // Latest h1_statistic row per faction — stats signals live on a separate
    // table since Task 7. The legacy h1_live row had these inline, so all
    // consumers reading data.status[i].players/kills/deaths/total_unique_players
    // expect them to travel with the campaign row.
    const rawStatRows = await db.$queryRaw`
        SELECT DISTINCT ON (enemy) *
        FROM h1_statistic
        WHERE season = ${targetSeason}
        ORDER BY enemy ASC, bucket DESC
    `;

    // Merge h1_status + h1_statistic + season constants into legacy liveRow
    // shape. Consumers (computeMapState, StatGrid, EventCard, opengraph-image)
    // read this as the per-faction "current state" and must find the fields
    // they historically read from h1_live: campaign progression + points_max +
    // introduction_order + 11 per-faction stats fields. season_duration is
    // no longer per-faction — it now lives on h1_season and is exposed at
    // the top level of the return object instead.
    const statByEnemy = new Map(rawStatRows.map((r) => [r.enemy, r]));
    const liveRows = rawLiveRows.map((r) => {
        const stat = statByEnemy.get(r.enemy);
        return {
            ...r,
            points_max: seasonRow.points_max?.[r.enemy] ?? 0,
            introduction_order: seasonRow.introduction_order?.[r.enemy] ?? 0,
            // Merge 11 per-faction stats fields from h1_statistic
            players: stat?.players ?? 0,
            total_unique_players: stat?.total_unique_players ?? 0,
            missions: stat?.missions ?? 0,
            successful_missions: stat?.successful_missions ?? 0,
            total_mission_difficulty: stat?.total_mission_difficulty ?? 0,
            completed_planets: stat?.completed_planets ?? 0,
            kills: stat?.kills ?? 0n,
            deaths: stat?.deaths ?? 0n,
            accidentals: stat?.accidentals ?? 0n,
            shots: stat?.shots ?? 0n,
            hits: stat?.hits ?? 0n,
        };
    });

    // Step 3: Full history for the archives chart.
    const allStatusRows = await db.h1_status.findMany({
        where: { season: targetSeason },
        orderBy: [{ bucket: 'asc' }, { enemy: 'asc' }],
    });

    // Group full history by bucket into the legacy snapshot shape.
    // Each snapshot has { time, data: [f0, f1, f2] } — the consumer pattern
    // for archives charts (FactionHealthChart, getWarOutcome, etc.).
    const snapshots = groupStatusByBucket(allStatusRows).map(({ time, factions }) => ({
        time,
        data: factions,
    }));

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
        // Per-season scalar (not per-faction). Lives on h1_season instead
        // of h1_statistic; exposed at the top level so consumers don't go
        // looking in data.status[i].
        season_duration: seasonRow.season_duration ?? 0,
        status: liveRows,
        introduction_order: { order: seasonRow.introduction_order ?? [] },
        points_max: { points: seasonRow.points_max ?? [] },
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
                introduction_order: true,
                points_max: true,
                season_duration: true,
            },
        }),
    );

    if (error) throw error;
    return data;
}

