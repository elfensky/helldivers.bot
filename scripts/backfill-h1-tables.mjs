/**
 * backfill-h1-tables.mjs — offline one-shot migration tool.
 *
 * Reads from a pg_dump restore of the pre-cleanup schema (LEGACY_POSTGRES_URL)
 * and writes normalized rows into the current production schema (POSTGRES_URL).
 *
 * Per-season transactional, resumable via MAX(season) checkpoint, supports
 * --force for destructive re-runs and --from/--to for range selection.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-h1-tables.mjs [--from=N] [--to=N] [--force] [--help]
 *
 * Env vars:
 *   LEGACY_POSTGRES_URL  — connection string for the restored dump (read side)
 *   POSTGRES_URL         — connection string for target database (write side)
 *   BUCKET_SIZE          — tumbling-window size in seconds (default: 900)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
dotenv.config(); // fallback to .env

import pg from 'pg';

// Relative imports — @/* aliases don't work outside Next.js
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

// ---------------------------------------------------------------------------
// Inline bucket math (mirrors src/update/bucketing.mjs)
// ---------------------------------------------------------------------------
const DEFAULT_BUCKET_SIZE = 900;
const parsedBucketSize = parseInt(process.env.BUCKET_SIZE ?? '', 10);
const BUCKET_SIZE =
    Number.isFinite(parsedBucketSize) && parsedBucketSize > 0
        ? parsedBucketSize
        : DEFAULT_BUCKET_SIZE;

function computeBucket(pollTime) {
    return Math.floor(pollTime / BUCKET_SIZE) * BUCKET_SIZE;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
backfill-h1-tables.mjs — offline one-shot migration tool

Reads from LEGACY_POSTGRES_URL (pg_dump restore) and writes to POSTGRES_URL.

Options:
  --from=<season>  Start from this season number (inclusive)
  --to=<season>    Stop at this season number (inclusive)
  --force          Delete target rows before inserting (destructive)
  --help, -h       Show this help message

Env vars:
  LEGACY_POSTGRES_URL  Connection string for the restored dump
  POSTGRES_URL         Connection string for target database
  BUCKET_SIZE          Tumbling-window size in seconds (default: 900)
`);
    process.exit(0);
}

function getArgValue(name) {
    const prefix = `--${name}=`;
    const match = args.find((a) => a.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
}

const fromSeason = getArgValue('from') ? parseInt(getArgValue('from'), 10) : undefined;
const toSeason = getArgValue('to') ? parseInt(getArgValue('to'), 10) : undefined;
const forceMode = args.includes('--force');

if (fromSeason !== undefined && (!Number.isFinite(fromSeason) || fromSeason < 1)) {
    console.error('Error: --from must be a positive integer.');
    process.exit(1);
}
if (toSeason !== undefined && (!Number.isFinite(toSeason) || toSeason < 1)) {
    console.error('Error: --to must be a positive integer.');
    process.exit(1);
}
if (fromSeason !== undefined && toSeason !== undefined && fromSeason > toSeason) {
    console.error('Error: --from cannot be greater than --to.');
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Validate env
// ---------------------------------------------------------------------------
if (!process.env.LEGACY_POSTGRES_URL) {
    console.error('Error: LEGACY_POSTGRES_URL environment variable is required.');
    process.exit(1);
}
if (!process.env.POSTGRES_URL) {
    console.error('Error: POSTGRES_URL environment variable is required.');
    process.exit(1);
}

// BUCKET_SIZE consistency check — warn if env value differs from default
if (process.env.BUCKET_SIZE !== undefined) {
    if (BUCKET_SIZE !== DEFAULT_BUCKET_SIZE) {
        console.log(
            `Note: BUCKET_SIZE=${BUCKET_SIZE} (env override, default=${DEFAULT_BUCKET_SIZE}).`,
        );
    }
} else {
    console.log(`Using default BUCKET_SIZE=${BUCKET_SIZE}.`);
}

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------

/** Legacy DB — raw pg client for reading old tables */
const legacy = new pg.Client({ connectionString: process.env.LEGACY_POSTGRES_URL });

/** Target DB — Prisma client for writing new tables */
const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL });
const db = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read all seasons from the legacy DB. Returns sorted array of season numbers.
 */
async function getLegacySeasons() {
    const result = await legacy.query(
        'SELECT season FROM h1_season ORDER BY season ASC',
    );
    return result.rows.map((r) => r.season);
}

/**
 * Find the last completed season in the target DB (checkpoint for resumption).
 */
async function getCheckpoint() {
    const result = await db.h1_status.aggregate({ _max: { season: true } });
    return result._max.season ?? 0;
}

/**
 * Read h1_season metadata with JOINed introduction_order and points_max.
 */
async function readSeasonMeta(season) {
    const result = await legacy.query(
        `SELECT
            s.season,
            s.season_duration,
            COALESCE(s.intro_order_array, ARRAY[]::int[]) AS intro_order_array,
            COALESCE(s.points_max_array, ARRAY[]::int[]) AS points_max_array,
            io.order AS intro_order_legacy,
            pm.points AS points_max_legacy
        FROM h1_season s
        LEFT JOIN h1_introduction_order io ON io.season = s.season
        LEFT JOIN h1_points_max pm ON pm.season = s.season
        WHERE s.season = $1`,
        [season],
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    // Prefer inlined arrays; fall back to legacy relation tables
    const introOrder =
        row.intro_order_array?.length > 0
            ? row.intro_order_array
            : row.intro_order_legacy ?? [];
    const pointsMax =
        row.points_max_array?.length > 0
            ? row.points_max_array
            : row.points_max_legacy ?? [];

    return {
        season: row.season,
        season_duration: row.season_duration ?? 0,
        introduction_order: introOrder,
        points_max: pointsMax,
    };
}

/**
 * Read h1_snapshot rows — parse stringified JSON, fan into 3 faction rows,
 * deduplicate by (enemy, bucket) keeping latest time.
 */
async function readSnapshots(season) {
    const result = await legacy.query(
        'SELECT season, time, data FROM h1_snapshot WHERE season = $1 ORDER BY time ASC',
        [season],
    );

    // Build map keyed by `enemy:bucket` — latest time wins
    const bucketMap = new Map();

    for (const row of result.rows) {
        let parsed;
        try {
            parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        } catch {
            console.warn(`  [snapshot] Failed to parse data for time=${row.time}, skipping.`);
            continue;
        }
        if (!Array.isArray(parsed) || parsed.length !== 3) {
            console.warn(`  [snapshot] Unexpected data shape for time=${row.time}, skipping.`);
            continue;
        }

        const bucket = computeBucket(row.time);

        for (let enemy = 0; enemy < 3; enemy++) {
            const faction = parsed[enemy];
            if (!faction) continue;

            const key = `${enemy}:${bucket}`;
            const existing = bucketMap.get(key);
            if (!existing || row.time > existing.time) {
                bucketMap.set(key, {
                    season,
                    enemy,
                    bucket,
                    time: row.time,
                    points: faction.points ?? 0,
                    points_taken: faction.points_taken ?? 0,
                    status: faction.status ?? 'active',
                });
            }
        }
    }

    return Array.from(bucketMap.values());
}

/**
 * Read h1_live rows — convert each faction to a single bucket row.
 * These represent the "latest known state" and are bucketed at their
 * implicit time (we use 0 as fallback since h1_live has no time field).
 */
async function readLive(season) {
    const result = await legacy.query(
        `SELECT season, enemy, points, points_taken, status
         FROM h1_live WHERE season = $1`,
        [season],
    );

    // h1_live has no time field — use bucket 0 as a sentinel.
    // If snapshot data already covers this, skipDuplicates handles it.
    return result.rows.map((r) => ({
        season: r.season,
        enemy: r.enemy,
        bucket: 0,
        time: 0,
        points: r.points ?? 0,
        points_taken: r.points_taken ?? 0,
        status: r.status ?? 'active',
    }));
}

/**
 * Read h1_live_snapshot — stats timeseries.
 * Deduplicates by (enemy, bucket) keeping latest time.
 * All 11 stats fields.
 */
async function readLiveSnapshots(season) {
    const result = await legacy.query(
        `SELECT DISTINCT ON (enemy, bucket)
            season, enemy, time,
            players, total_unique_players, missions, successful_missions,
            total_mission_difficulty, completed_planets,
            kills, deaths, accidentals, shots, hits,
            FLOOR(time / $1) * $1 AS bucket
        FROM h1_live_snapshot
        WHERE season = $2
        ORDER BY enemy, bucket, time DESC`,
        [BUCKET_SIZE, season],
    );

    return result.rows.map((r) => ({
        season: r.season,
        enemy: r.enemy,
        bucket: Number(r.bucket),
        time: r.time,
        players: r.players ?? 0,
        total_unique_players: r.total_unique_players ?? 0,
        missions: r.missions ?? 0,
        successful_missions: r.successful_missions ?? 0,
        total_mission_difficulty: r.total_mission_difficulty ?? 0,
        completed_planets: r.completed_planets ?? 0,
        kills: r.kills ?? BigInt(0),
        deaths: r.deaths ?? BigInt(0),
        accidentals: r.accidentals ?? BigInt(0),
        shots: r.shots ?? BigInt(0),
        hits: r.hits ?? BigInt(0),
    }));
}

/**
 * Read h1_event_snapshot — event progression timeseries.
 * Deduplicates by (type, event_id, bucket) keeping latest time.
 */
async function readEventSnapshots(season) {
    const result = await legacy.query(
        `SELECT DISTINCT ON (type, event_id, bucket)
            type, event_id, time, points,
            FLOOR(time / $1) * $1 AS bucket
        FROM h1_event_snapshot
        WHERE season = $2
        ORDER BY type, event_id, bucket, time DESC`,
        [BUCKET_SIZE, season],
    );

    return result.rows.map((r) => ({
        type: r.type,
        event_id: r.event_id,
        bucket: Number(r.bucket),
        time: r.time,
        points: r.points ?? 0,
    }));
}

/**
 * Delete target rows for a season (--force mode).
 */
async function deleteSeasonData(season) {
    await db.$transaction([
        db.h1_event_progress.deleteMany({
            where: {
                linked_event: { season },
            },
        }),
        db.h1_statistic.deleteMany({ where: { season } }),
        db.h1_status.deleteMany({ where: { season } }),
    ]);
}

/**
 * Write all data for a single season to the target DB.
 */
async function writeSeason(meta, statusRows, statRows, progressRows) {
    const ops = [];

    // 1. h1_status rows (from h1_snapshot + h1_live)
    if (statusRows.length > 0) {
        ops.push(
            db.h1_status.createMany({
                data: statusRows,
                skipDuplicates: true,
            }),
        );
    }

    // 2. h1_statistic rows (from h1_live_snapshot)
    if (statRows.length > 0) {
        ops.push(
            db.h1_statistic.createMany({
                data: statRows.map((r) => ({
                    season: r.season,
                    enemy: r.enemy,
                    bucket: r.bucket,
                    time: r.time,
                    players: r.players,
                    total_unique_players: r.total_unique_players,
                    missions: r.missions,
                    successful_missions: r.successful_missions,
                    total_mission_difficulty: r.total_mission_difficulty,
                    completed_planets: r.completed_planets,
                    kills: r.kills,
                    deaths: r.deaths,
                    accidentals: r.accidentals,
                    shots: r.shots,
                    hits: r.hits,
                })),
                skipDuplicates: true,
            }),
        );
    }

    // 3. h1_event_progress rows (from h1_event_snapshot)
    if (progressRows.length > 0) {
        ops.push(
            db.h1_event_progress.createMany({
                data: progressRows.map((r) => ({
                    type: r.type,
                    event_id: r.event_id,
                    bucket: r.bucket,
                    time: r.time,
                    points: r.points,
                })),
                skipDuplicates: true,
            }),
        );
    }

    // 4. h1_season upsert — update metadata
    ops.push(
        db.h1_season.upsert({
            where: { season: meta.season },
            update: {
                introduction_order: meta.introduction_order,
                points_max: meta.points_max,
                season_duration: meta.season_duration,
                last_updated: new Date(),
            },
            create: {
                season: meta.season,
                introduction_order: meta.introduction_order,
                points_max: meta.points_max,
                season_duration: meta.season_duration,
                last_updated: new Date(),
            },
        }),
    );

    await db.$transaction(ops);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log('Connecting to legacy database...');
    await legacy.connect();
    console.log('Connected to legacy database.');
    console.log('Connected to target database (Prisma).');

    // Discover seasons
    const allSeasons = await getLegacySeasons();
    console.log(`Found ${allSeasons.length} seasons in legacy DB: [${allSeasons.join(', ')}]`);

    // Apply --from/--to filters
    let seasons = allSeasons;
    if (fromSeason !== undefined) {
        seasons = seasons.filter((s) => s >= fromSeason);
    }
    if (toSeason !== undefined) {
        seasons = seasons.filter((s) => s <= toSeason);
    }

    // Resume from checkpoint (unless --force or --from is set)
    if (!forceMode && fromSeason === undefined) {
        const checkpoint = await getCheckpoint();
        if (checkpoint > 0) {
            console.log(`Checkpoint: last completed season in target = ${checkpoint}`);
            const before = seasons.length;
            seasons = seasons.filter((s) => s > checkpoint);
            const skipped = before - seasons.length;
            if (skipped > 0) {
                console.log(`Skipping ${skipped} already-completed seasons.`);
            }
        }
    }

    if (seasons.length === 0) {
        console.log('No seasons to process. Done.');
        return;
    }

    console.log(`Processing ${seasons.length} seasons: [${seasons.join(', ')}]`);
    if (forceMode) {
        console.log('Force mode enabled — will delete target rows before inserting.');
    }
    console.log('');

    let processed = 0;
    let failed = 0;

    for (const season of seasons) {
        const t0 = performance.now();

        try {
            // 1. Read metadata
            const meta = await readSeasonMeta(season);
            if (!meta) {
                console.warn(`Season ${season}: no metadata found, skipping.`);
                failed++;
                continue;
            }

            // 2. Read data
            const [snapshotRows, liveRows, statRows, progressRows] = await Promise.all([
                readSnapshots(season),
                readLive(season),
                readLiveSnapshots(season),
                readEventSnapshots(season),
            ]);

            // Merge snapshot + live status rows
            const statusRows = [...snapshotRows, ...liveRows];

            // 3. Force delete if requested
            if (forceMode) {
                await deleteSeasonData(season);
            }

            // 4. Write
            await writeSeason(meta, statusRows, statRows, progressRows);

            const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
            console.log(
                `Season ${season}: ${statusRows.length} status, ` +
                    `${statRows.length} statistic, ${progressRows.length} event_progress ` +
                    `(${elapsed}s)`,
            );
            processed++;
        } catch (err) {
            const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
            console.error(`Season ${season}: FAILED (${elapsed}s) — ${err.message}`);
            failed++;
        }
    }

    console.log('');
    console.log(`Done. Processed: ${processed}, Failed: ${failed}, Total: ${seasons.length}.`);
}

try {
    await main();
} catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
} finally {
    await legacy.end().catch(() => {});
    await db.$disconnect().catch(() => {});
}
