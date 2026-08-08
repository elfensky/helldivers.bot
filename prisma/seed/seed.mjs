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
import { fileURLToPath, pathToFileURL } from 'node:url';

// Relative imports — @/* aliases don't work outside Next.js
import { PrismaClient } from '../../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { isValidSeason } from '../../src/validators/isValidSeason.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEASONS_DIR = join(__dirname, 'seasons');
const CONCURRENCY = 10;

// Tumbling-window bucket math for h1_status. Mirrors src/shared/utils/bucketing.mjs
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

// Fixed owner row for the CI key. A literal UUID (not randomUUID) so re-running
// the seed re-uses the same user instead of piling up orphans.
const TEST_USER_ID = '00000000-0000-7000-8000-000000000001';

// `ApiKey.visible` is display-only metadata — the dashboard renders it as
// `****{visible}` (src/features/{account/ApiDashboard,admin/AdminApiKeys}.jsx)
// and nothing in validateApiKey.mjs reads it (that lookup selects id/userId/
// enabled only). Normally it holds the plaintext's last 4 characters, but this
// seed never sees a plaintext, so a fixed non-secret marker stands in.
const TEST_KEY_VISIBLE = 'ci';

/**
 * CI/TEST ONLY — seed one deterministic API key so the smoke suite can exercise
 * the key-gated `/api/v1/h1/*` surface.
 *
 * Takes the **already-hashed** key, never the plaintext: `SEED_TEST_API_KEY_HASH`
 * is the sha-256 hex digest that `validateApiKey.mjs` will compute from the
 * `Authorization: Bearer <key>` header at request time, and it is written to
 * `ApiKey.hash` verbatim. The matching plaintext goes only to the smoke suite
 * that has to send it. Keeping the two apart means this script handles no secret
 * material at all — it does no hashing, and logs nothing key-derived.
 *
 * Gated entirely behind the variable: when it is absent this is a no-op, so
 * ordinary developer seeding and the production/Docker migrate container never
 * create a key. NEVER point this at a hash whose plaintext is used anywhere real
 * — a row here grants full access to the public API.
 *
 * Runs before the "already seeded" short-circuit below so the key is created even
 * when the season data is already present.
 *
 * @param {import('../../src/generated/prisma/client.ts').PrismaClient} db - Connected client.
 * @returns {Promise<void>}
 */
async function seedTestApiKey(db) {
    const hash = process.env.SEED_TEST_API_KEY_HASH;
    if (!hash) return;

    if (!/^[0-9a-f]{64}$/.test(hash)) {
        throw new Error(
            'SEED_TEST_API_KEY_HASH must be a 64-character lowercase sha-256 hex digest.',
        );
    }

    await db.user.upsert({
        where: { id: TEST_USER_ID },
        update: {},
        create: {
            id: TEST_USER_ID,
            name: 'CI Smoke Test',
            email: 'ci-smoke-test@invalid',
            role: 'user',
        },
    });

    await db.apiKey.upsert({
        where: { hash },
        update: { enabled: true, userId: TEST_USER_ID },
        create: {
            hash,
            visible: TEST_KEY_VISIBLE,
            userId: TEST_USER_ID,
            description: 'CI smoke test key',
            enabled: true,
        },
    });

    console.log('SEED_TEST_API_KEY_HASH is set — seeded the CI smoke-test API key.');
}

/**
 * Season number encoded in a seed filename — `season-042.json` → 42.
 *
 * @param {string} file - Seed filename
 * @returns {number|null} The season, or null when the name doesn't encode one
 */
export function seasonFromFilename(file) {
    const match = /^season-(\d+)\.json$/.exec(file);
    return match ? Number(match[1]) : null;
}

/**
 * Seed files whose season is not already in the database.
 *
 * Replaces a count comparison (`db.h1_season.count() === jsonFiles.length`)
 * that was wrong in both directions. It re-seeded EVERYTHING whenever the
 * numbers differed, so the weekly seed-refresh workflow adding one finished
 * season meant rewriting all 159 already-present ones. And it skipped
 * everything whenever the numbers happened to match, so a database holding
 * 158 seed seasons plus one on-demand backfill counted as complete while a
 * seed file sat unapplied.
 *
 * A file whose name doesn't encode a season is always seeded — seedSeason()
 * reads the number out of the file contents, and skipping on a guess would
 * silently drop data.
 *
 * @param {string[]} files - Candidate seed filenames
 * @param {Set<number>} seeded - Seasons already present in h1_season
 * @returns {string[]} The subset still needing a seed run
 */
export function pendingSeasonFiles(files, seeded) {
    return files.filter((file) => {
        const season = seasonFromFilename(file);
        return season === null || !seeded.has(season);
    });
}

async function seed() {
    const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
    const db = new PrismaClient({ adapter });

    await seedTestApiKey(db);

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

    let pending = jsonFiles;

    if (process.env.FORCE_SEED) {
        console.log('FORCE_SEED is set. Re-seeding every season file.');
    } else {
        const rows = await db.h1_season.findMany({ select: { season: true } });
        const seeded = new Set(rows.map((r) => r.season));
        pending = pendingSeasonFiles(jsonFiles, seeded);

        if (pending.length === 0) {
            console.log(
                `Already seeded (${seeded.size} seasons in the database). Nothing to do. Set FORCE_SEED=true to re-seed.`,
            );
            await db.$disconnect();
            return;
        }
    }

    const skipped = jsonFiles.length - pending.length;
    console.log(
        `Found ${jsonFiles.length} season file(s); ${skipped} already present, ` +
            `seeding ${pending.length} (concurrency: ${CONCURRENCY}).`,
    );

    // Process in batches of CONCURRENCY
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const batch = pending.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((file) => seedSeason(db, file)));
    }

    await db.$disconnect();
    console.log('Seed complete.');
}

// Only run when invoked as a script. Without this, importing the module to
// test the pure helpers above would connect to the database and seed it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    seed().catch((err) => {
        console.error('Seed failed:', err);
        process.exit(1);
    });
}
