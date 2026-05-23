import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/queries/getCrossSeasonStats.mjs', () => ({
    getCrossSeasonStats: vi.fn(),
}));

import { getWarTone } from '@/features/ministry/warTone.mjs';
import { getCrossSeasonStats } from '@/db/queries/getCrossSeasonStats.mjs';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getWarTone', () => {
    test('returns null when getCrossSeasonStats throws (DB error)', async () => {
        getCrossSeasonStats.mockRejectedValueOnce(new Error('DB down'));
        await expect(getWarTone()).resolves.toBeNull();
    });

    test('returns null when no completed wars exist', async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'unknown' },
                { season: 2, outcome: 'unknown' },
            ],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBeNull();
    });

    test('returns null when perSeason is empty', async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBeNull();
    });

    test("returns 'winning' when wonCount / completedCount >= 0.5", async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'victory' },
                { season: 2, outcome: 'victory' },
                { season: 3, outcome: 'defeat' },
                { season: 4, outcome: 'unknown' }, // excluded
            ],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBe('winning');
    });

    test("returns 'losing' when wonCount / completedCount < 0.5", async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'defeat' },
                { season: 2, outcome: 'defeat' },
                { season: 3, outcome: 'victory' },
            ],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBe('losing');
    });

    test('exactly 50% wins is winning (>= 0.5)', async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'victory' },
                { season: 2, outcome: 'defeat' },
            ],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBe('winning');
    });

    test("ignores 'unknown' outcomes when counting", async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'unknown' },
                { season: 2, outcome: 'unknown' },
                { season: 3, outcome: 'victory' },
            ],
            factionTotals: [],
        });
        // 1/1 = 100% completed wins → winning
        await expect(getWarTone()).resolves.toBe('winning');
    });
});
