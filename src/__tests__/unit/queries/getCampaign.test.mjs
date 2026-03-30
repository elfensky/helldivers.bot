import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { getCampaign } from '@/db/queries/getCampaign.mjs';

// getCampaign is wrapped in React's cache(), but in test the mock from
// vitest.setup.mjs handles that transparently.

const mockCampaignData = {
    season: 5,
    last_updated: new Date('2025-01-01'),
    live: [{ enemy: 'bugs', points: 100 }],
    introduction_order: [{ order: 1 }],
    points_max: [{ points: 500 }],
    snapshots: [{ data: {}, time: new Date() }],
    events: [{ type: 'defend', event_id: 1 }],
};

describe('getCampaign', () => {
    test('queries latest season when season is null', async () => {
        vi.mocked(db.h1_season.findFirst).mockResolvedValue(mockCampaignData);

        const result = await getCampaign(null);

        expect(result).toEqual(mockCampaignData);
        expect(db.h1_season.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { last_updated: { not: null } },
                orderBy: { season: 'desc' },
            }),
        );
    });

    test('queries latest season when no argument provided', async () => {
        vi.mocked(db.h1_season.findFirst).mockResolvedValue(mockCampaignData);

        const result = await getCampaign();

        expect(result).toEqual(mockCampaignData);
        expect(db.h1_season.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { last_updated: { not: null } },
                orderBy: { season: 'desc' },
            }),
        );
    });

    test('queries specific season when season is provided', async () => {
        vi.mocked(db.h1_season.findFirst).mockResolvedValue(mockCampaignData);

        const result = await getCampaign(3);

        expect(result).toEqual(mockCampaignData);
        const callArg = db.h1_season.findFirst.mock.calls[0][0];
        expect(callArg.where).toEqual({ season: 3 });
        expect(callArg.orderBy).toBeUndefined();
    });

    test('includes all expected relations in select', async () => {
        vi.mocked(db.h1_season.findFirst).mockResolvedValue(mockCampaignData);

        await getCampaign();

        const callArg = db.h1_season.findFirst.mock.calls[0][0];
        expect(callArg.select).toHaveProperty('season');
        expect(callArg.select).toHaveProperty('last_updated');
        expect(callArg.select).toHaveProperty('live');
        expect(callArg.select).toHaveProperty('introduction_order');
        expect(callArg.select).toHaveProperty('points_max');
        expect(callArg.select).toHaveProperty('snapshots');
        expect(callArg.select).toHaveProperty('events');
    });

    test('returns null when no campaign found', async () => {
        vi.mocked(db.h1_season.findFirst).mockResolvedValue(null);

        const result = await getCampaign();

        expect(result).toBeNull();
    });

    test('throws when database query fails', async () => {
        vi.mocked(db.h1_season.findFirst).mockRejectedValue(new Error('connection lost'));

        await expect(getCampaign()).rejects.toThrow('connection lost');
    });
});
