import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryCreateLiveSnapshots } from '@/db/queries/createLiveSnapshots.mjs';

const mockStats = [
    {
        enemy: 0,
        season_duration: 100,
        players: 50,
        total_unique_players: 200,
        missions: 10,
        successful_missions: 8,
        total_mission_difficulty: 30,
        completed_planets: 2,
        defend_events: 3,
        successful_defend_events: 2,
        attack_events: 1,
        successful_attack_events: 1,
        deaths: 500,
        kills: 1000,
        accidentals: 50,
        shots: 5000,
        hits: 3000,
    },
    {
        enemy: 1,
        season_duration: 100,
        players: 40,
        total_unique_players: 180,
        missions: 8,
        successful_missions: 6,
        total_mission_difficulty: 25,
        completed_planets: 1,
        defend_events: 2,
        successful_defend_events: 1,
        attack_events: 2,
        successful_attack_events: 1,
        deaths: 400,
        kills: 800,
        accidentals: 40,
        shots: 4000,
        hits: 2500,
    },
    {
        enemy: 2,
        season_duration: 100,
        players: 30,
        total_unique_players: 150,
        missions: 6,
        successful_missions: 4,
        total_mission_difficulty: 20,
        completed_planets: 1,
        defend_events: 1,
        successful_defend_events: 1,
        attack_events: 1,
        successful_attack_events: 0,
        deaths: 300,
        kills: 600,
        accidentals: 30,
        shots: 3000,
        hits: 2000,
    },
];

describe('queryCreateLiveSnapshots', () => {
    test('throws when season is missing', async () => {
        await expect(queryCreateLiveSnapshots(null, 1000, mockStats)).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when time is missing', async () => {
        await expect(queryCreateLiveSnapshots(5, null, mockStats)).rejects.toThrow(
            'time is missing',
        );
    });

    test('throws when statistics is missing', async () => {
        await expect(queryCreateLiveSnapshots(5, 1000, null)).rejects.toThrow(
            'statistics are missing',
        );
    });

    test('processes all 3 enemy factions', async () => {
        const mockRecords = mockStats.map((s, i) => ({
            id: i + 1,
            season: 5,
            enemy: s.enemy,
            time: 1000,
        }));
        vi.mocked(db.h1_live_snapshot.upsert)
            .mockResolvedValueOnce(mockRecords[0])
            .mockResolvedValueOnce(mockRecords[1])
            .mockResolvedValueOnce(mockRecords[2]);

        const result = await queryCreateLiveSnapshots(5, 1000, mockStats);

        expect(db.h1_live_snapshot.upsert).toHaveBeenCalledTimes(3);
        expect(result.query).toEqual(mockRecords);
        expect(typeof result.ms).toBe('number');
    });

    test('upsert is called with correct shape for each stat entry', async () => {
        vi.mocked(db.h1_live_snapshot.upsert).mockResolvedValue({});

        await queryCreateLiveSnapshots(5, 1000, [mockStats[0]]);

        const { enemy, ...snapshotFields } = mockStats[0];
        expect(db.h1_live_snapshot.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    season_enemy_time: { season: 5, enemy: 0, time: 1000 },
                },
                update: snapshotFields,
                create: expect.objectContaining({
                    season: 5,
                    time: 1000,
                    enemy: 0,
                    players: 50,
                    kills: 1000,
                    deaths: 500,
                }),
            }),
        );
    });

    test('propagates database errors', async () => {
        const dbError = new Error('Connection timeout');
        vi.mocked(db.h1_live_snapshot.upsert).mockRejectedValue(dbError);

        await expect(queryCreateLiveSnapshots(5, 1000, mockStats)).rejects.toThrow(
            'Connection timeout',
        );
    });
});
