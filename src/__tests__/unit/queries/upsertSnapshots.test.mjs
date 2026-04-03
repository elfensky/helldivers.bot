import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertSnapshots } from '@/db/queries/upsertSnapshots.mjs';

const validSnapshot = { season: 5, time: 1000, data: { foo: 'bar' } };
const crossSeasonSnapshot = { season: 3, time: 2000, data: {} };

describe('queryUpsertSnapshots', () => {
    test('throws when season is missing', async () => {
        await expect(queryUpsertSnapshots(null, [validSnapshot])).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when snapshots is missing', async () => {
        await expect(queryUpsertSnapshots(5, null)).rejects.toThrow(
            'snapshots are missing',
        );
    });

    test('skips snapshots with a different season', async () => {
        const result = await queryUpsertSnapshots(5, [crossSeasonSnapshot]);

        expect(db.h1_snapshot.upsert).not.toHaveBeenCalled();
        expect(result.query).toEqual([]);
        expect(typeof result.ms).toBe('number');
    });

    test('upserts matching snapshots and returns results array', async () => {
        const mockRecord = { id: 1, season: 5, time: 1000, data: { foo: 'bar' } };
        vi.mocked(db.h1_snapshot.upsert).mockResolvedValue(mockRecord);

        const result = await queryUpsertSnapshots(5, [validSnapshot]);

        expect(db.h1_snapshot.upsert).toHaveBeenCalledOnce();
        expect(db.h1_snapshot.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { season_time: { season: 5, time: 1000 } },
                update: { data: { foo: 'bar' } },
                create: { season: 5, time: 1000, data: { foo: 'bar' } },
            }),
        );
        expect(result.query).toEqual([mockRecord]);
        expect(typeof result.ms).toBe('number');
    });

    test('upserts multiple matching snapshots in order', async () => {
        const snap1 = { season: 5, time: 1000, data: { a: 1 } };
        const snap2 = { season: 5, time: 2000, data: { b: 2 } };
        const mockRecord1 = { id: 1, ...snap1 };
        const mockRecord2 = { id: 2, ...snap2 };

        vi.mocked(db.h1_snapshot.upsert)
            .mockResolvedValueOnce(mockRecord1)
            .mockResolvedValueOnce(mockRecord2);

        const result = await queryUpsertSnapshots(5, [snap1, crossSeasonSnapshot, snap2]);

        expect(db.h1_snapshot.upsert).toHaveBeenCalledTimes(2);
        expect(result.query).toEqual([mockRecord1, mockRecord2]);
    });

    test('propagates database errors', async () => {
        const dbError = new Error('DB connection failed');
        vi.mocked(db.h1_snapshot.upsert).mockRejectedValue(dbError);

        await expect(queryUpsertSnapshots(5, [validSnapshot])).rejects.toThrow(
            'DB connection failed',
        );
    });
});
