import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertSeason } from '@/db/queries/upsertSeason.mjs';

describe('queryUpsertSeason', () => {
    test('upserts season without last_updated when complete is false', async () => {
        const mockRow = { season: 5 };
        vi.mocked(db.h1_season.upsert).mockResolvedValue(mockRow);

        const result = await queryUpsertSeason(5, false);

        expect(result).toHaveProperty('ms');
        expect(typeof result.ms).toBe('number');
        expect(result.query).toEqual(mockRow);
        expect(db.h1_season.upsert).toHaveBeenCalledWith({
            where: { season: 5 },
            update: {},
            create: { season: 5 },
        });
    });

    test('defaults complete to false', async () => {
        const mockRow = { season: 3 };
        vi.mocked(db.h1_season.upsert).mockResolvedValue(mockRow);

        await queryUpsertSeason(3);

        expect(db.h1_season.upsert).toHaveBeenCalledWith({
            where: { season: 3 },
            update: {},
            create: { season: 3 },
        });
    });

    test('upserts season with last_updated when complete is true', async () => {
        const mockRow = { season: 7, last_updated: new Date() };
        vi.mocked(db.h1_season.upsert).mockResolvedValue(mockRow);

        const before = new Date();
        const result = await queryUpsertSeason(7, true);
        const after = new Date();

        expect(result).toHaveProperty('ms');
        expect(result.query).toEqual(mockRow);

        const call = db.h1_season.upsert.mock.calls[0][0];
        expect(call.where).toEqual({ season: 7 });
        expect(call.update).toHaveProperty('last_updated');
        expect(call.create).toHaveProperty('last_updated');
        expect(call.create.season).toBe(7);

        // Verify the timestamp is reasonable
        const timestamp = call.update.last_updated;
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('throws when season is not a valid number', async () => {
        await expect(queryUpsertSeason('abc')).rejects.toThrow();
    });

    test('throws when season is negative', async () => {
        await expect(queryUpsertSeason(-1)).rejects.toThrow();
    });

    test('throws when season is zero', async () => {
        await expect(queryUpsertSeason(0)).rejects.toThrow();
    });

    test('throws when season is a float', async () => {
        await expect(queryUpsertSeason(1.5)).rejects.toThrow();
    });

    test('accepts a numeric string as season', async () => {
        const mockRow = { season: 10 };
        vi.mocked(db.h1_season.upsert).mockResolvedValue(mockRow);

        const result = await queryUpsertSeason('10', false);

        expect(result.query).toEqual(mockRow);
    });
});
