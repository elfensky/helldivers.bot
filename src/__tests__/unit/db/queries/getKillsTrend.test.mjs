import { describe, test, expect, vi, beforeEach } from 'vitest';
import db from '@/db/db';
import { getKillsTrend } from '@/db/queries/getKillsTrend.mjs';

// getKillsTrend issues two $queryRaw snapshot calls via Promise.all, in source
// order: [0] the ~24h-ago bucket, [1] the ~48h-ago bucket. Feed each with
// mockResolvedValueOnce. kills come back as BigInt from Postgres.
beforeEach(() => {
    vi.mocked(db.$queryRaw).mockReset();
});

function seed(rows24h, rows48h = []) {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce(rows24h).mockResolvedValueOnce(rows48h);
}

describe('getKillsTrend', () => {
    test('returns null when there is no 24h-ago bucket yet', async () => {
        seed([], []);
        expect(await getKillsTrend(42)).toBeNull();
    });

    test('folds per-enemy rows into global + faction totals, BigInt cast to Number', async () => {
        seed([
            { enemy: 0, kills: 100n }, // bugs
            { enemy: 1, kills: 50n }, // cyborgs
        ]);
        const r = await getKillsTrend(42);
        expect(r.global.ago24h).toBe(150);
        expect(r.bugs.ago24h).toBe(100);
        expect(r.cyborgs.ago24h).toBe(50);
        // typeof Number, not BigInt
        expect(typeof r.global.ago24h).toBe('number');
        // illuminate absent from rows → null
        expect(r.illuminate.ago24h).toBeNull();
    });

    test('ago48h is null per faction when there is no 48h-ago bucket', async () => {
        seed([{ enemy: 0, kills: 100n }], []);
        const r = await getKillsTrend(42);
        expect(r.global.ago24h).toBe(100);
        expect(r.global.ago48h).toBeNull();
        expect(r.bugs.ago48h).toBeNull();
    });

    test('populates ago48h when the 48h-ago bucket exists', async () => {
        seed([{ enemy: 0, kills: 100n }], [{ enemy: 0, kills: 40n }]);
        const r = await getKillsTrend(42);
        expect(r.bugs.ago24h).toBe(100);
        expect(r.bugs.ago48h).toBe(40);
        expect(r.global.ago48h).toBe(40);
    });

    test('unknown enemy id is excluded from faction totals but still summed into global', async () => {
        seed([
            { enemy: 0, kills: 100n }, // bugs
            { enemy: 99, kills: 7n }, // unknown faction
        ]);
        const r = await getKillsTrend(42);
        expect(r.bugs.ago24h).toBe(100);
        expect(r.global.ago24h).toBe(107);
        expect(r.cyborgs.ago24h).toBeNull();
        expect(r.illuminate.ago24h).toBeNull();
    });
});
