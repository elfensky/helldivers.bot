import { cache } from 'react';
import db from '@/db/db';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';

/**
 * Aggregate cross-season statistics across the full war history — used by
 * the `/stats` page.
 *
 * Returns `{ perSeason, factionTotals }`:
 *
 * - `perSeason` — one row per season in `h1_season` (sorted ascending) with
 *   event-derived aggregates (counts, win counts, average event duration),
 *   the season duration from `h1_season`, a derived war outcome
 *   (victory/defeat/unknown) plus attribution faction, and per-season
 *   telemetry sums (latest-bucket-per-enemy summed). Telemetry fields are
 *   zero for seasons that predate `h1_statistic` collection — callers should
 *   treat them as future-proof, not as meaningful zero values.
 *
 * - `factionTotals` — three rows (one per enemy) with defend/attack win
 *   counts aggregated across every war, used by the Faction Threat Ranking
 *   chart.
 *
 * The outcome is derived by feeding a slim per-season slice (final faction
 * states + relevant events + a synthetic "any-all-3-defeated snapshot" flag)
 * to the existing `getWarOutcome` so the algorithm stays in one place.
 *
 * @returns {Promise<{ perSeason: Array<object>, factionTotals: Array<object> }>}
 */
export const getCrossSeasonStats = cache(async function getCrossSeasonStats() {
    'use server';

    // 1. Per-season event aggregates.
    const eventAggs = await db.$queryRaw`
        SELECT season,
          count(*)::int                                                     AS events,
          count(*) FILTER (WHERE type = 'defend')::int                       AS defends,
          count(*) FILTER (WHERE type = 'defend' AND status = 'success')::int AS defend_wins,
          count(*) FILTER (WHERE type = 'attack')::int                       AS attacks,
          count(*) FILTER (WHERE type = 'attack' AND status = 'success')::int AS attack_wins,
          avg(end_time - start_time) FILTER (WHERE end_time > start_time)::float
                                                                            AS avg_event_duration
        FROM h1_event
        GROUP BY season
        ORDER BY season ASC
    `;

    // 2. Per-faction totals across every war (Threat Ranking).
    const factionTotalsRaw = await db.$queryRaw`
        SELECT enemy,
          count(*) FILTER (WHERE type = 'defend')::int                       AS defends,
          count(*) FILTER (WHERE type = 'defend' AND status = 'success')::int AS defend_wins,
          count(*) FILTER (WHERE type = 'attack')::int                       AS attacks,
          count(*) FILTER (WHERE type = 'attack' AND status = 'success')::int AS attack_wins
        FROM h1_event
        GROUP BY enemy
        ORDER BY enemy ASC
    `;

    // 3. h1_season rows for duration.
    const seasons = await db.h1_season.findMany({
        select: { season: true, season_duration: true },
        orderBy: { season: 'asc' },
    });

    // 4. Telemetry per season — latest-bucket-per-enemy, summed across factions.
    //    For 156 of 157 seasons this returns no row; the merge defaults to 0.
    const telemetry = await db.$queryRaw`
        SELECT season,
          sum(kills)                            AS kills,
          sum(deaths)                           AS deaths,
          sum(accidentals)                      AS accidentals,
          sum(shots)                            AS shots,
          sum(hits)                             AS hits,
          sum(missions)::int                    AS missions,
          sum(successful_missions)::int         AS successful_missions,
          sum(total_mission_difficulty)::int    AS total_mission_difficulty,
          sum(completed_planets)::int           AS completed_planets
        FROM (
          SELECT DISTINCT ON (season, enemy) *
          FROM h1_statistic
          ORDER BY season, enemy, bucket DESC
        ) latest
        GROUP BY season
        ORDER BY season ASC
    `;

    // 5. Outcome-derivation inputs.
    //    All events (~30 per season × 157 seasons ≈ 5k rows) grouped by season
    //    in JS, then each season's slice is fed to getWarOutcome alongside its
    //    final faction states and a synthetic any-all-3-defeated snapshot flag.
    const allEvents = await db.h1_event.findMany({
        select: {
            season: true,
            type: true,
            status: true,
            region: true,
            enemy: true,
            end_time: true,
            start_time: true,
        },
    });

    const finalStates = await db.$queryRaw`
        SELECT DISTINCT ON (season, enemy) season, enemy, status, points, points_taken
        FROM h1_status
        ORDER BY season, enemy, bucket DESC
    `;

    const defeatedSeasonRows = await db.$queryRaw`
        SELECT season FROM (
          SELECT season, bucket, count(*) FILTER (WHERE status = 'defeated') AS defeated_count
          FROM h1_status
          GROUP BY season, bucket
        ) sub
        WHERE defeated_count = 3
        GROUP BY season
    `;

    // ── Group inputs by season for the per-season build. ────────────────
    const eventAggBySeason = new Map(eventAggs.map((r) => [r.season, r]));
    const telemetryBySeason = new Map(telemetry.map((r) => [r.season, r]));

    const eventsBySeason = new Map();
    for (const e of allEvents) {
        const arr = eventsBySeason.get(e.season);
        if (arr) arr.push(e);
        else eventsBySeason.set(e.season, [e]);
    }
    const statesBySeason = new Map();
    for (const s of finalStates) {
        const arr = statesBySeason.get(s.season);
        if (arr) arr.push(s);
        else statesBySeason.set(s.season, [s]);
    }
    const allDefeatedSet = new Set(defeatedSeasonRows.map((r) => r.season));

    // A one-entry snapshots array is enough to fire getWarOutcome's
    // anySnapshotDefeated signal — we don't need to ship every snapshot.
    const ALL_DEFEATED_SNAPSHOT = [
        {
            data: [
                { status: 'defeated' },
                { status: 'defeated' },
                { status: 'defeated' },
            ],
        },
    ];

    const perSeason = seasons.map(({ season, season_duration }) => {
        const agg = eventAggBySeason.get(season);
        const tele = telemetryBySeason.get(season);

        const outcomeResult = getWarOutcome({
            status: statesBySeason.get(season) ?? [],
            events: eventsBySeason.get(season) ?? [],
            snapshots: allDefeatedSet.has(season) ? ALL_DEFEATED_SNAPSHOT : [],
        });

        return {
            season,
            season_duration: Number(season_duration) || 0,
            events: agg?.events ?? 0,
            defends: agg?.defends ?? 0,
            defend_wins: agg?.defend_wins ?? 0,
            attacks: agg?.attacks ?? 0,
            attack_wins: agg?.attack_wins ?? 0,
            avg_event_duration:
                agg?.avg_event_duration != null ? Number(agg.avg_event_duration) : null,
            outcome: outcomeResult?.outcome ?? 'unknown',
            outcome_faction: outcomeResult?.faction ?? null,
            // Telemetry — present only where the bot has polled live; future-
            // proof for the deferred Friendly Fire / Accuracy / Shots-per-
            // Planet components that will live on this page.
            kills: tele?.kills ?? 0n,
            deaths: tele?.deaths ?? 0n,
            accidentals: tele?.accidentals ?? 0n,
            shots: tele?.shots ?? 0n,
            hits: tele?.hits ?? 0n,
            missions: tele?.missions ?? 0,
            successful_missions: tele?.successful_missions ?? 0,
            total_mission_difficulty: tele?.total_mission_difficulty ?? 0,
            completed_planets: tele?.completed_planets ?? 0,
        };
    });

    const factionTotals = factionTotalsRaw.map((r) => ({
        enemy: Number(r.enemy),
        defends: Number(r.defends),
        defend_wins: Number(r.defend_wins),
        attacks: Number(r.attacks),
        attack_wins: Number(r.attack_wins),
    }));

    return { perSeason, factionTotals };
});
