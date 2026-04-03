import { vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertLive } from '@/db/queries/upsertLive.mjs';

const mockCampaign = {
    points: 10000,
    points_taken: 3000,
    points_max: 50000,
    status: 'active',
    introduction_order: 1,
};

const mockStats = {
    season_duration: 86400,
    players: 500,
    total_unique_players: 2000,
    missions: 15000,
    successful_missions: 12000,
    total_mission_difficulty: 45000,
    completed_planets: 3,
    defend_events: 10,
    successful_defend_events: 7,
    attack_events: 5,
    successful_attack_events: 4,
    deaths: 90000,
    kills: 500000,
    accidentals: 5000,
    shots: 2000000,
    hits: 1200000,
};

describe('queryUpsertLive', () => {
    test('throws when season is missing', async () => {
        await expect(queryUpsertLive(null, 1, mockCampaign, mockStats)).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when enemy is undefined', async () => {
        await expect(
            queryUpsertLive(5, undefined, mockCampaign, mockStats),
        ).rejects.toThrow('enemy is missing');
    });

    test('throws when enemy is null', async () => {
        await expect(queryUpsertLive(5, null, mockCampaign, mockStats)).rejects.toThrow(
            'enemy is missing',
        );
    });

    test('throws when campaign is missing', async () => {
        await expect(queryUpsertLive(5, 1, null, mockStats)).rejects.toThrow(
            'campaign is missing',
        );
    });

    test('throws when stats is missing', async () => {
        await expect(queryUpsertLive(5, 1, mockCampaign, null)).rejects.toThrow(
            'stats is missing',
        );
    });

    test('calls db.h1_live.upsert with correct payload', async () => {
        const mockRecord = { id: 1, season: 5, enemy: 1 };
        const mockFactionMap = { sectors: [1] };
        vi.mocked(db.h1_live.upsert).mockResolvedValue(mockRecord);

        const result = await queryUpsertLive(
            5,
            1,
            mockCampaign,
            mockStats,
            mockFactionMap,
        );

        const expectedFields = {
            points: mockCampaign.points,
            points_taken: mockCampaign.points_taken,
            points_max: mockCampaign.points_max,
            status: mockCampaign.status,
            introduction_order: mockCampaign.introduction_order,
            season_duration: mockStats.season_duration,
            players: mockStats.players,
            total_unique_players: mockStats.total_unique_players,
            missions: mockStats.missions,
            successful_missions: mockStats.successful_missions,
            total_mission_difficulty: mockStats.total_mission_difficulty,
            completed_planets: mockStats.completed_planets,
            defend_events: mockStats.defend_events,
            successful_defend_events: mockStats.successful_defend_events,
            attack_events: mockStats.attack_events,
            successful_attack_events: mockStats.successful_attack_events,
            deaths: mockStats.deaths,
            kills: mockStats.kills,
            accidentals: mockStats.accidentals,
            shots: mockStats.shots,
            hits: mockStats.hits,
            map: mockFactionMap,
        };

        const callArg = db.h1_live.upsert.mock.calls[0][0];
        expect(callArg.where).toEqual({
            season_enemy: { season: 5, enemy: 1 },
        });
        expect(callArg.update).toEqual(expectedFields);
        expect(callArg.create).toEqual({
            season: 5,
            enemy: 1,
            ...expectedFields,
        });
        expect(result).toHaveProperty('query', mockRecord);
        expect(result).toHaveProperty('ms');
    });

    test('accepts enemy value of 0 (falsy but valid)', async () => {
        vi.mocked(db.h1_live.upsert).mockResolvedValue({});

        const result = await queryUpsertLive(5, 0, mockCampaign, mockStats);

        expect(db.h1_live.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { season_enemy: { season: 5, enemy: 0 } },
            }),
        );
        expect(result).toHaveProperty('query');
    });

    test('defaults factionMap to null when not provided', async () => {
        vi.mocked(db.h1_live.upsert).mockResolvedValue({});

        await queryUpsertLive(5, 1, mockCampaign, mockStats);

        const callArg = db.h1_live.upsert.mock.calls[0][0];
        expect(callArg.update.map).toBeNull();
        expect(callArg.create.map).toBeNull();
    });

    test('propagates database errors', async () => {
        vi.mocked(db.h1_live.upsert).mockRejectedValue(new Error('connection refused'));

        await expect(queryUpsertLive(5, 1, mockCampaign, mockStats)).rejects.toThrow(
            'connection refused',
        );
    });
});
