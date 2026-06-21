import { z } from 'zod';
import { FACTION_SLUG_BY_ID, FACTION_INDEX } from '@/shared/enums/factions.mjs';

/**
 * Query-parameter schema for `GET /api/v1/h1/status`.
 * - `season`: `current` (default) or a positive integer season number.
 * - `enemy`: optional faction slug filter.
 * - `mode`: `latest` (default) or `history`.
 * - `from`/`to`: ISO datetime bounds (history only).
 * - `limit`/`cursor`/`order`: cursor pagination (history only).
 */
const querySchema = z.object({
    season: z
        .union([z.literal('current'), z.coerce.number().int().positive()])
        .default('current'),
    enemy: z.enum(['bugs', 'cyborgs', 'illuminate']).optional(),
    mode: z.enum(['latest', 'history']).default('latest'),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    cursor: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Parse + validate the status endpoint's query string.
 *
 * @param {URLSearchParams} searchParams - The request's query parameters.
 * @returns {{ success: true, data: import('zod').infer<typeof querySchema> } | { success: false, message: string }}
 */
export function parseStatusQuery(searchParams) {
    const result = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!result.success) {
        const issue = result.error.issues[0];
        return {
            success: false,
            message: `Invalid query: ${issue.path.join('.') || 'parameter'} — ${issue.message}`,
        };
    }
    return { success: true, data: result.data };
}

/**
 * @param {string} enemy - Faction slug.
 * @returns {number} faction id.
 */
export function enemyIdFromSlug(enemy) {
    return FACTION_INDEX[enemy];
}

function progressRatio(points, pointsMax) {
    if (!pointsMax || pointsMax <= 0) return 0;
    return Math.round((points / pointsMax) * 10000) / 10000;
}

function toIso(unixSeconds) {
    return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Project one normalized row into the public item shape.
 *
 * @param {{ enemy: number, points: number, time: number, bucket?: number }} row - A normalized status/history row.
 * @param {number} pointsMax - Points required for this faction (from h1_season).
 * @param {number} players - Player count (from h1_statistic).
 * @param {boolean} includeBucket - Whether to include the `bucket` field (history).
 */
function projectItem(row, pointsMax, players, includeBucket) {
    /** @type {Record<string, unknown>} */
    const item = {
        enemy: FACTION_SLUG_BY_ID[row.enemy],
        enemyId: row.enemy,
        points: row.points,
        pointsMax,
        progress: progressRatio(row.points, pointsMax),
        players,
        updatedAt: toIso(row.time),
    };
    if (includeBucket) item.bucket = row.bucket;
    return item;
}

/**
 * Project the latest-bucket-per-faction campaign rows (from `getCampaign`,
 * which already merges points_max + players) into the `mode=latest` response.
 *
 * @param {Array<{ enemy: number, points: number, points_max: number, players: number, time: number, bucket: number }>} statusRows - Latest merged campaign rows.
 * @param {number} season - Resolved season number.
 * @param {number} limit - Page limit (echoed back).
 * @param {number} [enemyId] - Optional faction filter.
 */
export function projectLatest(statusRows, season, limit, enemyId) {
    const rows = statusRows
        .filter((r) => enemyId === undefined || r.enemy === enemyId)
        .sort((a, b) => a.enemy - b.enemy);
    const items = rows.map((r) => projectItem(r, r.points_max, r.players, false));
    const bucket = rows.reduce((max, r) => Math.max(max, r.bucket), 0);
    return {
        season,
        mode: 'latest',
        bucket,
        items,
        page: { limit, nextCursor: null },
    };
}

/**
 * Project a paginated page of history rows into the `mode=history` response.
 * `rows` may contain up to `limit + 1` rows; the extra one signals a next page.
 *
 * @param {Array<{ enemy: number, points: number, time: number, bucket: number }>} rows - History rows (up to limit + 1).
 * @param {Record<number, number>} pointsMaxByEnemy - Faction id → points_max.
 * @param {Record<string, number>} playersByKey - `${bucket}:${enemy}` → players.
 * @param {number} season - Resolved season number.
 * @param {number} limit - Requested page size.
 */
export function projectHistory(rows, pointsMaxByEnemy, playersByKey, season, limit) {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map((r) =>
        projectItem(
            r,
            pointsMaxByEnemy[r.enemy] ?? 0,
            playersByKey[`${r.bucket}:${r.enemy}`] ?? 0,
            true,
        ),
    );
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.bucket, last.enemy) : null;
    return {
        season,
        mode: 'history',
        items,
        page: { limit, nextCursor },
    };
}

/**
 * @param {number} bucket - Bucket window start (unix seconds).
 * @param {number} enemy - Faction id.
 * @returns {string} opaque cursor.
 */
export function encodeCursor(bucket, enemy) {
    return Buffer.from(`${bucket}:${enemy}`).toString('base64url');
}

/**
 * @param {string} cursor - Opaque cursor from a prior page.
 * @returns {{ bucket: number, enemy: number } | null} decoded position, or null if malformed.
 */
export function decodeCursor(cursor) {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [b, e] = decoded.split(':');
    const bucket = Number(b);
    const enemy = Number(e);
    if (!Number.isInteger(bucket) || !Number.isInteger(enemy)) return null;
    return { bucket, enemy };
}
