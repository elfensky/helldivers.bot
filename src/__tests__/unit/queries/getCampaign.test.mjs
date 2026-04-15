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
    statusHistory = mockStatusHistory,
    events = mockEvents,
} = {}) {
    vi.mocked(db.h1_season.findFirst).mockResolvedValue(seasonRow);
    vi.mocked(db.$queryRaw).mockResolvedValue(liveRows);
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
            live: mockLiveRows,
            introduction_order: { order: [0, 1, 2] },
            points_max: { points: [500, 600, 700] },
            events: mockEvents,
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

    test('falls back to empty arrays when inlined columns are null', async () => {
        seedDbMocks({
            seasonRow: {
                season: 5,
                last_updated: new Date('2025-01-01'),
                intro_order_array: null,
                points_max_array: null,
            },
        });

        const result = await getCampaign();

        expect(result.introduction_order).toEqual({ order: [] });
        expect(result.points_max).toEqual({ points: [] });
    });

    test('groups status rows with sparse factions without crashing', async () => {
        // Only faction 0 reports in bucket 1 — buckets 1/2 stay null.
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
            ],
        });

        const result = await getCampaign();

        expect(result.snapshots).toHaveLength(1);
        expect(result.snapshots[0].data).toEqual([
            { points: 10, points_taken: 1, status: 'active' },
            null,
            null,
        ]);
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
