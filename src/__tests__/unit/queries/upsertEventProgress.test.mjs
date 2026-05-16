import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertEventProgress } from '@/db/queries/upsertEventProgress.mjs';

const baseEvent = {
    event_id: 42,
    points: 50,
    points_max: 100,
    status: 'active',
    season: 5,
};

describe('queryUpsertEventProgress', () => {
    test('throws when type is missing', async () => {
        await expect(queryUpsertEventProgress(null, baseEvent, 1000)).rejects.toThrow(
            'type is missing',
        );
    });

    test('throws when event is missing', async () => {
        await expect(queryUpsertEventProgress('defend', null, 1000)).rejects.toThrow(
            'event is missing',
        );
    });

    test('throws when pollTime is missing', async () => {
        await expect(queryUpsertEventProgress('defend', baseEvent, null)).rejects.toThrow(
            'pollTime is missing',
        );
    });

    test('computes bucket from pollTime', async () => {
        vi.mocked(db.h1_event_progress.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertEventProgress('defend', baseEvent, 1800);

        const callArg = vi.mocked(db.h1_event_progress.upsert).mock.calls[0][0];
        expect(callArg.where.type_event_id_bucket.bucket).toBe(1800);
    });

    test('update path writes only time + points', async () => {
        vi.mocked(db.h1_event_progress.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertEventProgress('defend', baseEvent, 1000);

        const callArg = vi.mocked(db.h1_event_progress.upsert).mock.calls[0][0];
        expect(callArg.update).toEqual({
            time: 1000,
            points: 50,
        });
        // points_max is NOT stored — constant, lives on h1_event
        expect(callArg.update).not.toHaveProperty('points_max');
        // status is NOT stored — lives on h1_event (final state)
        expect(callArg.update).not.toHaveProperty('status');
    });

    test('create path sets type, event_id, bucket, time, points', async () => {
        vi.mocked(db.h1_event_progress.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertEventProgress('attack', { ...baseEvent, event_id: 7 }, 1000);

        const callArg = vi.mocked(db.h1_event_progress.upsert).mock.calls[0][0];
        expect(callArg.create).toEqual({
            type: 'attack',
            event_id: 7,
            bucket: 900,
            time: 1000,
            points: 50,
        });
    });

    test('propagates DB errors', async () => {
        vi.mocked(db.h1_event_progress.upsert).mockRejectedValue(new Error('db boom'));
        await expect(queryUpsertEventProgress('defend', baseEvent, 1000)).rejects.toThrow(
            'db boom',
        );
    });
});
