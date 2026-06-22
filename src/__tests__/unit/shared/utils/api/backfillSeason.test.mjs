import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/update/season.mjs', () => ({
    updateSeason: vi.fn(),
    SEASON_NOT_FOUND: 'SEASON_NOT_FOUND',
}));
vi.mock('@/shared/utils/api/rateLimit.mjs', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@/shared/utils/observability.mjs', () => ({ reportError: vi.fn() }));

const { updateSeason, SEASON_NOT_FOUND } = await import('@/update/season.mjs');
const { enforceRateLimit } = await import('@/shared/utils/api/rateLimit.mjs');
const { backfillSeason, backfillAndRetry } =
    await import('@/shared/utils/api/backfillSeason.mjs');

beforeEach(() => vi.clearAllMocks());

describe('backfillSeason', () => {
    test('ok when updateSeason succeeds', async () => {
        updateSeason.mockResolvedValue({});
        expect(await backfillSeason(100)).toEqual({ ok: true });
    });

    test('classifies SEASON_NOT_FOUND as notFound (no error report)', async () => {
        updateSeason.mockRejectedValue(
            Object.assign(new Error('nope'), { cause: SEASON_NOT_FOUND }),
        );
        const r = await backfillSeason(100);
        expect(r).toMatchObject({ ok: false, notFound: true });
    });

    test('other failures are not notFound', async () => {
        updateSeason.mockRejectedValue(new Error('network'));
        const r = await backfillSeason(100);
        expect(r).toMatchObject({ ok: false, notFound: false });
    });
});

describe('backfillAndRetry', () => {
    test('season=current never backfills → 404, no token spent', async () => {
        const r = await backfillAndRetry({
            season: 'current',
            ip: 'x',
            start: 0,
            rerun: vi.fn(),
        });
        expect(r.result).toBeNull();
        expect(r.error.status).toBe(404);
        expect(enforceRateLimit).not.toHaveBeenCalled();
    });

    test('returns the limiter 429 when the backfill_trigger budget is spent', async () => {
        enforceRateLimit.mockResolvedValue({ error: { status: 429 }, headers: {} });
        const r = await backfillAndRetry({
            season: 100,
            ip: 'x',
            start: 0,
            rerun: vi.fn(),
        });
        expect(r.error.status).toBe(429);
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('backfills then returns the re-fetched result', async () => {
        enforceRateLimit.mockResolvedValue({ error: null, headers: {} });
        updateSeason.mockResolvedValue({});
        const rerun = vi.fn().mockResolvedValue({ season: 100 });
        const r = await backfillAndRetry({ season: 100, ip: 'x', start: 0, rerun });
        expect(r.error).toBeNull();
        expect(r.result).toEqual({ season: 100 });
        expect(enforceRateLimit).toHaveBeenCalledWith('backfill_trigger', 'x', 0);
    });

    test('404 when the season does not exist upstream', async () => {
        enforceRateLimit.mockResolvedValue({ error: null, headers: {} });
        updateSeason.mockRejectedValue(
            Object.assign(new Error('x'), { cause: SEASON_NOT_FOUND }),
        );
        const r = await backfillAndRetry({
            season: 100,
            ip: 'x',
            start: 0,
            rerun: vi.fn(),
        });
        expect(r.error.status).toBe(404);
    });

    test('404 when the retry still resolves null', async () => {
        enforceRateLimit.mockResolvedValue({ error: null, headers: {} });
        updateSeason.mockResolvedValue({});
        const r = await backfillAndRetry({
            season: 100,
            ip: 'x',
            start: 0,
            rerun: vi.fn().mockResolvedValue(null),
        });
        expect(r.error.status).toBe(404);
    });
});
