'use server';
import db from '@/db/db';

/**
 * Returns the total online player count across factions from ~24 hours
 * ago for the given season — used as the baseline for the "vs 24h ago"
 * subtitle on the HELLDIVERS_ONLINE card.
 *
 * Finds the latest `h1_statistic` bucket at or before `now - 86400`, then
 * sums `players` across the three faction rows at that bucket. Returns
 * null if the season is too young to have a 24h-ago bucket.
 */
export async function getPlayers24hAgo(season) {
    const targetTimestamp = Math.floor(Date.now() / 1000) - 86400;

    const rows = await db.$queryRaw`
        SELECT COALESCE(SUM(players), 0)::int AS total
        FROM h1_statistic
        WHERE season = ${season}
          AND bucket = (
            SELECT MAX(bucket) FROM h1_statistic
            WHERE season = ${season} AND bucket <= ${targetTimestamp}
          )
    `;

    const total = rows[0]?.total ?? 0;
    return total > 0 ? total : null;
}
