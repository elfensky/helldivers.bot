import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('bucketing', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.BUCKET_SIZE;
        vi.resetModules();
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.BUCKET_SIZE;
        } else {
            process.env.BUCKET_SIZE = originalEnv;
        }
        vi.resetModules();
    });

    test('defaults BUCKET_SIZE to 900 when env var absent', async () => {
        delete process.env.BUCKET_SIZE;
        const { BUCKET_SIZE } = await import('@/shared/utils/bucketing');
        expect(BUCKET_SIZE).toBe(900);
    });

    test('defaults BUCKET_SIZE to 900 when env var is invalid', async () => {
        process.env.BUCKET_SIZE = 'not-a-number';
        const { BUCKET_SIZE } = await import('@/shared/utils/bucketing');
        expect(BUCKET_SIZE).toBe(900);
    });

    test('defaults BUCKET_SIZE to 900 when env var is zero or negative', async () => {
        process.env.BUCKET_SIZE = '0';
        const mod1 = await import('@/shared/utils/bucketing');
        expect(mod1.BUCKET_SIZE).toBe(900);

        vi.resetModules();
        process.env.BUCKET_SIZE = '-60';
        const mod2 = await import('@/shared/utils/bucketing');
        expect(mod2.BUCKET_SIZE).toBe(900);
    });

    test('reads BUCKET_SIZE from env var', async () => {
        process.env.BUCKET_SIZE = '300';
        const { BUCKET_SIZE } = await import('@/shared/utils/bucketing');
        expect(BUCKET_SIZE).toBe(300);
    });

    describe('computeBucket', () => {
        test('returns 0 for poll time 0', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/shared/utils/bucketing');
            expect(computeBucket(0)).toBe(0);
        });

        test('returns 0 for poll time within first bucket window', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/shared/utils/bucketing');
            expect(computeBucket(899)).toBe(0);
        });

        test('returns 900 at exact bucket boundary', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/shared/utils/bucketing');
            expect(computeBucket(900)).toBe(900);
        });

        test('returns 900 for poll time within second bucket window', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/shared/utils/bucketing');
            expect(computeBucket(1799)).toBe(900);
        });

        test('handles large timestamps correctly', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/shared/utils/bucketing');
            // 1776270784 is a realistic HD1 unix timestamp
            // floor(1776270784 / 900) * 900 = 1776270600
            expect(computeBucket(1776270784)).toBe(1776270600);
        });

        test('respects custom BUCKET_SIZE', async () => {
            process.env.BUCKET_SIZE = '60';
            const { computeBucket } = await import('@/shared/utils/bucketing');
            expect(computeBucket(0)).toBe(0);
            expect(computeBucket(59)).toBe(0);
            expect(computeBucket(60)).toBe(60);
            expect(computeBucket(119)).toBe(60);
        });
    });

    describe('groupStatisticByBucket', () => {
        test('groups rows per bucket into [bugs, cyborgs, illuminate] player counts', async () => {
            const { groupStatisticByBucket } = await import('@/shared/utils/bucketing');
            const rows = [
                { bucket: 1, enemy: 0, players: 100, time: 1000 },
                { bucket: 1, enemy: 1, players: 50, time: 1000 },
                { bucket: 1, enemy: 2, players: 25, time: 1000 },
                { bucket: 2, enemy: 0, players: 200, time: 2000 },
                { bucket: 2, enemy: 1, players: 60, time: 2000 },
                { bucket: 2, enemy: 2, players: 40, time: 2000 },
            ];
            expect(groupStatisticByBucket(rows)).toEqual([
                { time: 1000, players: [100, 50, 25] },
                { time: 2000, players: [200, 60, 40] },
            ]);
        });

        test('zero-fills factions missing from a bucket (keeps the bucket)', async () => {
            const { groupStatisticByBucket } = await import('@/shared/utils/bucketing');
            // Only bugs reported in this bucket — cyborgs/illuminate default to 0.
            const rows = [{ bucket: 1, enemy: 0, players: 100, time: 1000 }];
            expect(groupStatisticByBucket(rows)).toEqual([
                { time: 1000, players: [100, 0, 0] },
            ]);
        });

        test('sorts ascending by time and tracks the latest time within a bucket', async () => {
            const { groupStatisticByBucket } = await import('@/shared/utils/bucketing');
            const rows = [
                { bucket: 2, enemy: 0, players: 200, time: 2000 },
                { bucket: 1, enemy: 0, players: 100, time: 1000 },
                // later poll within bucket 1 drifts its time forward
                { bucket: 1, enemy: 1, players: 50, time: 1500 },
            ];
            const out = groupStatisticByBucket(rows);
            expect(out.map((e) => e.time)).toEqual([1500, 2000]);
        });

        test('returns empty for no rows', async () => {
            const { groupStatisticByBucket } = await import('@/shared/utils/bucketing');
            expect(groupStatisticByBucket([])).toEqual([]);
        });
    });
});
