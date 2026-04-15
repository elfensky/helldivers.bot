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
        const { BUCKET_SIZE } = await import('@/update/bucketing');
        expect(BUCKET_SIZE).toBe(900);
    });

    test('defaults BUCKET_SIZE to 900 when env var is invalid', async () => {
        process.env.BUCKET_SIZE = 'not-a-number';
        const { BUCKET_SIZE } = await import('@/update/bucketing');
        expect(BUCKET_SIZE).toBe(900);
    });

    test('defaults BUCKET_SIZE to 900 when env var is zero or negative', async () => {
        process.env.BUCKET_SIZE = '0';
        const mod1 = await import('@/update/bucketing');
        expect(mod1.BUCKET_SIZE).toBe(900);

        vi.resetModules();
        process.env.BUCKET_SIZE = '-60';
        const mod2 = await import('@/update/bucketing');
        expect(mod2.BUCKET_SIZE).toBe(900);
    });

    test('reads BUCKET_SIZE from env var', async () => {
        process.env.BUCKET_SIZE = '300';
        const { BUCKET_SIZE } = await import('@/update/bucketing');
        expect(BUCKET_SIZE).toBe(300);
    });

    describe('computeBucket', () => {
        test('returns 0 for poll time 0', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/update/bucketing');
            expect(computeBucket(0)).toBe(0);
        });

        test('returns 0 for poll time within first bucket window', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/update/bucketing');
            expect(computeBucket(899)).toBe(0);
        });

        test('returns 900 at exact bucket boundary', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/update/bucketing');
            expect(computeBucket(900)).toBe(900);
        });

        test('returns 900 for poll time within second bucket window', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/update/bucketing');
            expect(computeBucket(1799)).toBe(900);
        });

        test('handles large timestamps correctly', async () => {
            delete process.env.BUCKET_SIZE;
            const { computeBucket } = await import('@/update/bucketing');
            // 1776270784 is a realistic HD1 unix timestamp
            // floor(1776270784 / 900) * 900 = 1776270600
            expect(computeBucket(1776270784)).toBe(1776270600);
        });

        test('respects custom BUCKET_SIZE', async () => {
            process.env.BUCKET_SIZE = '60';
            const { computeBucket } = await import('@/update/bucketing');
            expect(computeBucket(0)).toBe(0);
            expect(computeBucket(59)).toBe(0);
            expect(computeBucket(60)).toBe(60);
            expect(computeBucket(119)).toBe(60);
        });
    });
});
