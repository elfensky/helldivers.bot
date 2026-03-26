/**
 * Seed script for historical Helldivers 1 season data.
 *
 * Reads JSON files from prisma/seed/seasons/ and upserts them into
 * the normalized h1_* tables. Each JSON file should match the shape
 * returned by the official get_snapshots API endpoint.
 *
 * Usage:
 *   node --experimental-strip-types prisma/seed/seed.mjs
 *
 * Requires POSTGRES_URL environment variable.
 */

import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Relative imports — @/* aliases don't work outside Next.js
import { PrismaClient } from '../../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEASONS_DIR = join(__dirname, 'seasons');
const CONCURRENCY = 10;

async function seedSeason(db, file) {
    const filePath = join(SEASONS_DIR, file);
    const raw = await readFile(filePath, 'utf-8');
    const seasonData = JSON.parse(raw);

    // Extract season number from first snapshot, defend event, or attack event
    const season =
        seasonData.snapshots?.[0]?.season ??
        seasonData.defend_events?.[0]?.season ??
        seasonData.attack_events?.[0]?.season;

    if (season === undefined || season === null) {
        console.warn(`Skipping ${file}: could not determine season number.`);
        return;
    }

    // 1. Upsert season (must exist before FK-dependent rows)
    await db.h1_season.upsert({
        where: { season },
        update: {},
        create: { season },
    });

    // 2-3. Upsert introduction_order and points_max in parallel
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

    // 4. Upsert defend events (batched)
    const defendEvents = (seasonData.defend_events ?? []).filter(
        (e) => e.season === season,
    );
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

    // 5. Upsert attack events (batched)
    const attackEvents = (seasonData.attack_events ?? []).filter(
        (e) => e.season === season,
    );
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

    // 6. Upsert snapshots (batched)
    const snapshots = (seasonData.snapshots ?? []).filter((s) => s.season === season);
    await Promise.all(
        snapshots.map((snapshot) => {
            const parsedData =
                typeof snapshot.data === 'string' ?
                    JSON.parse(snapshot.data)
                :   snapshot.data;
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

    const d = defendEvents.length;
    const a = attackEvents.length;
    const s = snapshots.length;
    console.log(`  ${file}: season ${season} — ${d} defend, ${a} attack, ${s} snapshots`);
}

async function seed() {
    const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
    const db = new PrismaClient({ adapter });

    let files;
    const { data, error } = await readdir(SEASONS_DIR)
        .then((d) => ({ data: d, error: null }))
        .catch((e) => ({ data: null, error: e }));

    if (error) {
        console.log('No seasons directory found at prisma/seed/seasons/. Skipping seed.');
        await db.$disconnect();
        return;
    }

    files = data;

    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();

    if (jsonFiles.length === 0) {
        console.log('No seed files found. Skipping seed.');
        await db.$disconnect();
        return;
    }

    console.log(
        `Found ${jsonFiles.length} season file(s) to seed (concurrency: ${CONCURRENCY}).`,
    );

    // Process in batches of CONCURRENCY
    for (let i = 0; i < jsonFiles.length; i += CONCURRENCY) {
        const batch = jsonFiles.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((file) => seedSeason(db, file)));
    }

    await db.$disconnect();
    console.log('Seed complete.');
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
