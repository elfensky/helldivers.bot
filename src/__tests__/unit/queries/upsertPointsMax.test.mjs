import { vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertPointsMax } from '@/db/queries/upsertPointsMax.mjs';

describe('queryUpsertPointsMax', () => {
    test('throws when season is missing', async () => {
        await expect(queryUpsertPointsMax(null, { bugs: 50000 })).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when points is missing', async () => {
        await expect(queryUpsertPointsMax(5, null)).rejects.toThrow('points is missing');
    });

    test('calls db.h1_points_max.upsert with correct args', async () => {
        const mockPoints = { bugs: 50000, cyborgs: 40000, illuminate: 30000 };
        const mockRecord = { season: 5, points: mockPoints };
        vi.mocked(db.h1_points_max.upsert).mockResolvedValue(mockRecord);

        const result = await queryUpsertPointsMax(5, mockPoints);

        expect(db.h1_points_max.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { season: 5 },
                update: { points: mockPoints },
                create: { season: 5, points: mockPoints },
            }),
        );
        expect(result).toHaveProperty('query', mockRecord);
        expect(result).toHaveProperty('ms');
    });

    test('propagates database errors', async () => {
        vi.mocked(db.h1_points_max.upsert).mockRejectedValue(new Error('disk full'));

        await expect(queryUpsertPointsMax(5, { bugs: 50000 })).rejects.toThrow('disk full');
    });
});
