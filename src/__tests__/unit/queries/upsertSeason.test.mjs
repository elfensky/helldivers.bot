import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertSeason } from '@/db/queries/upsertSeason.mjs';

describe('queryUpsertSeason', () => {
    test('upserts season without last_updated when confirm is false', async () => {
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

    test('defaults confirm to false', async () => {
        const mockRow = { season: 3 };
        vi.mocked(db.h1_season.upsert).mockResolvedValue(mockRow);

        await queryUpsertSeason(3);

        expect(db.h1_season.upsert).toHaveBeenCalledWith({
            where: { season: 3 },
            update: {},
            create: { season: 3 },
        });
    });

    test('upserts season with last_updated when confirm is true', async () => {
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

    test('upserts season without arrays (initial call)', async () => {
        vi.mocked(db.h1_season.upsert).mockResolvedValue({ season: 5 });
        await queryUpsertSeason(5, false);

        const callArg = vi.mocked(db.h1_season.upsert).mock.calls[0][0];
        expect(callArg.where.season).toBe(5);
        // No array updates when not provided
        expect(callArg.update).not.toHaveProperty('introduction_order');
        expect(callArg.update).not.toHaveProperty('points_max');
    });

    test('upserts season with intro_order + points_max arrays', async () => {
        vi.mocked(db.h1_season.upsert).mockResolvedValue({ season: 5 });
        await queryUpsertSeason(5, false, {
            introOrder: [2, 1, 0],
            pointsMax: [30000, 30000, 30000],
        });

        const callArg = vi.mocked(db.h1_season.upsert).mock.calls[0][0];
        expect(callArg.update.introduction_order).toEqual([2, 1, 0]);
        expect(callArg.update.points_max).toEqual([30000, 30000, 30000]);
        expect(callArg.create.introduction_order).toEqual([2, 1, 0]);
        expect(callArg.create.points_max).toEqual([30000, 30000, 30000]);
    });

    test('confirm=true sets last_updated to now', async () => {
        vi.mocked(db.h1_season.upsert).mockResolvedValue({ season: 5 });
        const before = Date.now();
        await queryUpsertSeason(5, true);
        const after = Date.now();

        const callArg = vi.mocked(db.h1_season.upsert).mock.calls[0][0];
        expect(callArg.update.last_updated).toBeInstanceOf(Date);
        const t = callArg.update.last_updated.getTime();
        expect(t).toBeGreaterThanOrEqual(before);
        expect(t).toBeLessThanOrEqual(after);
    });

    test('throws when season is missing', async () => {
        await expect(queryUpsertSeason(null, false)).rejects.toThrow('season is missing');
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

    test('confirm=true with arrays simultaneously sets both last_updated and arrays', async () => {
        vi.mocked(db.h1_season.upsert).mockResolvedValue({ season: 5 });
        await queryUpsertSeason(5, true, {
            introOrder: [2, 1, 0],
            pointsMax: [30000, 30000, 30000],
            seasonDuration: 54321,
        });

        const callArg = vi.mocked(db.h1_season.upsert).mock.calls[0][0];
        expect(callArg.update.last_updated).toBeInstanceOf(Date);
        expect(callArg.update.introduction_order).toEqual([2, 1, 0]);
        expect(callArg.update.points_max).toEqual([30000, 30000, 30000]);
        expect(callArg.update.season_duration).toBe(54321);
        expect(callArg.create.last_updated).toBeInstanceOf(Date);
        expect(callArg.create.introduction_order).toEqual([2, 1, 0]);
        expect(callArg.create.points_max).toEqual([30000, 30000, 30000]);
        expect(callArg.create.season_duration).toBe(54321);
    });

    test('upserts season with seasonDuration metadata', async () => {
        vi.mocked(db.h1_season.upsert).mockResolvedValue({ season: 5 });
        await queryUpsertSeason(5, false, { seasonDuration: 12345 });

        const callArg = vi.mocked(db.h1_season.upsert).mock.calls[0][0];
        // seasonDuration flows through both update and create paths.
        expect(callArg.update.season_duration).toBe(12345);
        expect(callArg.create.season_duration).toBe(12345);
        // Other metadata fields stay absent when not provided.
        expect(callArg.update).not.toHaveProperty('introduction_order');
        expect(callArg.update).not.toHaveProperty('points_max');
    });
});
