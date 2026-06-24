import { buildEngagementSeries } from '@/features/archives/buildEngagementSeries.mjs';

const DAY = 86400;

test('anchors day 0 to warStart and groups points per faction', () => {
    const warStart = 1000;
    const events = [
        { enemy: 0, start_time: 1000, players_at_start: 100, region: 1, type: 'defend' },
        {
            enemy: 0,
            start_time: 1000 + DAY,
            players_at_start: 200,
            region: 2,
            type: 'attack',
        },
        {
            enemy: 1,
            start_time: 1000 + 2 * DAY,
            players_at_start: 300,
            region: 3,
            type: 'defend',
        },
    ];
    const series = buildEngagementSeries(events, warStart);

    const bugs = series.find((s) => s.enemy === 0);
    const cyborgs = series.find((s) => s.enemy === 1);
    expect(bugs.points.map((p) => p.x)).toEqual([0, 1]);
    expect(bugs.points.map((p) => p.y)).toEqual([100, 200]);
    expect(cyborgs.points.map((p) => p.x)).toEqual([2]);
    // Illuminate had no events — its empty series is dropped entirely.
    expect(series.find((s) => s.enemy === 2)).toBeUndefined();
});

test('falls back to the earliest event when warStart is absent', () => {
    const events = [
        {
            enemy: 0,
            start_time: 5000 + DAY,
            players_at_start: 200,
            region: 1,
            type: 'defend',
        },
        { enemy: 0, start_time: 5000, players_at_start: 100, region: 1, type: 'defend' },
    ];
    const series = buildEngagementSeries(events, null);
    // anchor = earliest start_time (5000) → that point is day 0.
    expect(series[0].points.map((p) => p.x).sort()).toEqual([0, 1]);
});

test('drops events with no positive player count', () => {
    const events = [
        { enemy: 0, start_time: 0, players_at_start: 0, region: 1, type: 'defend' },
        {
            enemy: 0,
            start_time: 0,
            players_at_start: undefined,
            region: 1,
            type: 'defend',
        },
    ];
    expect(buildEngagementSeries(events, 0)).toEqual([]);
});

test('returns empty for null/undefined input', () => {
    expect(buildEngagementSeries(null, 0)).toEqual([]);
    expect(buildEngagementSeries(undefined)).toEqual([]);
});

test('handles a large event array without RangeError (reduce, not spread)', () => {
    const n = 200000;
    // start_time increases with i, so the earliest event is index 0 → anchor.
    const events = Array.from({ length: n }, (_, i) => ({
        enemy: 0,
        start_time: 1_000_000 + i,
        players_at_start: 1,
        region: 1,
        type: 'defend',
    }));
    // The old Math.min(...spread) would throw RangeError at this size; reduce must not.
    const series = buildEngagementSeries(events, null);
    expect(series[0].points.length).toBe(n);
    expect(series[0].points[0].x).toBe(0);
});
