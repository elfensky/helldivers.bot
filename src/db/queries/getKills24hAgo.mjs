'use server';
import db from '@/db/db';

const FACTION_LABELS = { 0: 'bugs', 1: 'cyborgs', 2: 'illuminate' };

/**
 * Returns the cumulative kill counts from ~24 hours ago for the given
 * season, both globally and per-faction — used as the baseline for the
 * "+N LAST 24H" subtitle on the ENEMIES_KILLED stat cards.
 *
 * Unlike `getPlayersAvg24h`, which averages over the window, kills are
 * a monotonically increasing counter — we want the *point-in-time*
 * value at ~24h ago so `current - baseline` gives kills over the last
 * 24h exactly.
 *
 * Shape: `{ global, bugs, cyborgs, illuminate }` where `global` is the
 * sum across factions. Returns `null` if the season is too young to
 * have a 24h-ago bucket.
 */
export async function getKills24hAgo(season) {
    const targetTimestamp = Math.floor(Date.now() / 1000) - 86400;

    const rows = await db.$queryRaw`
        SELECT enemy, kills
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
        // kills is stored as BigInt; cast for JS arithmetic + formatNumber.
        const kills = Number(row.kills);
        const label = FACTION_LABELS[row.enemy];
        if (label) result[label] = kills;
        result.global += kills;
    }
    return result;
}
