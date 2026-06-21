import db from '@/db/db';

/**
 * @returns {Promise<number | null>} the latest populated season number, or null.
 */
async function getCurrentSeasonNumber() {
    const row = await db.h1_season.findFirst({
        where: { last_updated: { not: null } },
        orderBy: { season: 'desc' },
        select: { season: true },
    });
    return row?.season ?? null;
}

/**
 * Fetch season-metadata rows for the requested seasons (a `'current'` entry
 * resolves to the latest populated season). Missing seasons are simply omitted
 * (this endpoint does not backfill from the upstream API — see #438 follow-up).
 *
 * @param {Array<number | 'current'>} requested - Requested seasons.
 * @returns {Promise<{ current: number, rows: Array<{ season: number, last_updated: Date | null, introduction_order: number[], points_max: number[], season_duration: number }> } | null>}
 */
export async function getSeasons(requested) {
    const current = await getCurrentSeasonNumber();
    if (current == null) return null;

    const numbers = [...new Set(requested.map((r) => (r === 'current' ? current : r)))];
    const rows = await db.h1_season.findMany({
        where: { season: { in: numbers } },
        select: {
            season: true,
            last_updated: true,
            introduction_order: true,
            points_max: true,
            season_duration: true,
        },
        orderBy: { season: 'asc' },
    });
    return { current, rows };
}
