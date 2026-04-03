import { vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertEvent } from '@/db/queries/upsertEvent.mjs';

const mockEvent = {
    season: 5,
    event_id: 42,
    start_time: '2025-01-01T00:00:00Z',
    end_time: '2025-01-02T00:00:00Z',
    region: 3,
    enemy: 1,
    points_max: 50000,
    points: 12000,
    status: 'active',
    players_at_start: 1500,
};

describe('queryUpsertEvent', () => {
    test('throws when season is missing', async () => {
        await expect(queryUpsertEvent(null, 'defend', mockEvent)).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when type is missing', async () => {
        await expect(queryUpsertEvent(5, null, mockEvent)).rejects.toThrow('type is missing');
    });

    test('throws when event is missing', async () => {
        await expect(queryUpsertEvent(5, 'defend', null)).rejects.toThrow('event is missing');
    });

    test('returns skipped when event season differs from provided season', async () => {
        const crossSeasonEvent = { ...mockEvent, season: 4 };
        const result = await queryUpsertEvent(5, 'defend', crossSeasonEvent);

        expect(result).toEqual({ ms: 0, query: null, skipped: true });
        expect(db.h1_event.upsert).not.toHaveBeenCalled();
    });

    test('calls db.h1_event.upsert with correct where clause and data', async () => {
        const mockRecord = { id: 1, ...mockEvent, type: 'defend' };
        vi.mocked(db.h1_event.upsert).mockResolvedValue(mockRecord);

        const result = await queryUpsertEvent(5, 'defend', mockEvent);

        expect(db.h1_event.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    type_event_id: {
                        type: 'defend',
                        event_id: 42,
                    },
                },
            }),
        );
        expect(result).toHaveProperty('query', mockRecord);
        expect(result).toHaveProperty('ms');
    });

    test('defaults players_at_start to null when not provided', async () => {
        const eventWithoutPlayers = { ...mockEvent, players_at_start: undefined };
        vi.mocked(db.h1_event.upsert).mockResolvedValue({});

        await queryUpsertEvent(5, 'defend', eventWithoutPlayers);

        const callArg = db.h1_event.upsert.mock.calls[0][0];
        expect(callArg.update.players_at_start).toBeNull();
        expect(callArg.create.players_at_start).toBeNull();
    });

    test('propagates database errors', async () => {
        vi.mocked(db.h1_event.upsert).mockRejectedValue(new Error('unique constraint violated'));

        await expect(queryUpsertEvent(5, 'defend', mockEvent)).rejects.toThrow(
            'unique constraint violated',
        );
    });
});
