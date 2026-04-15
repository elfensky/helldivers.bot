import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { getCampaign } from '@/db/queries/getCampaign.mjs';

// getCampaign is wrapped in React's cache(), but in test the mock from
// vitest.setup.mjs handles that transparently.

const mockSeasonRow = {
    season: 5,
    last_updated: new Date('2025-01-01'),
    intro_order_array: [0, 1, 2],
    points_max_array: [500, 600, 700],
};

const mockLiveRows = [
    { enemy: 0, points: 100, points_taken: 10, status: 'active', bucket: 42 },
    { enemy: 1, points: 200, points_taken: 20, status: 'active', bucket: 42 },
    { enemy: 2, points: 300, points_taken: 30, status: 'active', bucket: 42 },
];

// Latest-bucket-per-faction h1_statistic rows. Merged into data.live[i] by
// getCampaign so consumers (StatGrid, formatNumber, etc.) can read the 4
// stats signals without a second query.
const mockStatRows = [
    {
        enemy: 0,
        bucket: 42,
        players: 1000,
        total_unique_players: 5000,
        kills: 10000n,
        deaths: 1000n,
    },
    {
        enemy: 1,
        bucket: 42,
        players: 2000,
        total_unique_players: 6000,
        kills: 20000n,
        deaths: 2000n,
    },
    {
        enemy: 2,
        bucket: 42,
        players: 3000,
        total_unique_players: 7000,
        kills: 30000n,
        deaths: 3000n,
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

function seedDbMocks({
    seasonRow = mockSeasonRow,
    liveRows = mockLiveRows,
    statRows = mockStatRows,
    statusHistory = mockStatusHistory,
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

    test('selects inlined intro_order_array / points_max_array from h1_season', async () => {
        seedDbMocks();

        await getCampaign();

        const callArg = db.h1_season.findFirst.mock.calls[0][0];
        expect(callArg.select).toEqual({
            season: true,
            last_updated: true,
            intro_order_array: true,
            points_max_array: true,
        });
    });

    test('returns legacy-compatible shape with live/snapshots/events/introduction_order/points_max', async () => {
        seedDbMocks();

        const result = await getCampaign();

        expect(result).toMatchObject({
            season: 5,
            last_updated: mockSeasonRow.last_updated,
            introduction_order: { order: [0, 1, 2] },
            points_max: { points: [500, 600, 700] },
            events: mockEvents,
        });
        // data.live must carry all fields consumers historically read from
        // the legacy h1_live row: campaign progression (from h1_status) +
        // points_max / introduction_order (from h1_season arrays) + the 4
        // stats signals (from h1_statistic). Shallow mock equality used to
        // hide this regression — assert explicit fields instead.
        expect(result.live).toHaveLength(3);
        expect(result.live[0]).toMatchObject({
            enemy: 0,
            points: 100,
            points_taken: 10,
            status: 'active',
            // Merged from h1_season.points_max_array[0]
            points_max: 500,
            introduction_order: 0,
            // Merged from h1_statistic[enemy=0]
            players: 1000,
            total_unique_players: 5000,
            kills: 10000n,
            deaths: 1000n,
        });
        expect(result.live[1]).toMatchObject({
            enemy: 1,
            points_max: 600,
            introduction_order: 1,
            players: 2000,
            total_unique_players: 6000,
            kills: 20000n,
            deaths: 2000n,
        });
        expect(result.live[2]).toMatchObject({
            enemy: 2,
            points_max: 700,
            introduction_order: 2,
            players: 3000,
            total_unique_players: 7000,
            kills: 30000n,
            deaths: 3000n,
        });
        // snapshots is derived from the full h1_status history and has the
        // legacy { time, data: [f0, f1, f2] } shape.
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

    test('zeroes stats fields when h1_statistic row missing for a faction', async () => {
        // Only faction 0 has a stat row. Faction 1 and 2 should still appear
        // in data.live with stats fields zeroed — not undefined, not dropped.
        seedDbMocks({
            statRows: [
                {
                    enemy: 0,
                    bucket: 42,
                    players: 1000,
                    total_unique_players: 5000,
                    kills: 10000n,
                    deaths: 1000n,
                },
            ],
        });

        const result = await getCampaign();

        expect(result.live).toHaveLength(3);
        expect(result.live[1]).toMatchObject({
            enemy: 1,
            points_max: 600,
            players: 0,
            total_unique_players: 0,
            kills: 0n,
            deaths: 0n,
        });
        expect(result.live[2]).toMatchObject({
            enemy: 2,
            points_max: 700,
            players: 0,
            total_unique_players: 0,
            kills: 0n,
            deaths: 0n,
        });
    });

    test('falls back to zero / empty when inlined season columns are null', async () => {
        seedDbMocks({
            seasonRow: {
                season: 5,
                last_updated: new Date('2025-01-01'),
                intro_order_array: null,
                points_max_array: null,
            },
        });

        const result = await getCampaign();

        // Legacy-shape relations return empty arrays.
        expect(result.introduction_order).toEqual({ order: [] });
        expect(result.points_max).toEqual({ points: [] });
        // Per-row merged fields fall back to zero rather than undefined, so
        // `pointsMax > 0` checks in computeMapState don't silently degrade.
        expect(result.live[0]).toMatchObject({
            points_max: 0,
            introduction_order: 0,
        });
        expect(result.live[1]).toMatchObject({
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
