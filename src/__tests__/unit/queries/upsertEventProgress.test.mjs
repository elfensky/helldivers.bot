import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { upsertEventProgress } from '@/db/queries/upsertEventProgress.mjs';

const SEASON = 5;
const baseEvent = {
    event_id: 42,
    points: 50,
    points_max: 100,
    status: 'active',
    season: SEASON,
};

describe('upsertEventProgress', () => {
    test('throws when season is missing', async () => {
        await expect(
            upsertEventProgress(null, 'defend', baseEvent, 1000),
        ).rejects.toThrow('season is missing');
    });

    test('throws when type is missing', async () => {
        await expect(upsertEventProgress(SEASON, null, baseEvent, 1000)).rejects.toThrow(
            'type is missing',
        );
    });

    test('throws when event is missing', async () => {
        await expect(upsertEventProgress(SEASON, 'defend', null, 1000)).rejects.toThrow(
            'event is missing',
        );
    });

    test('throws when pollTime is missing', async () => {
        await expect(
            upsertEventProgress(SEASON, 'defend', baseEvent, null),
        ).rejects.toThrow('pollTime is missing');
    });

    test('skips cross-season events', async () => {
        const otherSeasonEvent = { ...baseEvent, season: SEASON - 1 };
        const result = await upsertEventProgress(
            SEASON,
            'defend',
            otherSeasonEvent,
            1000,
        );

        expect(result).toEqual({ ms: 0, query: null, skipped: true });
        expect(db.h1_event_progress.upsert).not.toHaveBeenCalled();
    });

    test('computes bucket from pollTime', async () => {
        vi.mocked(db.h1_event_progress.upsert).mockResolvedValue({ id: 'a' });
        await upsertEventProgress(SEASON, 'defend', baseEvent, 1800);

        const callArg = vi.mocked(db.h1_event_progress.upsert).mock.calls[0][0];
        expect(callArg.where.type_event_id_bucket.bucket).toBe(1800);
    });

    test('update path writes only time + points', async () => {
        vi.mocked(db.h1_event_progress.upsert).mockResolvedValue({ id: 'a' });
        await upsertEventProgress(SEASON, 'defend', baseEvent, 1000);

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
        await upsertEventProgress(SEASON, 'attack', { ...baseEvent, event_id: 7 }, 1000);

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
        await expect(
            upsertEventProgress(SEASON, 'defend', baseEvent, 1000),
        ).rejects.toThrow('db boom');
    });
});
