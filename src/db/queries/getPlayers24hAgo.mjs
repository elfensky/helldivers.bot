'use server';
import db from '@/db/db';

const FACTION_LABELS = { 0: 'bugs', 1: 'cyborgs', 2: 'illuminate' };

/**
 * Returns the online player counts from ~24 hours ago for the given
 * season, both globally and per-faction — used as the baseline for the
 * "vs 24h ago" subtitle on the ONLINE card in both the global and
 * per-faction stat views.
 *
 * Shape: `{ global, bugs, cyborgs, illuminate }` where `global` is the
 * sum across factions. Returns `null` if the season is too young to
 * have a 24h-ago bucket.
 */
export async function getPlayers24hAgo(season) {
    const targetTimestamp = Math.floor(Date.now() / 1000) - 86400;

    const rows = await db.$queryRaw`
        SELECT enemy, players
        FROM h1_statistic
        WHERE season = ${season}
          AND bucket = (
            SELECT MAX(bucket) FROM h1_statistic
            WHERE season = ${season} AND bucket <= ${targetTimestamp}
          )
    `;

    if (rows.length === 0) return null;

    const result = { global: 0 };
    for (const row of rows) {
        const label = FACTION_LABELS[row.enemy];
        if (label) result[label] = row.players;
        result.global += row.players;
    }
    return result;
}
