import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { fetchSeason } from '@/update/fetch';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';

/**
 * Fetches a single season from the official Helldivers API and seeds it into the DB.
 * Called on-demand when a user requests a season that hasn't been stored yet.
 */
export async function fetchAndSeedSeason(season) {
    'use server';

    const { data: seasonData, error: fetchError } = await tryCatch(fetchSeason(season));
    if (fetchError) throw fetchError;

    const hasData =
        seasonData?.snapshots?.length > 0 ||
        seasonData?.defend_events?.length > 0 ||
        seasonData?.attack_events?.length > 0;

    if (!hasData) return;

    // 1. Upsert season row (FK dependency)
    await queryUpsertSeason(season);

    // 2. Upsert introduction_order and points_max
    const metaOps = [];
    if (seasonData.introduction_order) {
        metaOps.push(
            db.h1_introduction_order.upsert({
                where: { season },
                update: { order: seasonData.introduction_order },
                create: { season, order: seasonData.introduction_order },
            }),
        );
    }
    if (seasonData.points_max) {
        metaOps.push(
            db.h1_points_max.upsert({
                where: { season },
                update: { points: seasonData.points_max },
                create: { season, points: seasonData.points_max },
            }),
        );
    }
    await Promise.all(metaOps);

    // 3. Upsert defend events
    const defendEvents = (seasonData.defend_events ?? []).filter((e) => e.season === season);
    await Promise.all(
        defendEvents.map((event) =>
            db.h1_event.upsert({
                where: { type_event_id: { type: 'defend', event_id: event.event_id } },
                update: {
                    season: event.season,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    region: event.region,
                    enemy: event.enemy,
                    points_max: event.points_max,
                    points: event.points,
                    status: event.status,
                    players_at_start: event.players_at_start ?? null,
                },
                create: {
                    season: event.season,
                    type: 'defend',
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
        ),
    );

    // 4. Upsert attack events
    const attackEvents = (seasonData.attack_events ?? []).filter((e) => e.season === season);
    await Promise.all(
        attackEvents.map((event) =>
            db.h1_event.upsert({
                where: { type_event_id: { type: 'attack', event_id: event.event_id } },
                update: {
                    season: event.season,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    region: 11,
                    enemy: event.enemy,
                    points_max: event.points_max,
                    points: event.points,
                    status: event.status,
                    players_at_start: event.players_at_start ?? null,
                },
                create: {
                    season: event.season,
                    type: 'attack',
                    event_id: event.event_id,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    region: 11,
                    enemy: event.enemy,
                    points_max: event.points_max,
                    points: event.points,
                    status: event.status,
                    players_at_start: event.players_at_start ?? null,
                },
            }),
        ),
    );

    // 5. Upsert snapshots
    const snapshots = (seasonData.snapshots ?? []).filter((s) => s.season === season);
    await Promise.all(
        snapshots.map((snapshot) => {
            const parsedData =
                typeof snapshot.data === 'string' ? JSON.parse(snapshot.data) : snapshot.data;
            return db.h1_snapshot.upsert({
                where: { season_time: { season: snapshot.season, time: snapshot.time } },
                update: { data: parsedData },
                create: {
                    season: snapshot.season,
                    time: snapshot.time,
                    data: parsedData,
                },
            });
        }),
    );
}
