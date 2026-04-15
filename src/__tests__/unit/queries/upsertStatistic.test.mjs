import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertStatistic } from '@/db/queries/upsertStatistic.mjs';

const baseStats = {
    players: 1250,
    total_unique_players: 8400,
    kills: 500000n,
    deaths: 120000n,
    season_duration: 100,
    missions: 500,
    successful_missions: 450,
    total_mission_difficulty: 2500,
    completed_planets: 3,
    defend_events: 10,
    successful_defend_events: 8,
    attack_events: 4,
    successful_attack_events: 2,
    accidentals: 500n,
    shots: 2000000n,
    hits: 1500000n,
};

describe('queryUpsertStatistic', () => {
    test('throws when season is missing', async () => {
        await expect(queryUpsertStatistic(null, 0, 1000, baseStats)).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when pollTime is missing', async () => {
        await expect(queryUpsertStatistic(5, 0, null, baseStats)).rejects.toThrow(
            'pollTime is missing',
        );
    });

    test('throws when stats is missing', async () => {
        await expect(queryUpsertStatistic(5, 0, 1000, null)).rejects.toThrow(
            'stats is missing',
        );
    });

    test('accepts enemy=0', async () => {
        vi.mocked(db.h1_statistic.upsert).mockResolvedValue({ id: 'a' });
        await expect(queryUpsertStatistic(5, 0, 1000, baseStats)).resolves.toBeDefined();
    });

    test('computes bucket from pollTime', async () => {
        vi.mocked(db.h1_statistic.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatistic(5, 1, 1800, baseStats);

        const callArg = vi.mocked(db.h1_statistic.upsert).mock.calls[0][0];
        // floor(1800 / 900) * 900 = 1800
        expect(callArg.where.season_enemy_bucket.bucket).toBe(1800);
    });

    test('update path writes all 16 stats fields + time', async () => {
        vi.mocked(db.h1_statistic.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatistic(5, 0, 1000, baseStats);

        const callArg = vi.mocked(db.h1_statistic.upsert).mock.calls[0][0];
        expect(callArg.update).toEqual({
            time: 1000,
            season_duration: 100,
            players: 1250,
            total_unique_players: 8400,
            missions: 500,
            successful_missions: 450,
            total_mission_difficulty: 2500,
            completed_planets: 3,
            defend_events: 10,
            successful_defend_events: 8,
            attack_events: 4,
            successful_attack_events: 2,
            deaths: 120000n,
            kills: 500000n,
            accidentals: 500n,
            shots: 2000000n,
            hits: 1500000n,
        });
    });

    test('create path includes season, enemy, bucket + all 16 stats fields', async () => {
        vi.mocked(db.h1_statistic.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatistic(5, 2, 1000, baseStats);

        const callArg = vi.mocked(db.h1_statistic.upsert).mock.calls[0][0];
        expect(callArg.create).toEqual({
            season: 5,
            enemy: 2,
            bucket: 900,
            time: 1000,
            season_duration: 100,
            players: 1250,
            total_unique_players: 8400,
            missions: 500,
            successful_missions: 450,
            total_mission_difficulty: 2500,
            completed_planets: 3,
            defend_events: 10,
            successful_defend_events: 8,
            attack_events: 4,
            successful_attack_events: 2,
            deaths: 120000n,
            kills: 500000n,
            accidentals: 500n,
            shots: 2000000n,
            hits: 1500000n,
        });
    });

    test('propagates DB errors', async () => {
        vi.mocked(db.h1_statistic.upsert).mockRejectedValue(new Error('db boom'));
        await expect(queryUpsertStatistic(5, 0, 1000, baseStats)).rejects.toThrow(
            'db boom',
        );
    });
});
