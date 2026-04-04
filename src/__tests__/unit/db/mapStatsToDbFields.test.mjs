import { mapStatsToDbFields } from '@/db/queries/mapStatsToDbFields.mjs';

const EXPECTED_KEYS = [
    'season_duration',
    'players',
    'total_unique_players',
    'missions',
    'successful_missions',
    'total_mission_difficulty',
    'completed_planets',
    'defend_events',
    'successful_defend_events',
    'attack_events',
    'successful_attack_events',
    'deaths',
    'kills',
    'accidentals',
    'shots',
    'hits',
];

const mockStats = Object.fromEntries(EXPECTED_KEYS.map((key, i) => [key, i + 1]));

describe('mapStatsToDbFields', () => {
    test('returns exactly the 16 expected keys', () => {
        const result = mapStatsToDbFields(mockStats);
        expect(Object.keys(result).sort()).toEqual([...EXPECTED_KEYS].sort());
        expect(Object.keys(result)).toHaveLength(16);
    });

    test('passes through field values unchanged', () => {
        const result = mapStatsToDbFields(mockStats);
        for (const key of EXPECTED_KEYS) {
            expect(result[key]).toBe(mockStats[key]);
        }
    });

    test('throws on null input', () => {
        expect(() => mapStatsToDbFields(null)).toThrow('stats is required');
    });

    test('throws on undefined input', () => {
        expect(() => mapStatsToDbFields(undefined)).toThrow('stats is required');
    });
});
