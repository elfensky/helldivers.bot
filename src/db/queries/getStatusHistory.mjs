import db from '@/db/db';

/**
 * Resolve a season row (latest populated season when `seasonInput` is null).
 *
 * @param {number | null} seasonInput - Season number, or null for the latest season.
 * @returns {Promise<{ season: number, points_max: number[] } | null>}
 */
async function findSeasonRow(seasonInput) {
    // An unstamped row means a partial import — treat it as a miss rather than
    // serving an incomplete season (see getCampaign._findSeason).
    const where =
        seasonInput == null ?
            { last_updated: { not: null } }
        :   { season: seasonInput, last_updated: { not: null } };
    const orderBy = seasonInput == null ? { season: 'desc' } : undefined;
    return db.h1_season.findFirst({
        ...(orderBy && { orderBy }),
        where,
        select: { season: true, points_max: true },
    });
}

/**
 * @typedef {object} StatusHistoryOpts
 * @property {number} [enemyId] - Optional faction filter (0/1/2).
 * @property {number | null} fromUnix - Lower bucket bound (unix seconds), or null.
 * @property {number | null} toUnix - Upper bucket bound (unix seconds), or null.
 * @property {number} limit - Page size (the query fetches limit + 1 to detect a next page).
 * @property {{ bucket: number, enemy: number } | null} cursorPos - Decoded keyset cursor, or null.
 * @property {'asc' | 'desc'} order - Bucket order.
 */

/**
 * Fetch a cursor-paginated page of campaign-status history for a season, plus the
 * per-(bucket,enemy) player counts (which live on h1_statistic) and the season's
 * points_max array. Keyset pagination on (bucket, enemy) avoids ever returning a
 * full season in one response.
 *
 * Returns up to `limit + 1` rows so the caller can detect a next page. Returns
 * null when the season doesn't exist.
 *
 * @param {number | null} seasonInput - Season number, or null for the latest season.
 * @param {StatusHistoryOpts} opts - Filter, pagination, and ordering options.
 * @returns {Promise<{ season: number, rows: Array<{ enemy: number, points: number, time: number, bucket: number }>, pointsMaxByEnemy: Record<number, number>, playersByKey: Record<string, number> } | null>}
 */
export async function getStatusHistory(seasonInput, opts) {
    const seasonRow = await findSeasonRow(seasonInput);
    if (!seasonRow) return null;
    const season = seasonRow.season;
    const { enemyId, fromUnix, toUnix, limit, cursorPos, order } = opts;

    /** @type {Array<Record<string, unknown>>} */
    const and = [];
    if (fromUnix != null) and.push({ bucket: { gte: fromUnix } });
    if (toUnix != null) and.push({ bucket: { lte: toUnix } });
    if (cursorPos) {
        // Keyset: continue strictly after the cursor in (bucket <order>, enemy asc).
        const bucketBeyond =
            order === 'desc' ? { lt: cursorPos.bucket } : { gt: cursorPos.bucket };
        and.push({
            OR: [
                { bucket: bucketBeyond },
                { bucket: cursorPos.bucket, enemy: { gt: cursorPos.enemy } },
            ],
        });
    }

    const rows = await db.h1_status.findMany({
        where: {
            season,
            ...(enemyId !== undefined ? { enemy: enemyId } : {}),
            ...(and.length ? { AND: and } : {}),
        },
        orderBy: [{ bucket: order }, { enemy: 'asc' }],
        take: limit + 1,
        select: { enemy: true, points: true, time: true, bucket: true },
    });

    // Players live on h1_statistic; fetch only for the buckets in this page.
    const buckets = [...new Set(rows.map((r) => r.bucket))];
    const statRows =
        buckets.length > 0 ?
            await db.h1_statistic.findMany({
                where: {
                    season,
                    bucket: { in: buckets },
                    ...(enemyId !== undefined ? { enemy: enemyId } : {}),
                },
                select: { bucket: true, enemy: true, players: true },
            })
        :   [];

    const playersByKey = Object.fromEntries(
        statRows.map((s) => [`${s.bucket}:${s.enemy}`, s.players]),
    );
    const pointsMaxByEnemy = Object.fromEntries(
        (seasonRow.points_max ?? []).map((p, i) => [i, p]),
    );

    return { season, rows, pointsMaxByEnemy, playersByKey };
}
