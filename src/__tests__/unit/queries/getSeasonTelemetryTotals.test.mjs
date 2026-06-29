import { describe, test, expect, vi, beforeEach } from 'vitest';
import db from '@/db/db';
import { getSeasonTelemetryTotals } from '@/db/queries/getSeasonTelemetryTotals.mjs';

// The query is a single $queryRaw (GROUP BY over the latest bucket per enemy);
// the global db mock from vitest.setup.mjs makes $queryRaw mockable.
beforeEach(() => {
    vi.mocked(db.$queryRaw).mockReset();
});

describe('getSeasonTelemetryTotals', () => {
    test('returns null when the season has no telemetry rows', async () => {
        vi.mocked(db.$queryRaw).mockResolvedValueOnce([]);
        expect(await getSeasonTelemetryTotals(155)).toBeNull();
    });

    test('narrows BigInt fields and shapes the totals', async () => {
        vi.mocked(db.$queryRaw).mockResolvedValueOnce([
            {
                kills: 1234567n,
                accidentals: 8910n,
                missions: 4200,
                completed_planets: 17,
                total_unique_players: 95000,
            },
        ]);
        const r = await getSeasonTelemetryTotals(157);
        expect(r).toEqual({
            kills: 1234567,
            accidentals: 8910,
            missions: 4200,
            completed_planets: 17,
            total_unique_players: 95000,
        });
        expect(typeof r.kills).toBe('number'); // not bigint
    });
});
