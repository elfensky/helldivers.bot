'use server';
import db from '@/db/db';
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import { groupStatusByBucket } from '@/shared/utils/bucketing.mjs';

/**
 * Reconstruct the `get_campaign_status` wire format from the normalized
 * tables (h1_season + h1_status + h1_statistic + h1_event). Uses the latest
 * season with data. Returns `null` when no season has been populated yet.
 *
 * Partial loss of fidelity vs the HD1 wire format: the 4 event-count
 * fields on each statistics[] entry (defend_events, successful_defend_events,
 * attack_events, successful_attack_events) are omitted — they are derivable
 * from h1_event with COUNT(*) WHERE type=... AND status=... AND season=X.
 *
 * @returns {Promise<object | null>}
 */
export async function reconstructCampaignStatus() {
    // Latest season that has been populated.
    const seasonRow = await db.h1_season.findFirst({
        where: { last_updated: { not: null } },
        orderBy: { season: 'desc' },
        select: {
            season: true,
            introduction_order: true,
            points_max: true,
            season_duration: true,
        },
    });
    if (!seasonRow) return null;

    const targetSeason = seasonRow.season;

    // latestStatus / latestStats / activeEvents are mutually independent —
    // each keyed only on targetSeason — so they run in parallel, collapsing
    // three sequential round-trips into one. (The DISTINCT ON $queryRaw is
    // used like getCampaign.mjs; Prisma can't express DISTINCT ON natively.)
    const [latestStatus, latestStats, activeEvents] = await Promise.all([
        db.$queryRaw`
            SELECT DISTINCT ON (enemy) *
            FROM h1_status
            WHERE season = ${targetSeason}
            ORDER BY enemy ASC, bucket DESC
        `,
        db.$queryRaw`
            SELECT DISTINCT ON (enemy) *
            FROM h1_statistic
            WHERE season = ${targetSeason}
            ORDER BY enemy ASC, bucket DESC
        `,
        db.h1_event.findMany({
            where: { season: targetSeason, status: EVENT_STATUS.ACTIVE },
            orderBy: [{ start_time: 'asc' }, { event_id: 'asc' }],
        }),
    ]);

    const statByEnemy = new Map(latestStats.map((r) => [r.enemy, r]));

    const latestTime = Math.max(
        0,
        ...latestStatus.map((r) => r.time),
        ...latestStats.map((r) => r.time),
    );

    return {
        time: latestTime,
        error_code: 0,
        campaign_status: latestStatus.map((r) => ({
            enemy: r.enemy,
            points: r.points,
            points_taken: r.points_taken,
            points_max: seasonRow.points_max?.[r.enemy] ?? 0,
            status: r.status,
            introduction_order: seasonRow.introduction_order?.[r.enemy] ?? 0,
        })),
        statistics: [0, 1, 2].map((enemy) => {
            const s = statByEnemy.get(enemy);
            return {
                enemy,
                season_duration: seasonRow.season_duration ?? 0,
                players: s?.players ?? 0,
                total_unique_players: s?.total_unique_players ?? 0,
                missions: s?.missions ?? 0,
                successful_missions: s?.successful_missions ?? 0,
                total_mission_difficulty: s?.total_mission_difficulty ?? 0,
                completed_planets: s?.completed_planets ?? 0,
                // 4 fields intentionally omitted (derivable from h1_event):
                //   defend_events, successful_defend_events,
                //   attack_events, successful_attack_events
                kills: s?.kills != null ? Number(s.kills) : 0,
                deaths: s?.deaths != null ? Number(s.deaths) : 0,
                accidentals: s?.accidentals != null ? Number(s.accidentals) : 0,
                shots: s?.shots != null ? Number(s.shots) : 0,
                hits: s?.hits != null ? Number(s.hits) : 0,
            };
        }),
        defend_event: activeEvents.find((e) => e.type === EVENT_TYPE.DEFEND) ?? null,
        attack_events: activeEvents.filter((e) => e.type === EVENT_TYPE.ATTACK),
        introduction_order: seasonRow.introduction_order ?? [],
        points_max: seasonRow.points_max ?? [],
    };
}

/**
 * Reconstruct the `get_snapshots` wire format for a given season from the
 * normalized tables (h1_season + h1_status + h1_event). Returns `null` when
 * the season has no h1_season row yet (caller may then trigger an on-demand
 * `updateSeason()` fetch from the official API).
 *
 * Sparse buckets (missing one or more factions) are filtered out of the
 * snapshot array for consumer safety — matches `getCampaign.mjs`'s behavior.
 *
 * @param {number} season - Season number to reconstruct.
 * @returns {Promise<object | null>}
 */
export async function reconstructSnapshots(season) {
    if (!season) return null;

    const seasonRow = await db.h1_season.findUnique({
        where: { season },
        select: {
            season: true,
            introduction_order: true,
            points_max: true,
        },
    });
    if (!seasonRow) return null;

    // allStatus / allEvents are independent — run in parallel to collapse
    // two sequential round-trips into one.
    const [allStatus, allEvents] = await Promise.all([
        db.h1_status.findMany({
            where: { season },
            orderBy: [{ bucket: 'asc' }, { enemy: 'asc' }],
        }),
        db.h1_event.findMany({
            where: { season },
            orderBy: [{ start_time: 'asc' }, { event_id: 'asc' }],
        }),
    ]);

    const snapshots = groupStatusByBucket(allStatus).map(({ time, factions }) => ({
        season,
        time,
        data: JSON.stringify(factions),
    }));

    return {
        time: Math.floor(Date.now() / 1000),
        error_code: 0,
        introduction_order: seasonRow.introduction_order ?? [],
        points_max: seasonRow.points_max ?? [],
        snapshots,
        defend_events: allEvents.filter((e) => e.type === EVENT_TYPE.DEFEND),
        attack_events: allEvents.filter((e) => e.type === EVENT_TYPE.ATTACK),
    };
}
