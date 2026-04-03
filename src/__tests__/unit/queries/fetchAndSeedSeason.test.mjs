import { describe, it, expect, vi } from 'vitest';
import db from '@/db/db';
import { fetchSeason } from '@/update/fetch';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { fetchAndSeedSeason } from '@/db/queries/fetchAndSeedSeason';
import { EVENT_TYPE } from '@/enums/events';

vi.mock('@/update/fetch', () => ({ fetchSeason: vi.fn() }));
vi.mock('@/db/queries/upsertSeason', () => ({ queryUpsertSeason: vi.fn() }));

const mockDefendEvent = {
    event_id: 1,
    season: 5,
    start_time: 100,
    end_time: 200,
    region: 3,
    enemy: 0,
    points_max: 1000,
    points: 500,
    status: 'success',
    players_at_start: 10,
};

const mockAttackEvent = {
    event_id: 2,
    season: 5,
    start_time: 100,
    end_time: 200,
    region: 11,
    enemy: 1,
    points_max: 2000,
    points: 1000,
    status: 'active',
    players_at_start: 20,
};

const mockSnapshot = {
    season: 5,
    time: 1000,
    data: '{"test": true}',
};

const mockSeasonData = {
    introduction_order: [0, 1, 2],
    points_max: [100, 200, 300],
    defend_events: [mockDefendEvent],
    attack_events: [mockAttackEvent],
    snapshots: [mockSnapshot],
};

describe('fetchAndSeedSeason', () => {
    it('throws when fetchSeason fails', async () => {
        vi.mocked(fetchSeason).mockRejectedValue(new Error('API down'));

        await expect(fetchAndSeedSeason(5)).rejects.toThrow('API down');
        expect(vi.mocked(queryUpsertSeason)).not.toHaveBeenCalled();
    });

    it('returns early with no DB calls when response has no data', async () => {
        vi.mocked(fetchSeason).mockResolvedValue({
            snapshots: [],
            defend_events: [],
            attack_events: [],
        });

        await fetchAndSeedSeason(5);

        expect(vi.mocked(queryUpsertSeason)).not.toHaveBeenCalled();
        expect(vi.mocked(db.h1_event.upsert)).not.toHaveBeenCalled();
        expect(vi.mocked(db.h1_snapshot.upsert)).not.toHaveBeenCalled();
    });

    it('returns early when response is null/undefined', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(null);

        await fetchAndSeedSeason(5);

        expect(vi.mocked(queryUpsertSeason)).not.toHaveBeenCalled();
    });

    it('upserts season row', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockSeasonData);

        await fetchAndSeedSeason(5);

        expect(vi.mocked(queryUpsertSeason)).toHaveBeenCalledWith(5);
    });

    it('upserts introduction_order when present', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockSeasonData);

        await fetchAndSeedSeason(5);

        expect(vi.mocked(db.h1_introduction_order.upsert)).toHaveBeenCalledWith({
            where: { season: 5 },
            update: { order: [0, 1, 2] },
            create: { season: 5, order: [0, 1, 2] },
        });
    });

    it('upserts points_max when present', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockSeasonData);

        await fetchAndSeedSeason(5);

        expect(vi.mocked(db.h1_points_max.upsert)).toHaveBeenCalledWith({
            where: { season: 5 },
            update: { points: [100, 200, 300] },
            create: { season: 5, points: [100, 200, 300] },
        });
    });

    it('skips introduction_order when null', async () => {
        vi.mocked(fetchSeason).mockResolvedValue({
            ...mockSeasonData,
            introduction_order: null,
        });

        await fetchAndSeedSeason(5);

        expect(vi.mocked(db.h1_introduction_order.upsert)).not.toHaveBeenCalled();
    });

    it('skips points_max when null', async () => {
        vi.mocked(fetchSeason).mockResolvedValue({
            ...mockSeasonData,
            points_max: null,
        });

        await fetchAndSeedSeason(5);

        expect(vi.mocked(db.h1_points_max.upsert)).not.toHaveBeenCalled();
    });

    it('upserts defend events filtered by season', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockSeasonData);

        await fetchAndSeedSeason(5);

        expect(vi.mocked(db.h1_event.upsert)).toHaveBeenCalledWith({
            where: {
                type_event_id: { type: EVENT_TYPE.DEFEND, event_id: 1 },
            },
            update: {
                season: 5,
                start_time: 100,
                end_time: 200,
                region: 3,
                enemy: 0,
                points_max: 1000,
                points: 500,
                status: 'success',
                players_at_start: 10,
            },
            create: {
                season: 5,
                type: EVENT_TYPE.DEFEND,
                event_id: 1,
                start_time: 100,
                end_time: 200,
                region: 3,
                enemy: 0,
                points_max: 1000,
                points: 500,
                status: 'success',
                players_at_start: 10,
            },
        });
    });

    it('upserts attack events with region set to 11', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockSeasonData);

        await fetchAndSeedSeason(5);

        expect(vi.mocked(db.h1_event.upsert)).toHaveBeenCalledWith({
            where: {
                type_event_id: { type: EVENT_TYPE.ATTACK, event_id: 2 },
            },
            update: {
                season: 5,
                start_time: 100,
                end_time: 200,
                region: 11,
                enemy: 1,
                points_max: 2000,
                points: 1000,
                status: 'active',
                players_at_start: 20,
            },
            create: {
                season: 5,
                type: EVENT_TYPE.ATTACK,
                event_id: 2,
                start_time: 100,
                end_time: 200,
                region: 11,
                enemy: 1,
                points_max: 2000,
                points: 1000,
                status: 'active',
                players_at_start: 20,
            },
        });
    });

    it('filters out events from different seasons', async () => {
        const wrongSeasonEvent = { ...mockDefendEvent, season: 99, event_id: 99 };
        vi.mocked(fetchSeason).mockResolvedValue({
            ...mockSeasonData,
            defend_events: [mockDefendEvent, wrongSeasonEvent],
            attack_events: [mockAttackEvent, { ...mockAttackEvent, season: 99, event_id: 99 }],
        });

        await fetchAndSeedSeason(5);

        // Should only upsert events matching season 5 (one defend + one attack)
        expect(vi.mocked(db.h1_event.upsert)).toHaveBeenCalledTimes(2);
        const calls = vi.mocked(db.h1_event.upsert).mock.calls;
        expect(calls[0][0].create.event_id).toBe(1);
        expect(calls[1][0].create.event_id).toBe(2);
    });

    it('upserts snapshots and parses JSON string data', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockSeasonData);

        await fetchAndSeedSeason(5);

        expect(vi.mocked(db.h1_snapshot.upsert)).toHaveBeenCalledWith({
            where: { season_time: { season: 5, time: 1000 } },
            update: { data: { test: true } },
            create: { season: 5, time: 1000, data: { test: true } },
        });
    });

    it('handles snapshot data that is already an object', async () => {
        vi.mocked(fetchSeason).mockResolvedValue({
            ...mockSeasonData,
            snapshots: [{ season: 5, time: 1000, data: { already: 'parsed' } }],
        });

        await fetchAndSeedSeason(5);

        expect(vi.mocked(db.h1_snapshot.upsert)).toHaveBeenCalledWith({
            where: { season_time: { season: 5, time: 1000 } },
            update: { data: { already: 'parsed' } },
            create: { season: 5, time: 1000, data: { already: 'parsed' } },
        });
    });

    it('happy path: processes full season data end-to-end', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockSeasonData);

        await fetchAndSeedSeason(5);

        // Season upserted
        expect(vi.mocked(queryUpsertSeason)).toHaveBeenCalledWith(5);
        expect(vi.mocked(queryUpsertSeason)).toHaveBeenCalledTimes(1);

        // Meta upserted
        expect(vi.mocked(db.h1_introduction_order.upsert)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(db.h1_points_max.upsert)).toHaveBeenCalledTimes(1);

        // Events upserted (1 defend + 1 attack)
        expect(vi.mocked(db.h1_event.upsert)).toHaveBeenCalledTimes(2);

        // Snapshots upserted
        expect(vi.mocked(db.h1_snapshot.upsert)).toHaveBeenCalledTimes(1);
    });
});
