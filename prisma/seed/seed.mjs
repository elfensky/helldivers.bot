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
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEASONS_DIR = join(__dirname, 'seed', 'seasons');

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

    console.log(`Found ${jsonFiles.length} season file(s) to seed.`);

    for (const file of jsonFiles) {
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
            continue;
        }

        console.log(`Seeding season ${season} from ${file}...`);

        // 1. Upsert season
        await db.h1_season.upsert({
            where: { season },
            update: {},
            create: { season },
        });

        // 2. Upsert introduction_order
        if (seasonData.introduction_order) {
            await db.h1_introduction_order.upsert({
                where: { season },
                update: { order: seasonData.introduction_order },
                create: { season, order: seasonData.introduction_order },
            });
        }

        // 3. Upsert points_max
        if (seasonData.points_max) {
            await db.h1_points_max.upsert({
                where: { season },
                update: { points: seasonData.points_max },
                create: { season, points: seasonData.points_max },
            });
        }

        // 4. Upsert defend events
        const defendEvents = seasonData.defend_events ?? [];
        for (const event of defendEvents) {
            if (event.season !== season) continue;
            await db.h1_event.upsert({
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
            });
        }
        if (defendEvents.length > 0) {
            console.log(`  ${defendEvents.length} defend event(s)`);
        }

        // 5. Upsert attack events (region = 11 for homeworld)
        const attackEvents = seasonData.attack_events ?? [];
        for (const event of attackEvents) {
            if (event.season !== season) continue;
            await db.h1_event.upsert({
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
            });
        }
        if (attackEvents.length > 0) {
            console.log(`  ${attackEvents.length} attack event(s)`);
        }

        // 6. Upsert snapshots
        const snapshots = seasonData.snapshots ?? [];
        let snapshotCount = 0;
        for (const snapshot of snapshots) {
            if (snapshot.season !== season) continue;
            await db.h1_snapshot.upsert({
                where: { season_time: { season: snapshot.season, time: snapshot.time } },
                update: { data: snapshot.data, json: snapshot.data },
                create: {
                    season: snapshot.season,
                    time: snapshot.time,
                    data: snapshot.data,
                    json: snapshot.data,
                },
            });
            snapshotCount++;
        }
        if (snapshotCount > 0) {
            console.log(`  ${snapshotCount} snapshot(s)`);
        }

        console.log(`  Season ${season} done.`);
    }

    await db.$disconnect();
    console.log('Seed complete.');
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
