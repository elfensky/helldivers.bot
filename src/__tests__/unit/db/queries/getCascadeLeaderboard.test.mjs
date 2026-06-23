import { describe, it, expect, vi, beforeEach } from 'vitest';
import db from '@/db/db';
import { getCascadeLeaderboard } from '@/db/queries/getCascadeLeaderboard.mjs';

function makeEvent(season, enemy, region, endOffset) {
    const base = season * 10_000_000;
    return {
        season,
        type: 'defend',
        status: 'fail',
        enemy,
        region,
        start_time: base + endOffset - 7200,
        end_time: base + endOffset,
        event_id: base + endOffset,
    };
}

describe('getCascadeLeaderboard', () => {
    beforeEach(() => {
        vi.mocked(db.h1_event.findMany).mockReset();
    });

    it('returns [] for no events', async () => {
        vi.mocked(db.h1_event.findMany).mockResolvedValue([]);
        const result = await getCascadeLeaderboard();
        expect(result).toEqual([]);
    });

    it('returns [] on Prisma error', async () => {
        vi.mocked(db.h1_event.findMany).mockRejectedValue(new Error('db down'));
        const result = await getCascadeLeaderboard();
        expect(result).toEqual([]);
    });

    it('passes the expected filter to Prisma', async () => {
        vi.mocked(db.h1_event.findMany).mockResolvedValue([]);
        await getCascadeLeaderboard();
        const call = vi.mocked(db.h1_event.findMany).mock.calls[0][0];
        expect(call.where).toEqual({ type: 'defend', status: 'fail' });
    });

    it('attaches season to each cascade and sorts globally', async () => {
        const s155 = [
            makeEvent(155, 2, 8, 100_000),
            makeEvent(155, 2, 7, 110_000),
            makeEvent(155, 2, 6, 120_000),
            makeEvent(155, 2, 5, 130_000),
        ];
        const s142 = [
            makeEvent(142, 0, 6, 100_000),
            makeEvent(142, 0, 5, 110_000),
            makeEvent(142, 0, 4, 120_000),
            makeEvent(142, 0, 3, 130_000),
            makeEvent(142, 0, 2, 140_000),
        ];
        vi.mocked(db.h1_event.findMany).mockResolvedValue([...s155, ...s142]);

        const result = await getCascadeLeaderboard();
        expect(result).toHaveLength(2);
        // Longer cascade (s142, length 5) ranks first
        expect(result[0].season).toBe(142);
        expect(result[0].length).toBe(5);
        expect(result[1].season).toBe(155);
        expect(result[1].length).toBe(4);
    });
});
