import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/queries/getCampaign.mjs', () => ({ getCampaign: vi.fn() }));
vi.mock('@/update/season.mjs', () => ({
    updateSeason: vi.fn(),
    SEASON_NOT_FOUND: 'SEASON_NOT_FOUND',
}));

import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { updateSeason } from '@/update/season.mjs';
import { getCampaignOrSeed } from '@/db/queries/getCampaignOrSeed.mjs';

const CAMPAIGN = { season: 42, events: [] };

describe('getCampaignOrSeed', () => {
    beforeEach(() => {
        vi.mocked(getCampaign).mockReset();
        vi.mocked(updateSeason).mockReset();
    });

    it('returns ok+data on a first-read hit without seeding', async () => {
        vi.mocked(getCampaign).mockResolvedValueOnce(CAMPAIGN);
        const result = await getCampaignOrSeed(42);
        expect(result).toEqual({ ok: true, data: CAMPAIGN });
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('returns an error result when the first read throws', async () => {
        const boom = new Error('db down');
        vi.mocked(getCampaign).mockRejectedValueOnce(boom);
        const result = await getCampaignOrSeed(42);
        expect(result).toEqual({
            ok: false,
            reason: 'error',
            stage: 'get-campaign',
            error: boom,
        });
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('seeds on miss and returns the re-read data', async () => {
        vi.mocked(getCampaign)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(CAMPAIGN);
        vi.mocked(updateSeason).mockResolvedValueOnce(undefined);
        const result = await getCampaignOrSeed(42);
        expect(updateSeason).toHaveBeenCalledWith(42);
        expect(result).toEqual({ ok: true, data: CAMPAIGN });
    });

    it('maps a SEASON_NOT_FOUND seed failure to not_found', async () => {
        vi.mocked(getCampaign).mockResolvedValueOnce(null);
        const missing = new Error('season 999 does not exist', {
            cause: 'SEASON_NOT_FOUND',
        });
        vi.mocked(updateSeason).mockRejectedValueOnce(missing);
        const result = await getCampaignOrSeed(999);
        expect(result).toEqual({
            ok: false,
            reason: 'not_found',
            message: 'season 999 does not exist',
        });
    });

    it('maps a generic seed failure to a backfill-season error', async () => {
        vi.mocked(getCampaign).mockResolvedValueOnce(null);
        const boom = new Error('upstream 500');
        vi.mocked(updateSeason).mockRejectedValueOnce(boom);
        const result = await getCampaignOrSeed(42);
        expect(result).toEqual({
            ok: false,
            reason: 'error',
            stage: 'backfill-season',
            error: boom,
        });
    });

    it('maps a retry-read failure to a get-campaign-retry error', async () => {
        const boom = new Error('db down on retry');
        vi.mocked(getCampaign).mockResolvedValueOnce(null).mockRejectedValueOnce(boom);
        vi.mocked(updateSeason).mockResolvedValueOnce(undefined);
        const result = await getCampaignOrSeed(42);
        expect(result).toEqual({
            ok: false,
            reason: 'error',
            stage: 'get-campaign-retry',
            error: boom,
        });
    });

    it('returns ok with null data when the seed succeeds but the retry is still empty', async () => {
        vi.mocked(getCampaign).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        vi.mocked(updateSeason).mockResolvedValueOnce(undefined);
        const result = await getCampaignOrSeed(42);
        // Preserves today's route semantics (200 with null body) — callers
        // render their own empty state.
        expect(result).toEqual({ ok: true, data: null });
    });
});
