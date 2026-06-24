import { computeTelemetryStats } from '@/features/stats/computeTelemetryStats.mjs';

// A historical (pre-telemetry) season carries 0n sums; live-polled seasons
// carry real BigInt counts. Mirrors getCrossSeasonStats' perSeason shape.
const seasons = [
    { season: 10, kills: 0n, accidentals: 0n, shots: 0n, hits: 0n, completed_planets: 0 },
    {
        season: 157,
        kills: 1000n,
        accidentals: 50n,
        shots: 2000n,
        hits: 1000n,
        completed_planets: 100,
    },
    {
        season: 158,
        kills: 2000n,
        accidentals: 40n,
        shots: 8000n,
        hits: 2000n,
        completed_planets: 300,
    },
];

test('filters out pre-telemetry (all-zero) seasons', () => {
    const { friendlyFire, accuracy, seasonsWithTelemetry } =
        computeTelemetryStats(seasons);
    expect(seasonsWithTelemetry).toBe(2);
    expect(friendlyFire.map((r) => r.season)).toEqual([157, 158]);
    expect(accuracy.map((r) => r.season)).toEqual([157, 158]);
});

test('computes ratios as percentages from BigInt sums', () => {
    const { friendlyFire, accuracy } = computeTelemetryStats(seasons);
    // 50/1000 = 5%, 40/2000 = 2%
    expect(friendlyFire.map((r) => r.value)).toEqual([5, 2]);
    // 1000/2000 = 50%, 2000/8000 = 25%
    expect(accuracy.map((r) => r.value)).toEqual([50, 25]);
});

test('shots-per-planet aggregates shots/planets across telemetry seasons', () => {
    const { shotsPerPlanet } = computeTelemetryStats(seasons);
    // (2000 + 8000) / (100 + 300) = 25
    expect(shotsPerPlanet).toBe(25);
});

test('returns empty series and null big-number when no telemetry exists', () => {
    const result = computeTelemetryStats([seasons[0]]);
    expect(result.seasonsWithTelemetry).toBe(0);
    expect(result.friendlyFire).toEqual([]);
    expect(result.accuracy).toEqual([]);
    expect(result.shotsPerPlanet).toBeNull();
});

test('tolerates null/undefined input', () => {
    expect(computeTelemetryStats(null).seasonsWithTelemetry).toBe(0);
    expect(computeTelemetryStats(undefined).shotsPerPlanet).toBeNull();
});
