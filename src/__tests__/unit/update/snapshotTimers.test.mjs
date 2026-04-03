import { vi } from 'vitest';
import db from '@/db/db';
import {
    shouldTakeLiveSnapshot,
    recordLiveSnapshotTime,
    shouldTakeEventSnapshot,
    recordEventSnapshotTime,
    resetSnapshotTimers,
} from '@/update/snapshotTimers';

describe('snapshotTimers', () => {
    beforeEach(() => {
        resetSnapshotTimers();
        vi.clearAllMocks();
    });

    describe('shouldTakeLiveSnapshot', () => {
        test('queries DB on cold start', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });

            await shouldTakeLiveSnapshot(1, 1500);

            expect(db.h1_live_snapshot.findFirst).toHaveBeenCalledWith({
                where: { season: 1 },
                orderBy: { time: 'desc' },
                select: { time: true },
            });
        });

        test('returns true when interval (900s) has elapsed', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });

            const result = await shouldTakeLiveSnapshot(1, 1901);

            expect(result).toBe(true);
        });

        test('returns false when interval has not elapsed', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });

            const result = await shouldTakeLiveSnapshot(1, 1899);

            expect(result).toBe(false);
        });

        test('returns true at exact boundary (900s)', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });

            const result = await shouldTakeLiveSnapshot(1, 1900);

            expect(result).toBe(true);
        });

        test('does not query DB on subsequent calls (uses in-memory timer)', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });

            await shouldTakeLiveSnapshot(1, 1500);
            await shouldTakeLiveSnapshot(1, 1600);

            expect(db.h1_live_snapshot.findFirst).toHaveBeenCalledTimes(1);
        });

        test('defaults to time 0 when DB has no rows', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue(null);

            const result = await shouldTakeLiveSnapshot(1, 901);

            expect(result).toBe(true);
        });

        test('throws when DB query fails', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockRejectedValue(
                new Error('DB error'),
            );

            await expect(shouldTakeLiveSnapshot(1, 2000)).rejects.toThrow('DB error');
        });
    });

    describe('recordLiveSnapshotTime', () => {
        test('updates the in-memory timer for subsequent checks', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });

            // Cold start seed
            await shouldTakeLiveSnapshot(1, 1500);

            // Record a new snapshot at time 1500
            recordLiveSnapshotTime(1500);

            // Now check: 1500 + 900 = 2400, so 2300 should be false
            const result = await shouldTakeLiveSnapshot(1, 2300);
            expect(result).toBe(false);

            // And 2400 should be true
            const result2 = await shouldTakeLiveSnapshot(1, 2400);
            expect(result2).toBe(true);
        });
    });

    describe('shouldTakeEventSnapshot', () => {
        test('queries DB on cold start for each event', async () => {
            vi.mocked(db.h1_event_snapshot.findFirst).mockResolvedValue({ time: 500 });

            await shouldTakeEventSnapshot('attack', 42, 800);

            expect(db.h1_event_snapshot.findFirst).toHaveBeenCalledWith({
                where: { type: 'attack', event_id: 42 },
                orderBy: { time: 'desc' },
                select: { time: true },
            });
        });

        test('returns true when 600s interval has elapsed', async () => {
            vi.mocked(db.h1_event_snapshot.findFirst).mockResolvedValue({ time: 500 });

            const result = await shouldTakeEventSnapshot('attack', 42, 1101);

            expect(result).toBe(true);
        });

        test('returns false when interval has not elapsed', async () => {
            vi.mocked(db.h1_event_snapshot.findFirst).mockResolvedValue({ time: 500 });

            const result = await shouldTakeEventSnapshot('attack', 42, 1099);

            expect(result).toBe(false);
        });

        test('tracks different events independently', async () => {
            vi.mocked(db.h1_event_snapshot.findFirst)
                .mockResolvedValueOnce({ time: 500 }) // event 1
                .mockResolvedValueOnce({ time: 900 }); // event 2

            const result1 = await shouldTakeEventSnapshot('attack', 1, 1100);
            const result2 = await shouldTakeEventSnapshot('defend', 2, 1100);

            expect(result1).toBe(true); // 1100 - 500 = 600, >= 600
            expect(result2).toBe(false); // 1100 - 900 = 200, < 600
        });

        test('does not query DB on subsequent calls for same event', async () => {
            vi.mocked(db.h1_event_snapshot.findFirst).mockResolvedValue({ time: 500 });

            await shouldTakeEventSnapshot('attack', 42, 800);
            await shouldTakeEventSnapshot('attack', 42, 900);

            expect(db.h1_event_snapshot.findFirst).toHaveBeenCalledTimes(1);
        });
    });

    describe('recordEventSnapshotTime', () => {
        test('updates the in-memory timer for the specific event', async () => {
            vi.mocked(db.h1_event_snapshot.findFirst).mockResolvedValue({ time: 500 });

            await shouldTakeEventSnapshot('attack', 42, 800);
            recordEventSnapshotTime('attack', 42, 1100);

            // 1100 + 600 = 1700, so 1600 should be false
            const result = await shouldTakeEventSnapshot('attack', 42, 1600);
            expect(result).toBe(false);

            // 1700 should be true
            const result2 = await shouldTakeEventSnapshot('attack', 42, 1700);
            expect(result2).toBe(true);
        });
    });

    describe('resetSnapshotTimers', () => {
        test('clears all live and event timers', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });
            vi.mocked(db.h1_event_snapshot.findFirst).mockResolvedValue({ time: 500 });

            // Populate timers
            await shouldTakeLiveSnapshot(1, 1500);
            await shouldTakeEventSnapshot('attack', 42, 800);

            expect(db.h1_live_snapshot.findFirst).toHaveBeenCalledTimes(1);
            expect(db.h1_event_snapshot.findFirst).toHaveBeenCalledTimes(1);

            // Reset
            resetSnapshotTimers();

            // Next calls should query DB again (cold start)
            await shouldTakeLiveSnapshot(1, 1500);
            await shouldTakeEventSnapshot('attack', 42, 800);

            expect(db.h1_live_snapshot.findFirst).toHaveBeenCalledTimes(2);
            expect(db.h1_event_snapshot.findFirst).toHaveBeenCalledTimes(2);
        });
    });

    describe('season change', () => {
        test('resets live timer when season changes', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });

            // Seed season 1
            await shouldTakeLiveSnapshot(1, 1500);
            expect(db.h1_live_snapshot.findFirst).toHaveBeenCalledTimes(1);

            // Change to season 2 — should re-query DB
            await shouldTakeLiveSnapshot(2, 1500);
            expect(db.h1_live_snapshot.findFirst).toHaveBeenCalledTimes(2);
        });

        test('resets event timers when season changes', async () => {
            vi.mocked(db.h1_live_snapshot.findFirst).mockResolvedValue({ time: 1000 });
            vi.mocked(db.h1_event_snapshot.findFirst).mockResolvedValue({ time: 500 });

            // Seed season 1
            await shouldTakeLiveSnapshot(1, 1500);
            await shouldTakeEventSnapshot('attack', 42, 800);

            // Change season via shouldTakeLiveSnapshot
            await shouldTakeLiveSnapshot(2, 1500);

            // Event timer should be cleared, requiring new DB query
            await shouldTakeEventSnapshot('attack', 42, 800);
            expect(db.h1_event_snapshot.findFirst).toHaveBeenCalledTimes(2);
        });
    });
});
