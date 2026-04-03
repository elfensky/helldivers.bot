import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryCreateEventSnapshot } from '@/db/queries/createEventSnapshots.mjs';

const validEvent = { season: 5, event_id: 42, points: 100, points_max: 500 };

describe('queryCreateEventSnapshot', () => {
    test('throws when season is missing', async () => {
        await expect(
            queryCreateEventSnapshot(null, 'defend', validEvent, 1000),
        ).rejects.toThrow('season is missing');
    });

    test('throws when type is missing', async () => {
        await expect(queryCreateEventSnapshot(5, null, validEvent, 1000)).rejects.toThrow(
            'type is missing',
        );
    });

    test('throws when event is missing', async () => {
        await expect(queryCreateEventSnapshot(5, 'defend', null, 1000)).rejects.toThrow(
            'event is missing',
        );
    });

    test('throws when time is missing', async () => {
        await expect(
            queryCreateEventSnapshot(5, 'defend', validEvent, null),
        ).rejects.toThrow('time is missing');
    });

    test('returns skipped result for cross-season events', async () => {
        const crossSeasonEvent = { season: 3, event_id: 10, points: 50, points_max: 200 };

        const result = await queryCreateEventSnapshot(
            5,
            'attack',
            crossSeasonEvent,
            1000,
        );

        expect(result.skipped).toBe(true);
        expect(result.query).toBeNull();
        expect(db.h1_event_snapshot.upsert).not.toHaveBeenCalled();
    });

    test('upserts event snapshot and returns result', async () => {
        const mockRecord = {
            id: 1,
            season: 5,
            type: 'defend',
            event_id: 42,
            time: 1000,
            points: 100,
            points_max: 500,
        };
        vi.mocked(db.h1_event_snapshot.upsert).mockResolvedValue(mockRecord);

        const result = await queryCreateEventSnapshot(5, 'defend', validEvent, 1000);

        expect(db.h1_event_snapshot.upsert).toHaveBeenCalledOnce();
        expect(db.h1_event_snapshot.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    type_event_id_time: { type: 'defend', event_id: 42, time: 1000 },
                },
                update: { points: 100, points_max: 500 },
                create: {
                    season: 5,
                    type: 'defend',
                    event_id: 42,
                    time: 1000,
                    points: 100,
                    points_max: 500,
                },
            }),
        );
        expect(result.query).toEqual(mockRecord);
        expect(typeof result.ms).toBe('number');
    });

    test('propagates database errors', async () => {
        const dbError = new Error('Unique constraint violation');
        vi.mocked(db.h1_event_snapshot.upsert).mockRejectedValue(dbError);

        await expect(
            queryCreateEventSnapshot(5, 'defend', validEvent, 1000),
        ).rejects.toThrow('Unique constraint violation');
    });
});
