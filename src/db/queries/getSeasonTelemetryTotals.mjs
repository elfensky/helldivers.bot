import { cache } from 'react';
import db from '@/db/db';

/**
 * Sum one season's telemetry. `h1_statistic` fields are monotonic cumulative
 * counters, so the season total is the LATEST bucket per enemy summed across
 * the three factions (mirrors getCrossSeasonStats.mjs). Returns `null` for
 * seasons that predate telemetry collection (no rows). BigInt fields
 * (kills/accidentals) are narrowed to Number for the server→client boundary.
 *
 * @param {number} season
 * @returns {Promise<{ kills:number, missions:number, accidentals:number, completed_planets:number, total_unique_players:number } | null>}
 */
export const getSeasonTelemetryTotals = cache(
    async function getSeasonTelemetryTotals(season) {
        'use server';

        const rows = await db.$queryRaw`
        SELECT
          sum(kills)                       AS kills,
          sum(accidentals)                 AS accidentals,
          sum(missions)::int               AS missions,
          sum(completed_planets)::int      AS completed_planets,
          sum(total_unique_players)::int   AS total_unique_players
        FROM (
          SELECT DISTINCT ON (enemy) *
          FROM h1_statistic
          WHERE season = ${season}
          ORDER BY enemy, bucket DESC
        ) latest
    `;

        const r = rows?.[0];
        // No telemetry rows ⇒ Postgres still returns one row of NULL sums.
        if (!r || r.kills == null) return null;

        return {
            kills: Number(r.kills),
            accidentals: Number(r.accidentals),
            missions: Number(r.missions),
            completed_planets: Number(r.completed_planets),
            total_unique_players: Number(r.total_unique_players),
        };
    },
);
