'use server';
import db from '@/db/db';

const FACTION_LABELS = { 0: 'bugs', 1: 'cyborgs', 2: 'illuminate' };

/**
 * Returns cumulative kill counts at two historical reference points —
 * ~24h ago and ~48h ago — per faction and globally, for the given season.
 *
 * The ENEMIES_KILLED stat card combines these with the live kill total to
 * derive two consecutive 24h kill volumes — the last 24h vs the 24h before
 * it — and show whether the killing pace is rising or falling.
 *
 * Kills are a monotonically increasing counter, so each reference point is
 * the *point-in-time* value at the bucket nearest (but not after) its
 * target timestamp: `current - ago24h` is then exactly the last 24h, and
 * `ago24h - ago48h` the 24h before that.
 *
 * Shape: `{ global, bugs, cyborgs, illuminate }`, each `{ ago24h, ago48h }`
 * where `global` sums across factions. `ago48h` is `null` per faction when
 * there's no 48h-ago bucket yet (season 24–48h old, so the pace can't be
 * compared). Returns `null` for the whole object when there's no 24h-ago
 * bucket at all (season younger than 24h).
 */
export async function getKillsTrend(season) {
    const now = Math.floor(Date.now() / 1000);

    // Cumulative kill counts at the bucket nearest (but not after) a target
    // timestamp. Resolves to [] when the season has no bucket that old yet.
    const snapshotAt = (targetTimestamp) => db.$queryRaw`
        SELECT enemy, kills
        FROM h1_statistic
        WHERE season = ${season}
          AND bucket = (
            SELECT MAX(bucket) FROM h1_statistic
            WHERE season = ${season} AND bucket <= ${targetTimestamp}
          )
    `;

    const [rows24h, rows48h] = await Promise.all([
        snapshotAt(now - 86400),
        snapshotAt(now - 172800),
    ]);

    if (rows24h.length === 0) return null;

    // Fold per-enemy rows into { global, bugs, cyborgs, illuminate }. kills is
    // stored as BigInt; cast for JS arithmetic + formatNumber downstream.
    const fold = (rows) => {
        const totals = { global: 0 };
        for (const row of rows) {
            const kills = Number(row.kills);
            const label = FACTION_LABELS[row.enemy];
            if (label) totals[label] = kills;
            totals.global += kills;
        }
        return totals;
    };

    const at24h = fold(rows24h);
    const at48h = rows48h.length > 0 ? fold(rows48h) : null;

    const result = {};
    for (const faction of ['global', 'bugs', 'cyborgs', 'illuminate']) {
        result[faction] = {
            ago24h: at24h[faction] ?? null,
            ago48h: at48h?.[faction] ?? null,
        };
    }
    return result;
}
