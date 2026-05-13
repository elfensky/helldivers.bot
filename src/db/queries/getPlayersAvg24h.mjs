'use server';
import db from '@/db/db';

/**
 * Returns per-faction average player counts over the last 24 hours for
 * the given season — used as the baseline for the "LAST 24H" delta
 * subtitle on the HELLDIVERS_ONLINE / ONLINE stat cards.
 *
 * Return shape: `{ global, bugs, cyborgs, illuminate }` where each
 * value is the mean of `h1_statistic.players` across buckets in the
 * last 24h window, or `null` for the whole object if the season has
 * no data in that window (e.g. too young for any baseline yet).
 *
 * - Per-faction averages: `AVG(players) GROUP BY enemy`.
 * - Global: `AVG` of per-bucket SUMs across factions — per-front
 *   player counts are disjoint (a helldiver engages one faction at a
 *   time), so summing within a bucket gives the fleet total. Using
 *   per-bucket SUM → AVG is more robust to sparse buckets than summing
 *   per-faction averages would be.
 */
export async function getPlayersAvg24h(season) {
    const since = Math.floor(Date.now() / 1000) - 86400;

    const perFaction = await db.$queryRaw`
        SELECT enemy, AVG(players)::int AS avg_players
        FROM h1_statistic
        WHERE season = ${season} AND bucket >= ${since}
        GROUP BY enemy
    `;

    if (perFaction.length === 0) return null;

    const global = await db.$queryRaw`
        SELECT AVG(bucket_total)::int AS avg_total
        FROM (
            SELECT SUM(players) AS bucket_total
            FROM h1_statistic
            WHERE season = ${season} AND bucket >= ${since}
            GROUP BY bucket
        ) t
    `;

    const byEnemy = new Map(perFaction.map((r) => [r.enemy, r.avg_players]));

    return {
        global: global[0]?.avg_total ?? null,
        bugs: byEnemy.get(0) ?? null,
        cyborgs: byEnemy.get(1) ?? null,
        illuminate: byEnemy.get(2) ?? null,
    };
}
