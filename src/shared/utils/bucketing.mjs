/**
 * Shared bucket-math helper for h1_* timeseries tables.
 *
 * Every worker poll writes to h1_status, h1_statistic, and h1_event_progress
 * via a tumbling-window UPSERT keyed on (entity, bucket). Within an active
 * bucket window, subsequent polls UPDATE the existing row with latest values.
 * At a bucket boundary, a new row is INSERTed.
 *
 * BUCKET_SIZE is read from the env var once at module load. Default: 900 (15 min).
 */

const DEFAULT_BUCKET_SIZE = 900;
const parsed = parseInt(process.env.BUCKET_SIZE ?? '', 10);

export const BUCKET_SIZE =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BUCKET_SIZE;

export function computeBucket(pollTime) {
    return Math.floor(pollTime / BUCKET_SIZE) * BUCKET_SIZE;
}

export function groupStatusByBucket(statusRows) {
    const byBucket = new Map();
    for (const row of statusRows) {
        if (!byBucket.has(row.bucket)) {
            byBucket.set(row.bucket, { time: row.time, factions: [null, null, null] });
        }
        const entry = byBucket.get(row.bucket);
        entry.factions[row.enemy] = {
            points: row.points,
            points_taken: row.points_taken,
            status: row.status,
        };
        if (row.time > entry.time) entry.time = row.time;
    }
    return Array.from(byBucket.values())
        .sort((a, b) => a.time - b.time)
        .filter(({ factions }) => factions.every((f) => f !== null));
}
