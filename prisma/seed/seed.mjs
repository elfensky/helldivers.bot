/**
 * Seed script for historical Helldivers 1 season data.
 *
 * Reads JSON files from prisma/seed/seasons/ and upserts them into
 * the normalized h1_* tables. Each JSON file matches the wire shape
 * returned by the official get_snapshots API endpoint, including the
 * `snapshots[].data` field as a stringified JSON array (parsed here
 * at write time, never on disk).
 *
 * Usage:
 *   node --experimental-strip-types prisma/seed/seed.mjs
 *
 * Requires POSTGRES_URL environment variable.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
dotenv.config(); // fallback to .env (production/Docker)
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Relative imports — @/* aliases don't work outside Next.js
import { PrismaClient } from '../../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { isValidSeason } from '../../src/validators/isValidSeason.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEASONS_DIR = join(__dirname, 'seasons');
const CONCURRENCY = 10;

// Tumbling-window bucket math for h1_status. Mirrors src/update/bucketing.mjs
// but inlined here so this script has no `@/*`-aliased dependencies.
const DEFAULT_BUCKET_SIZE = 900;
const parsedBucketSize = parseInt(process.env.BUCKET_SIZE ?? '', 10);
const BUCKET_SIZE =
    Number.isFinite(parsedBucketSize) && parsedBucketSize > 0 ?
        parsedBucketSize
    :   DEFAULT_BUCKET_SIZE;
function computeBucket(pollTime) {
    return Math.floor(pollTime / BUCKET_SIZE) * BUCKET_SIZE;
}

async function seedSeason(db, file) {
    const filePath = join(SEASONS_DIR, file);
    const raw = await readFile(filePath, 'utf-8');
    const seasonData = JSON.parse(raw);

    // Validate against the same schema the worker pipeline uses. Wire format:
    // snapshots[].data is a stringified JSON array of 3 faction status objects.
    // isValidSeason is a raw Zod schema (post-v0.46.4 protocol unification),
    // not a callable wrapper — invoke via .safeParse(). The src/update/*.mjs
    // callers were migrated in v0.46.4 but this seed caller was missed.
    const check = isValidSeason.safeParse(seasonData);
    if (!check.success) {
        console.warn(`Skipping ${file}: validation failed.`);
        for (const issue of check.error?.issues ?? []) {
            console.warn(`  - ${issue.path?.join('.') ?? ''}: ${issue.message}`);
        }
        return;
    }

    // Extract season number from first snapshot, defend event, or attack event
    const season =
        seasonData.snapshots?.[0]?.season ??
        seasonData.defend_events?.[0]?.season ??
        seasonData.attack_events?.[0]?.season;

    if (season === undefined || season === null) {
        console.warn(`Skipping ${file}: could not determine season number.`);
        return;
    }

    // 1. Upsert h1_season with inlined per-season metadata + last_updated stamp.
    //    Mirrors queryUpsertSeason(season, true, { introOrder, pointsMax }).
    //    No seasonDuration — get_snapshots historical data doesn't carry it.
    const now = new Date();
    const seasonUpdate = { last_updated: now };
    const seasonCreate = { season, last_updated: now };
    if (seasonData.introduction_order !== undefined) {
        seasonUpdate.introduction_order = seasonData.introduction_order ?? [];
        seasonCreate.introduction_order = seasonData.introduction_order ?? [];
    }
    if (seasonData.points_max !== undefined) {
        seasonUpdate.points_max = seasonData.points_max ?? [];
        seasonCreate.points_max = seasonData.points_max ?? [];
    }
    await db.h1_season.upsert({
        where: { season },
        update: seasonUpdate,
        create: seasonCreate,
    });

    // 2. Filter cross-season slots — get_snapshots can carry lagged events from
    //    adjacent seasons; only events tagged with this season belong here.
    const defendEvents = (seasonData.defend_events ?? []).filter(
        (e) => e.season === season,
    );
    const attackEvents = (seasonData.attack_events ?? []).filter(
        (e) => e.season === season,
    );
    const snapshots = (seasonData.snapshots ?? []).filter((s) => s.season === season);

    // 3. Build the per-faction h1_status upsert ops from each snapshot frame.
    //    Each frame fans out to 3 rows (one per enemy 0/1/2) keyed on the
    //    tumbling bucket window (season, enemy, bucket).
    const statusOps = [];
    for (const snap of snapshots) {
        const parsed = typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data;
        if (!Array.isArray(parsed) || parsed.length !== 3) continue;
        const bucket = computeBucket(snap.time);
        for (let enemy = 0; enemy < 3; enemy++) {
            const faction = parsed[enemy];
            if (!faction) continue;
            statusOps.push(
                db.h1_status.upsert({
                    where: { season_enemy_bucket: { season, enemy, bucket } },
                    update: {
                        time: snap.time,
                        points: faction.points,
                        points_taken: faction.points_taken,
                        status: faction.status,
                    },
                    create: {
                        season,
                        enemy,
                        bucket,
                        time: snap.time,
                        points: faction.points,
                        points_taken: faction.points_taken,
                        status: faction.status,
                    },
                }),
            );
        }
    }

    // 4. Upsert events + h1_status rows in parallel.
    function upsertEvent(event, type) {
        const region = type === 'attack' ? 11 : event.region;
        const fields = {
            season: event.season,
            start_time: event.start_time,
            end_time: event.end_time,
            region,
            enemy: event.enemy,
            points_max: event.points_max,
            points: event.points,
            status: event.status,
            players_at_start: event.players_at_start ?? null,
        };
        return db.h1_event.upsert({
            where: { type_event_id: { type, event_id: event.event_id } },
            update: fields,
            create: { ...fields, type, event_id: event.event_id },
        });
    }

    await Promise.all([
        ...defendEvents.map((e) => upsertEvent(e, 'defend')),
        ...attackEvents.map((e) => upsertEvent(e, 'attack')),
        ...statusOps,
    ]);

    const d = defendEvents.length;
    const a = attackEvents.length;
    const s = snapshots.length;
    console.log(
        `  ${file}: season ${season} — ${d} defend, ${a} attack, ${s} snapshots → ${statusOps.length} status rows`,
    );
}

async function seed() {
    const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
    const db = new PrismaClient({ adapter });

    const { data: files, error } = await readdir(SEASONS_DIR)
        .then((d) => ({ data: d, error: null }))
        .catch((e) => ({ data: null, error: e }));

    if (error) {
        console.log('No seasons directory found at prisma/seed/seasons/. Skipping seed.');
        await db.$disconnect();
        return;
    }

    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();

    if (jsonFiles.length === 0) {
        console.log('No seed files found. Skipping seed.');
        await db.$disconnect();
        return;
    }

    // Skip seeding if DB already has the expected number of seasons
    if (!process.env.FORCE_SEED) {
        const dbCount = await db.h1_season.count();
        if (dbCount === jsonFiles.length) {
            console.log(
                `Already seeded (${dbCount} seasons). Skipping. Set FORCE_SEED=true to re-seed.`,
            );
            await db.$disconnect();
            return;
        }
    } else {
        console.log('FORCE_SEED is set. Re-seeding all data.');
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
