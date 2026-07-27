import db from '@/db/db';

/**
 * @param {number | null} seasonInput - Season number, or null for the latest season.
 * @returns {Promise<number | null>} resolved season number, or null if none exists.
 */
async function findSeasonNumber(seasonInput) {
    // An unstamped row means a partial import — treat it as a miss rather than
    // serving an incomplete season (see getCampaign._findSeason).
    const where =
        seasonInput == null ?
            { last_updated: { not: null } }
        :   { season: seasonInput, last_updated: { not: null } };
    const orderBy = seasonInput == null ? { season: 'desc' } : undefined;
    const row = await db.h1_season.findFirst({
        ...(orderBy && { orderBy }),
        where,
        select: { season: true },
    });
    return row?.season ?? null;
}

/**
 * @typedef {object} StatsQueryOpts
 * @property {number} [enemyId] - Optional faction filter (0/1/2).
 * @property {number | null} fromUnix - Lower bucket bound (unix seconds), or null.
 * @property {number | null} toUnix - Upper bucket bound (unix seconds), or null.
 * @property {number} limit - Page size (the query fetches limit + 1 to detect a next page).
 * @property {{ bucket: number, enemy: number } | null} cursorPos - Decoded keyset cursor, or null.
 * @property {'asc' | 'desc'} order - Bucket order.
 */

/**
 * Fetch a cursor-paginated page of statistics history (h1_statistic) for a season.
 * Keyset pagination on (bucket, enemy). Returns up to `limit + 1` rows so the
 * caller can detect a next page, or null when the season doesn't exist.
 *
 * @param {number | null} seasonInput - Season number, or null for the latest season.
 * @param {StatsQueryOpts} opts - Filter, pagination, and ordering options.
 * @returns {Promise<{ season: number, rows: Array<{ enemy: number, bucket: number, players: number, missions: number, successful_missions: number, kills: bigint, deaths: bigint, shots: bigint, hits: bigint }> } | null>}
 */
export async function getStats(seasonInput, opts) {
    const season = await findSeasonNumber(seasonInput);
    if (season == null) return null;
    const { enemyId, fromUnix, toUnix, limit, cursorPos, order } = opts;

    /** @type {Array<Record<string, unknown>>} */
    const and = [];
    if (fromUnix != null) and.push({ bucket: { gte: fromUnix } });
    if (toUnix != null) and.push({ bucket: { lte: toUnix } });
    if (cursorPos) {
        const bucketBeyond =
            order === 'desc' ? { lt: cursorPos.bucket } : { gt: cursorPos.bucket };
        and.push({
            OR: [
                { bucket: bucketBeyond },
                { bucket: cursorPos.bucket, enemy: { gt: cursorPos.enemy } },
            ],
        });
    }

    const rows = await db.h1_statistic.findMany({
        where: {
            season,
            ...(enemyId !== undefined ? { enemy: enemyId } : {}),
            ...(and.length ? { AND: and } : {}),
        },
        orderBy: [{ bucket: order }, { enemy: 'asc' }],
        take: limit + 1,
        select: {
            enemy: true,
            bucket: true,
            players: true,
            missions: true,
            successful_missions: true,
            kills: true,
            deaths: true,
            shots: true,
            hits: true,
        },
    });

    return { season, rows };
}
