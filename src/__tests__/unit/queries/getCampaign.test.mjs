import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { getCampaign } from '@/db/queries/getCampaign.mjs';

// getCampaign is wrapped in React's cache(), but in test the mock from
// vitest.setup.mjs handles that transparently.

const mockSeasonRow = {
    season: 5,
    last_updated: new Date('2025-01-01'),
    introduction_order: [0, 1, 2],
    points_max: [500, 600, 700],
    // Per-season scalar (not per-faction). Lives on h1_season and surfaces
    // at the top level of the getCampaign return value.
    season_duration: 7200,
};

const mockLiveRows = [
    { enemy: 0, points: 100, points_taken: 10, status: 'active', bucket: 42 },
    { enemy: 1, points: 200, points_taken: 20, status: 'active', bucket: 42 },
    { enemy: 2, points: 300, points_taken: 30, status: 'active', bucket: 42 },
];

// Latest-bucket-per-faction h1_statistic rows. Merged into data.status[i] by
// getCampaign so consumers (StatGrid, formatNumber, etc.) can read the 11
// per-faction stats fields without a second query.
const mockStatRows = [
    {
        enemy: 0,
        bucket: 42,
        players: 1000,
        total_unique_players: 5000,
        missions: 100,
        successful_missions: 90,
        total_mission_difficulty: 500,
        completed_planets: 1,
        deaths: 1000n,
        kills: 10000n,
        accidentals: 100n,
        shots: 500000n,
        hits: 400000n,
    },
    {
        enemy: 1,
        bucket: 42,
        players: 2000,
        total_unique_players: 6000,
        missions: 200,
        successful_missions: 180,
        total_mission_difficulty: 1000,
        completed_planets: 2,
        deaths: 2000n,
        kills: 20000n,
        accidentals: 200n,
        shots: 1000000n,
        hits: 800000n,
    },
    {
        enemy: 2,
        bucket: 42,
        players: 3000,
        total_unique_players: 7000,
        missions: 300,
        successful_missions: 270,
        total_mission_difficulty: 1500,
        completed_planets: 3,
        deaths: 3000n,
        kills: 30000n,
        accidentals: 300n,
        shots: 1500000n,
        hits: 1200000n,
    },
];

const t0 = new Date('2025-01-01T00:00:00Z');
const t1 = new Date('2025-01-01T01:00:00Z');

const mockStatusHistory = [
    { bucket: 1, enemy: 0, points: 10, points_taken: 1, status: 'active', time: t0 },
    { bucket: 1, enemy: 1, points: 20, points_taken: 2, status: 'active', time: t0 },
    { bucket: 1, enemy: 2, points: 30, points_taken: 3, status: 'active', time: t0 },
    { bucket: 2, enemy: 0, points: 40, points_taken: 4, status: 'active', time: t1 },
    { bucket: 2, enemy: 1, points: 50, points_taken: 5, status: 'active', time: t1 },
    { bucket: 2, enemy: 2, points: 60, points_taken: 6, status: 'active', time: t1 },
];

const mockEvents = [{ type: 'defend', event_id: 1 }];

// Full h1_statistic history for the season — drives data.playerTimeseries.
// Two buckets × three factions. time is unix-seconds; players is the signal.
const mockStatHistory = [
    { bucket: 1, enemy: 0, players: 100, time: 1000 },
    { bucket: 1, enemy: 1, players: 50, time: 1000 },
    { bucket: 1, enemy: 2, players: 25, time: 1000 },
    { bucket: 2, enemy: 0, players: 200, time: 1000 + 86400 },
    { bucket: 2, enemy: 1, players: 60, time: 1000 + 86400 },
    { bucket: 2, enemy: 2, players: 40, time: 1000 + 86400 },
];

function seedDbMocks({
    seasonRow = mockSeasonRow,
    liveRows = mockLiveRows,
    statRows = mockStatRows,
    statusHistory = mockStatusHistory,
    statHistory = mockStatHistory,
    events = mockEvents,
} = {}) {
    vi.mocked(db.h1_season.findFirst).mockResolvedValue(seasonRow);
    // getCampaign makes two $queryRaw calls: first for h1_status (liveRows),
    // then for h1_statistic (statRows). Use mockResolvedValueOnce to feed
    // them in order — without this, both calls would resolve to the same
    // payload and the merge would be nonsense.
    vi.mocked(db.$queryRaw)
        .mockResolvedValueOnce(liveRows)
        .mockResolvedValueOnce(statRows);
    vi.mocked(db.h1_status.findMany).mockResolvedValue(statusHistory);
    // Full h1_statistic history → data.playerTimeseries.
    vi.mocked(db.h1_statistic.findMany).mockResolvedValue(statHistory);
    vi.mocked(db.h1_event.findMany).mockResolvedValue(events);
}

describe('getCampaign', () => {
    test('queries latest season when season is null', async () => {
        seedDbMocks();

        const result = await getCampaign(null);

        expect(result).not.toBeNull();
        expect(result.season).toBe(5);
        expect(db.h1_season.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { last_updated: { not: null } },
                orderBy: { season: 'desc' },
            }),
        );
    });

    test('queries latest season when no argument provided', async () => {
        seedDbMocks();

        const result = await getCampaign();

        expect(result).not.toBeNull();
        expect(result.season).toBe(5);
        expect(db.h1_season.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { last_updated: { not: null } },
                orderBy: { season: 'desc' },
            }),
        );
    });

    test('queries specific season when season is provided', async () => {
        seedDbMocks();

        const result = await getCampaign(3);

        expect(result).not.toBeNull();
        const callArg = db.h1_season.findFirst.mock.calls[0][0];
        expect(callArg.where).toEqual({ season: 3 });
        expect(callArg.orderBy).toBeUndefined();
    });

    test('selects introduction_order / points_max / season_duration from h1_season', async () => {
        seedDbMocks();

        await getCampaign();

        const callArg = db.h1_season.findFirst.mock.calls[0][0];
        expect(callArg.select).toEqual({
            season: true,
            last_updated: true,
            introduction_order: true,
            points_max: true,
            season_duration: true,
        });
    });

    test('returns public-shape with status/snapshots/events/introduction_order/points_max', async () => {
        seedDbMocks();

        const result = await getCampaign();

        expect(result).toMatchObject({
            season: 5,
            last_updated: mockSeasonRow.last_updated,
            // Per-season scalar surfaced at the top level (not per-faction).
            season_duration: 7200,
            introduction_order: { order: [0, 1, 2] },
            points_max: { points: [500, 600, 700] },
            events: mockEvents,
        });
        // data.status must carry all fields consumers historically read from
        // the original h1_live row: campaign progression (from h1_status) +
        // points_max / introduction_order (from h1_season arrays) + 11
        // per-faction stats fields (from h1_statistic). season_duration and
        // the 4 event-count fields are explicitly NOT present anymore.
        expect(result.status).toHaveLength(3);
        expect(result.status[0]).toMatchObject({
            enemy: 0,
            points: 100,
            points_taken: 10,
            status: 'active',
            // Merged from h1_season.points_max[enemy]
            points_max: 500,
            introduction_order: 0,
            // Merged from h1_statistic[enemy=0] — 11 per-faction fields.
            players: 1000,
            total_unique_players: 5000,
            missions: 100,
            successful_missions: 90,
            total_mission_difficulty: 500,
            completed_planets: 1,
            deaths: 1000n,
            kills: 10000n,
            accidentals: 100n,
            shots: 500000n,
            hits: 400000n,
        });
        // Lock in the drop decision — these 5 fields are no longer
        // per-faction. season_duration lives at result.season_duration;
        // event counts are derivable from h1_event.
        expect(result.status[0]).not.toHaveProperty('season_duration');
        expect(result.status[0]).not.toHaveProperty('defend_events');
        expect(result.status[0]).not.toHaveProperty('successful_defend_events');
        expect(result.status[0]).not.toHaveProperty('attack_events');
        expect(result.status[0]).not.toHaveProperty('successful_attack_events');
        expect(result.status[1]).toMatchObject({
            enemy: 1,
            points_max: 600,
            introduction_order: 1,
            players: 2000,
            total_unique_players: 6000,
            missions: 200,
            successful_missions: 180,
            kills: 20000n,
            deaths: 2000n,
            accidentals: 200n,
            shots: 1000000n,
            hits: 800000n,
        });
        expect(result.status[1]).not.toHaveProperty('season_duration');
        expect(result.status[2]).toMatchObject({
            enemy: 2,
            points_max: 700,
            introduction_order: 2,
            players: 3000,
            total_unique_players: 7000,
            missions: 300,
            successful_missions: 270,
            kills: 30000n,
            deaths: 3000n,
            accidentals: 300n,
            shots: 1500000n,
            hits: 1200000n,
        });
        expect(result.status[2]).not.toHaveProperty('season_duration');
        // snapshots is derived from the full h1_status history and has the
        // public { time, data: [f0, f1, f2] } shape.
        expect(Array.isArray(result.snapshots)).toBe(true);
        expect(result.snapshots).toHaveLength(2);
        expect(result.snapshots[0]).toMatchObject({
            time: t0,
            data: [
                { points: 10, points_taken: 1, status: 'active' },
                { points: 20, points_taken: 2, status: 'active' },
                { points: 30, points_taken: 3, status: 'active' },
            ],
        });
        expect(result.snapshots[1]).toMatchObject({
            time: t1,
            data: [
                { points: 40, points_taken: 4, status: 'active' },
                { points: 50, points_taken: 5, status: 'active' },
                { points: 60, points_taken: 6, status: 'active' },
            ],
        });
    });

    test('computes war_start and per-faction first_seen (first non-hidden bucket)', async () => {
        // updateStatus writes a row for all 3 factions every poll, so
        // pre-introduction factions have 'hidden' rows from war start.
        // first_seen must be the first NON-hidden bucket, not min(time).
        seedDbMocks({
            statusHistory: [
                { bucket: 1, enemy: 0, status: 'active', time: 1000, points: 1, points_taken: 0 }, // prettier-ignore
                { bucket: 1, enemy: 1, status: 'hidden', time: 1000, points: 0, points_taken: 0 }, // prettier-ignore
                { bucket: 1, enemy: 2, status: 'hidden', time: 1000, points: 0, points_taken: 0 }, // prettier-ignore
                { bucket: 2, enemy: 0, status: 'active', time: 2000, points: 2, points_taken: 0 }, // prettier-ignore
                { bucket: 2, enemy: 1, status: 'active', time: 2000, points: 1, points_taken: 0 }, // prettier-ignore
                { bucket: 2, enemy: 2, status: 'hidden', time: 2000, points: 0, points_taken: 0 }, // prettier-ignore
                { bucket: 3, enemy: 0, status: 'active', time: 3000, points: 3, points_taken: 0 }, // prettier-ignore
                { bucket: 3, enemy: 1, status: 'active', time: 3000, points: 2, points_taken: 0 }, // prettier-ignore
                { bucket: 3, enemy: 2, status: 'active', time: 3000, points: 1, points_taken: 0 }, // prettier-ignore
            ],
        });

        const result = await getCampaign();

        // war_start = earliest bucket time across all factions (incl. hidden)
        expect(result.war_start).toBe(1000);
        // first_seen = earliest bucket where the faction is no longer 'hidden'
        expect(result.status[0].first_seen).toBe(1000);
        expect(result.status[1].first_seen).toBe(2000);
        expect(result.status[2].first_seen).toBe(3000);
    });

    test('first_seen is null for a faction that is still hidden', async () => {
        seedDbMocks({
            statusHistory: [
                { bucket: 1, enemy: 0, status: 'active', time: 1000, points: 1, points_taken: 0 }, // prettier-ignore
                { bucket: 1, enemy: 1, status: 'active', time: 1000, points: 1, points_taken: 0 }, // prettier-ignore
                { bucket: 1, enemy: 2, status: 'hidden', time: 1000, points: 0, points_taken: 0 }, // prettier-ignore
            ],
        });

        const result = await getCampaign();

        expect(result.status[2].first_seen).toBeNull();
    });

    test('zeroes stats fields when h1_statistic row missing for a faction', async () => {
        // Only faction 0 has a stat row. Faction 1 and 2 should still appear
        // in data.status with stats fields zeroed — not undefined, not dropped.
        // BigInt fields must default to 0n, not 0, so downstream BigInt math
        // doesn't crash on mixed-type operations.
        seedDbMocks({
            statRows: [
                {
                    enemy: 0,
                    bucket: 42,
                    players: 1000,
                    total_unique_players: 5000,
                    missions: 100,
                    successful_missions: 90,
                    total_mission_difficulty: 500,
                    completed_planets: 1,
                    deaths: 1000n,
                    kills: 10000n,
                    accidentals: 100n,
                    shots: 500000n,
                    hits: 400000n,
                },
            ],
        });

        const result = await getCampaign();

        expect(result.status).toHaveLength(3);
        expect(result.status[1]).toMatchObject({
            enemy: 1,
            points_max: 600,
            players: 0,
            total_unique_players: 0,
            missions: 0,
            successful_missions: 0,
            total_mission_difficulty: 0,
            completed_planets: 0,
            deaths: 0n,
            kills: 0n,
            accidentals: 0n,
            shots: 0n,
            hits: 0n,
        });
        expect(result.status[2]).toMatchObject({
            enemy: 2,
            points_max: 700,
            players: 0,
            total_unique_players: 0,
            kills: 0n,
            deaths: 0n,
            accidentals: 0n,
            shots: 0n,
            hits: 0n,
        });
    });

    test('falls back to zero / empty when inlined season columns are null', async () => {
        seedDbMocks({
            seasonRow: {
                season: 5,
                last_updated: new Date('2025-01-01'),
                introduction_order: null,
                points_max: null,
                season_duration: null,
            },
        });

        const result = await getCampaign();

        // Public-shape relations return empty arrays.
        expect(result.introduction_order).toEqual({ order: [] });
        expect(result.points_max).toEqual({ points: [] });
        // Top-level season_duration falls back to 0 when null on the row.
        expect(result.season_duration).toBe(0);
        // Per-row merged fields fall back to zero rather than undefined, so
        // `pointsMax > 0` checks in computeMapState don't silently degrade.
        expect(result.status[0]).toMatchObject({
            points_max: 0,
            introduction_order: 0,
        });
        expect(result.status[1]).toMatchObject({
            points_max: 0,
            introduction_order: 0,
        });
    });

    test('drops sparse buckets missing one or more factions from snapshots', async () => {
        // Bucket 1 has all 3 factions → kept.
        // Bucket 2 only has faction 0 → dropped (would crash getWarOutcome).
        // Bucket 3 is missing faction 1 → dropped.
        seedDbMocks({
            statusHistory: [
                {
                    bucket: 1,
                    enemy: 0,
                    points: 10,
                    points_taken: 1,
                    status: 'active',
                    time: t0,
                },
                {
                    bucket: 1,
                    enemy: 1,
                    points: 20,
                    points_taken: 2,
                    status: 'active',
                    time: t0,
                },
                {
                    bucket: 1,
                    enemy: 2,
                    points: 30,
                    points_taken: 3,
                    status: 'active',
                    time: t0,
                },
                {
                    bucket: 2,
                    enemy: 0,
                    points: 40,
                    points_taken: 4,
                    status: 'active',
                    time: t1,
                },
                {
                    bucket: 3,
                    enemy: 0,
                    points: 70,
                    points_taken: 7,
                    status: 'active',
                    time: t1,
                },
                {
                    bucket: 3,
                    enemy: 2,
                    points: 90,
                    points_taken: 9,
                    status: 'active',
                    time: t1,
                },
            ],
        });

        const result = await getCampaign();

        // Only the dense bucket 1 survives.
        expect(result.snapshots).toHaveLength(1);
        expect(result.snapshots[0].data).toEqual([
            { points: 10, points_taken: 1, status: 'active' },
            { points: 20, points_taken: 2, status: 'active' },
            { points: 30, points_taken: 3, status: 'active' },
        ]);
        // Downstream consumers can now safely do data.every(f => f.status ...)
        // without a null check.
        expect(result.snapshots[0].data.every((f) => f !== null)).toBe(true);
    });

    test('builds playerTimeseries from h1_statistic, with 1-based day anchored to war_start', async () => {
        // war_start is the earliest h1_status bucket time. Align the status
        // history's earliest time with the stat history so the day math is
        // clean: bucket 1 stats at war_start → day 1, bucket 2 at +1 day → day 2.
        seedDbMocks({
            statusHistory: [
                { bucket: 1, enemy: 0, status: 'active', time: 1000, points: 1, points_taken: 0 }, // prettier-ignore
                { bucket: 1, enemy: 1, status: 'active', time: 1000, points: 1, points_taken: 0 }, // prettier-ignore
                { bucket: 1, enemy: 2, status: 'active', time: 1000, points: 1, points_taken: 0 }, // prettier-ignore
            ],
        });

        const result = await getCampaign();

        expect(result.war_start).toBe(1000);
        expect(result.playerTimeseries).toEqual([
            { time: 1000, day: 1, total: 175, bugs: 100, cyborgs: 50, illuminate: 25 },
            { time: 1000 + 86400, day: 2, total: 300, bugs: 200, cyborgs: 60, illuminate: 40 }, // prettier-ignore
        ]);
    });

    test('playerTimeseries is empty for a season with no h1_statistic rows (historical)', async () => {
        seedDbMocks({ statHistory: [] });

        const result = await getCampaign();

        expect(result.playerTimeseries).toEqual([]);
    });

    test('returns null when no season found', async () => {
        seedDbMocks({ seasonRow: null });

        const result = await getCampaign();

        expect(result).toBeNull();
        // Subsequent fetches should be skipped once the season lookup is empty.
        expect(db.$queryRaw).not.toHaveBeenCalled();
        expect(db.h1_status.findMany).not.toHaveBeenCalled();
        expect(db.h1_event.findMany).not.toHaveBeenCalled();
    });

    test('throws when database query fails', async () => {
        vi.mocked(db.h1_season.findFirst).mockRejectedValue(new Error('connection lost'));

        await expect(getCampaign()).rejects.toThrow('connection lost');
    });
});
