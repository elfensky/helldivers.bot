import { z } from 'zod';
import { FACTION_SLUG_BY_ID, FACTION_INDEX } from '@/shared/enums/factions.mjs';
import { encodeCursor } from '@/shared/utils/api/cursor.mjs';

/**
 * Query-parameter schema for `GET /api/v1/h1/stats`.
 * `season` accepts `current` (default) or a positive integer. Cross-season
 * totals are served by the frontend directly (getCrossSeasonStats); a public
 * `season=all` would need a season-aware cursor and has no consumer yet.
 */
const querySchema = z.object({
    season: z
        .union([z.literal('current'), z.coerce.number().int().positive()])
        .default('current'),
    enemy: z.enum(['bugs', 'cyborgs', 'illuminate']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    cursor: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Parse + validate the stats endpoint's query string.
 *
 * @param {URLSearchParams} searchParams - The request's query parameters.
 * @returns {{ success: true, data: import('zod').infer<typeof querySchema> } | { success: false, message: string }}
 */
export function parseStatsQuery(searchParams) {
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

/**
 * @param {bigint | number} value - A possibly-BigInt count.
 * @returns {number} a JSON-safe number.
 */
function toNumber(value) {
    return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Project a paginated page of h1_statistic rows into the `mode` response.
 * `rows` may contain up to `limit + 1` rows; the extra one signals a next page.
 *
 * @param {Array<{ enemy: number, bucket: number, players: number, missions: number, successful_missions: number, kills: bigint|number, deaths: bigint|number, shots: bigint|number, hits: bigint|number }>} rows - Statistic rows (up to limit + 1).
 * @param {number} season - Resolved season number.
 * @param {number} limit - Requested page size.
 * @param {number} bucketSize - Configured bucket width in seconds.
 */
export function projectStats(rows, season, limit, bucketSize) {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = page.map((r) => ({
        bucket: r.bucket,
        enemy: FACTION_SLUG_BY_ID[r.enemy],
        enemyId: r.enemy,
        season,
        missionsWon: r.successful_missions,
        missionsLost: Math.max(0, r.missions - r.successful_missions),
        kills: toNumber(r.kills),
        deaths: toNumber(r.deaths),
        shots: toNumber(r.shots),
        hits: toNumber(r.hits),
        players: r.players,
    }));
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.bucket, last.enemy) : null;
    return { season, bucketSize, items, page: { limit, nextCursor } };
}
