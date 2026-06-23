import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/db', () => ({
    default: { $queryRaw: vi.fn(), api_rate_limit: { deleteMany: vi.fn() } },
}));
vi.mock('@/config/policy.mjs', () => ({
    getRateLimitConfig: vi.fn(() => ({ limit: 3, windowSeconds: 60 })),
}));
vi.mock('@/shared/utils/observability.mjs', () => ({ reportError: vi.fn() }));

const db = (await import('@/db/db')).default;
const { reportError } = await import('@/shared/utils/observability.mjs');
const { checkRateLimit, rateLimitHeaders, enforceRateLimit, cleanupRateLimitWindows } =
    await import('@/shared/utils/api/rateLimit.mjs');

beforeEach(() => vi.clearAllMocks());

describe('checkRateLimit', () => {
    test('under the limit → ok with remaining', async () => {
        db.$queryRaw.mockResolvedValue([{ count: 1 }]);
        const r = await checkRateLimit('public_read', 'ip1');
        expect(r).toMatchObject({ ok: true, limit: 3, remaining: 2, retryAfter: 0 });
        expect(r.resetSeconds).toBeGreaterThan(0);
        expect(r.resetSeconds).toBeLessThanOrEqual(60);
    });

    test('exactly at the limit → still ok, remaining 0', async () => {
        db.$queryRaw.mockResolvedValue([{ count: 3 }]);
        const r = await checkRateLimit('public_read', 'ip1');
        expect(r.ok).toBe(true);
        expect(r.remaining).toBe(0);
    });

    test('over the limit → not ok with a positive retryAfter', async () => {
        db.$queryRaw.mockResolvedValue([{ count: 4 }]);
        const r = await checkRateLimit('public_read', 'ip1');
        expect(r.ok).toBe(false);
        expect(r.remaining).toBe(0);
        expect(r.retryAfter).toBeGreaterThan(0);
    });

    test('coerces a BigInt count from the raw query', async () => {
        db.$queryRaw.mockResolvedValue([{ count: 2n }]);
        const r = await checkRateLimit('public_read', 'ip1');
        expect(r.remaining).toBe(1);
    });

    test('fails open (allows) when the counter store errors', async () => {
        db.$queryRaw.mockRejectedValue(new Error('db down'));
        const r = await checkRateLimit('public_read', 'ip1');
        expect(r.ok).toBe(true);
        expect(r.degraded).toBe(true);
        expect(reportError).toHaveBeenCalled();
    });
});

describe('rateLimitHeaders', () => {
    test('emits RateLimit-* and omits Retry-After when ok', () => {
        const h = rateLimitHeaders({
            ok: true,
            limit: 3,
            remaining: 1,
            resetSeconds: 30,
            retryAfter: 0,
        });
        expect(h).toMatchObject({
            'RateLimit-Limit': '3',
            'RateLimit-Remaining': '1',
            'RateLimit-Reset': '30',
        });
        expect(h['Retry-After']).toBeUndefined();
    });

    test('adds Retry-After on a breach', () => {
        const h = rateLimitHeaders({
            ok: false,
            limit: 3,
            remaining: 0,
            resetSeconds: 30,
            retryAfter: 30,
        });
        expect(h['Retry-After']).toBe('30');
    });
});

describe('enforceRateLimit', () => {
    test('returns null error + headers when under the limit', async () => {
        db.$queryRaw.mockResolvedValue([{ count: 1 }]);
        const { error, headers } = await enforceRateLimit('public_read', 'ip', 0);
        expect(error).toBeNull();
        expect(headers['RateLimit-Remaining']).toBe('2');
    });

    test('returns a 429 response carrying the headers when over the limit', async () => {
        db.$queryRaw.mockResolvedValue([{ count: 99 }]);
        const { error } = await enforceRateLimit('public_read', 'ip', 0);
        expect(error).not.toBeNull();
        expect(error.status).toBe(429);
        expect(error.headers.get('retry-after')).toBeTruthy();
    });
});

describe('cleanupRateLimitWindows', () => {
    test('deletes windows older than the cutoff', async () => {
        db.api_rate_limit.deleteMany.mockResolvedValue({ count: 5 });
        await cleanupRateLimitWindows();
        const arg = db.api_rate_limit.deleteMany.mock.calls[0][0];
        expect(arg.where.window_start.lt).toBeGreaterThan(0);
    });
});
