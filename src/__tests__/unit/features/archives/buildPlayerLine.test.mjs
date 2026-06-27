import { describe, test, expect } from 'vitest';
import { buildPlayerLine } from '@/features/archives/buildPlayerLine.mjs';

const DAY = 86400;

// Three buckets across three days. day is 1-based into the war; time is the
// bucket's unix-seconds anchor (used to place event dots at the nearest bucket).
const series = [
    { time: 0, day: 1, total: 300, bugs: 100, cyborgs: 100, illuminate: 100 },
    { time: DAY, day: 2, total: 660, bugs: 200, cyborgs: 60, illuminate: 400 },
    { time: 2 * DAY, day: 3, total: 900, bugs: 300, cyborgs: 500, illuminate: 100 },
];

describe('buildPlayerLine — line points', () => {
    test('global plots the total line with 1-based day on x', () => {
        const { points } = buildPlayerLine(series, [], 'global');
        expect(points).toEqual([
            { x: 1, y: 300 },
            { x: 2, y: 660 },
            { x: 3, y: 900 },
        ]);
    });

    test('a faction plots that faction’s own player count', () => {
        expect(buildPlayerLine(series, [], 'bugs').points.map((p) => p.y)).toEqual([
            100, 200, 300,
        ]);
        expect(buildPlayerLine(series, [], 'cyborgs').points.map((p) => p.y)).toEqual([
            100, 60, 500,
        ]);
        expect(buildPlayerLine(series, [], 'illuminate').points.map((p) => p.y)).toEqual([
            100, 400, 100,
        ]);
    });

    test('intra-day buckets get distinct fractional x (no vertical collapse)', () => {
        const HOUR = 3600;
        const sameDay = [
            { time: 0, day: 1, total: 100, bugs: 0, cyborgs: 0, illuminate: 0 },
            { time: HOUR, day: 1, total: 200, bugs: 0, cyborgs: 0, illuminate: 0 },
            { time: 2 * HOUR, day: 1, total: 150, bugs: 0, cyborgs: 0, illuminate: 0 },
        ];
        const xs = buildPlayerLine(sameDay, [], 'global').points.map((p) => p.x);
        // All on calendar day 1, but each must occupy its own x — otherwise the
        // line draws a vertical stack instead of advancing through time.
        expect(new Set(xs).size).toBe(3);
        expect(xs[0]).toBe(1);
        expect(xs[1]).toBeCloseTo(1 + HOUR / DAY, 6);
        expect(xs[2]).toBeCloseTo(1 + (2 * HOUR) / DAY, 6);
    });

    test('warStart anchors day 1 (x is days since war_start, not the first bucket)', () => {
        const ws = 5000;
        const s = [
            { time: 5000, day: 1, total: 10, bugs: 0, cyborgs: 0, illuminate: 0 },
            { time: 5000 + DAY, day: 2, total: 20, bugs: 0, cyborgs: 0, illuminate: 0 },
        ];
        const xs = buildPlayerLine(s, [], 'global', ws).points.map((p) => p.x);
        expect(xs).toEqual([1, 2]);
    });
});

describe('buildPlayerLine — event dots', () => {
    const events = [
        // Bugs event starting on day 2's bucket.
        { enemy: 0, start_time: DAY, region: 5, type: 'defend', status: 'success' },
        // Cyborgs event starting on day 3's bucket.
        { enemy: 1, start_time: 2 * DAY, region: 7, type: 'attack', status: 'fail' },
        // Illuminate event near day 1's bucket.
        { enemy: 2, start_time: 100, region: 11, type: 'attack', status: 'active' },
    ];

    test('global shows ALL events; dots sit on the total line at the nearest bucket', () => {
        const { dots } = buildPlayerLine(series, events, 'global');
        expect(dots).toHaveLength(3);

        const bugs = dots.find((d) => d.enemy === 0);
        expect(bugs).toMatchObject({
            x: 2, // start_time = DAY → day 2
            y: 660, // total at the day-2 bucket
            type: 'defend',
            region: 5,
            status: 'success',
        });
        const cyborgs = dots.find((d) => d.enemy === 1);
        expect(cyborgs).toMatchObject({ x: 3, y: 900, status: 'fail' });
        const illuminate = dots.find((d) => d.enemy === 2);
        // start_time=100 is nearest the day-1 bucket (time 0) → total 300.
        // Continuous x: 100s into the war is a hair past day 1, not rounded to 1.
        expect(illuminate.x).toBeCloseTo(1 + 100 / DAY, 6);
        expect(illuminate).toMatchObject({ y: 300, status: 'active' });
    });

    test('a faction shows only its own events, dotted on its own line', () => {
        const { dots } = buildPlayerLine(series, events, 'bugs');
        expect(dots).toHaveLength(1);
        expect(dots[0]).toMatchObject({
            enemy: 0,
            x: 2,
            y: 200, // bugs player count at the day-2 bucket, not the total
        });
    });

    test('a faction with no matching events yields no dots', () => {
        // Only a bugs event exists; the illuminate view filters it out.
        const onlyBugs = [
            { enemy: 0, start_time: DAY, region: 5, type: 'defend', status: 'success' },
        ];
        const { dots, points } = buildPlayerLine(series, onlyBugs, 'illuminate');
        expect(dots).toEqual([]);
        // The line still renders for the faction.
        expect(points.length).toBe(3);
    });
});

describe('buildPlayerLine — defensive', () => {
    test('empty / missing timeseries → { points: [], dots: [] }', () => {
        expect(buildPlayerLine([], [], 'global')).toEqual({ points: [], dots: [] });
        expect(buildPlayerLine(null, [], 'global')).toEqual({ points: [], dots: [] });
        expect(buildPlayerLine(undefined, undefined, 'bugs')).toEqual({
            points: [],
            dots: [],
        });
    });

    test('missing events array is treated as no events', () => {
        const { points, dots } = buildPlayerLine(series, null, 'global');
        expect(points.length).toBe(3);
        expect(dots).toEqual([]);
    });

    test('handles a large series without RangeError (reduce, not spread)', () => {
        const n = 200000;
        const big = Array.from({ length: n }, (_, i) => ({
            time: i * DAY,
            day: i + 1,
            total: i,
            bugs: i,
            cyborgs: i,
            illuminate: i,
        }));
        const events = [
            { enemy: 0, start_time: 0, region: 1, type: 'defend', status: 'active' },
        ];
        // Math.min(...spread) over 200k entries would throw RangeError; reduce must not.
        const { points, dots } = buildPlayerLine(big, events, 'global');
        expect(points.length).toBe(n);
        expect(dots).toHaveLength(1);
        expect(dots[0].x).toBe(1);
    });
});
