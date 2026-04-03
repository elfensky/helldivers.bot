import { vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertIntroductionOrder } from '@/db/queries/upsertIntroductionOrder.mjs';

describe('queryUpsertIntroductionOrder', () => {
    test('throws when season is missing', async () => {
        await expect(queryUpsertIntroductionOrder(null, [1, 2, 3])).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when order is missing', async () => {
        await expect(queryUpsertIntroductionOrder(5, null)).rejects.toThrow('order is missing');
    });

    test('calls db.h1_introduction_order.upsert with correct args', async () => {
        const mockOrder = [1, 2, 3];
        const mockRecord = { season: 5, order: mockOrder };
        vi.mocked(db.h1_introduction_order.upsert).mockResolvedValue(mockRecord);

        const result = await queryUpsertIntroductionOrder(5, mockOrder);

        expect(db.h1_introduction_order.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { season: 5 },
                update: { order: mockOrder },
                create: { season: 5, order: mockOrder },
            }),
        );
        expect(result).toHaveProperty('query', mockRecord);
        expect(result).toHaveProperty('ms');
    });

    test('propagates database errors', async () => {
        vi.mocked(db.h1_introduction_order.upsert).mockRejectedValue(
            new Error('serialization failure'),
        );

        await expect(queryUpsertIntroductionOrder(5, [1, 2])).rejects.toThrow(
            'serialization failure',
        );
    });
});
