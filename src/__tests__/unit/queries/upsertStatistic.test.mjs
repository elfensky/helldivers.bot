import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertStatistic } from '@/db/queries/upsertStatistic.mjs';

// The full 16-field shape the HD1 API actually sends. queryUpsertStatistic
// picks only the 11 per-faction timeseries fields it cares about — the
// remaining 5 (season_duration, defend_events, successful_defend_events,
// attack_events, successful_attack_events) live elsewhere:
//   - season_duration → h1_season (per-season scalar)
//   - event counts    → derivable from h1_event
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

    test('update path writes 11 stats fields + time', async () => {
        vi.mocked(db.h1_statistic.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatistic(5, 0, 1000, baseStats);

        const callArg = vi.mocked(db.h1_statistic.upsert).mock.calls[0][0];
        expect(callArg.update).toEqual({
            time: 1000,
            players: 1250,
            total_unique_players: 8400,
            missions: 500,
            successful_missions: 450,
            total_mission_difficulty: 2500,
            completed_planets: 3,
            kills: 500000n,
            deaths: 120000n,
            accidentals: 500n,
            shots: 2000000n,
            hits: 1500000n,
        });
        // Lock in the drop decision — the 5 dropped fields must NOT appear
        // on the update payload, even though the upstream API still sends
        // them in the baseStats fixture.
        expect(callArg.update).not.toHaveProperty('season_duration');
        expect(callArg.update).not.toHaveProperty('defend_events');
        expect(callArg.update).not.toHaveProperty('successful_defend_events');
        expect(callArg.update).not.toHaveProperty('attack_events');
        expect(callArg.update).not.toHaveProperty('successful_attack_events');
    });

    test('create path includes season, enemy, bucket + 11 stats fields', async () => {
        vi.mocked(db.h1_statistic.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatistic(5, 2, 1000, baseStats);

        const callArg = vi.mocked(db.h1_statistic.upsert).mock.calls[0][0];
        expect(callArg.create).toEqual({
            season: 5,
            enemy: 2,
            bucket: 900,
            time: 1000,
            players: 1250,
            total_unique_players: 8400,
            missions: 500,
            successful_missions: 450,
            total_mission_difficulty: 2500,
            completed_planets: 3,
            kills: 500000n,
            deaths: 120000n,
            accidentals: 500n,
            shots: 2000000n,
            hits: 1500000n,
        });
        // Same drop-decision lock on the create path.
        expect(callArg.create).not.toHaveProperty('season_duration');
        expect(callArg.create).not.toHaveProperty('defend_events');
        expect(callArg.create).not.toHaveProperty('successful_defend_events');
        expect(callArg.create).not.toHaveProperty('attack_events');
        expect(callArg.create).not.toHaveProperty('successful_attack_events');
    });

    test('propagates DB errors', async () => {
        vi.mocked(db.h1_statistic.upsert).mockRejectedValue(new Error('db boom'));
        await expect(queryUpsertStatistic(5, 0, 1000, baseStats)).rejects.toThrow(
            'db boom',
        );
    });
});
