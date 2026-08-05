import {
    computeDefendStats,
    computeConcurrencyStats,
} from '@/app/docs/predict/defend/liveStats.mjs';

const HOUR = 3600;
const NOW = 1000000;

/**
 * Season 1: train A (0-10h, fail), B chains onto A (10.05h-20h, success —
 * starts 180s after A ends, inside the 600s CHAIN_SECONDS window so it does
 * NOT start a new train), then a 40h lull before train C (60h-70h, success).
 * Train starts: A, C. One lull record: B's end (20h) -> C's start (60h) = 40h.
 */
const SEASON_1 = [
    { season: 1, enemy: 0, start_time: 0, end_time: 10 * HOUR, status: 'fail' },
    {
        season: 1,
        enemy: 0,
        start_time: 10 * HOUR + 180,
        end_time: 20 * HOUR,
        status: 'success',
    },
    {
        season: 1,
        enemy: 0,
        start_time: 60 * HOUR,
        end_time: 70 * HOUR,
        status: 'success',
    },
];

/** Season 2: a single isolated train (D) — no lull, since only one start. */
const SEASON_2 = [
    {
        season: 2,
        enemy: 1,
        start_time: 200 * HOUR,
        end_time: 210 * HOUR,
        status: 'success',
    },
];

/**
 * Season 3: train E (400-410h, fail), F chains onto E (410.05h-420h,
 * success), then a 20h lull before train G (440-450h, success). Train
 * starts: E, G. One lull record of 20h — combined with season 1's 40h lull
 * this gives n=2, meanH=30, population sd=10, cv=1/3, fittedK=1/cv^2=9.
 */
const SEASON_3 = [
    { season: 3, enemy: 2, start_time: 400 * HOUR, end_time: 410 * HOUR, status: 'fail' },
    {
        season: 3,
        enemy: 2,
        start_time: 410 * HOUR + 180,
        end_time: 420 * HOUR,
        status: 'success',
    },
    {
        season: 3,
        enemy: 2,
        start_time: 440 * HOUR,
        end_time: 450 * HOUR,
        status: 'success',
    },
];

describe('computeDefendStats — counts / lull / histogram', () => {
    test('two-season fixture: train starts, seasons, single 40h lull', () => {
        const defendRows = [...SEASON_1, ...SEASON_2];
        const stats = computeDefendStats(defendRows, [], [], NOW);

        expect(stats.counts).toEqual({ defends: 4, trainStarts: 3, seasons: 2 });
        expect(stats.lull.n).toBe(1);
        expect(stats.lull.p50).toBe(40);
        // A single-point sample has no computable variance/cv — fittedK/theta
        // must stay null rather than reporting a bogus Infinity.
        expect(stats.lull.fittedK).toBeNull();
        expect(stats.lull.fittedTheta).toBeNull();
    });

    test('histogram bins the 40h lull into the [40,42) bucket and sums to n', () => {
        const defendRows = [...SEASON_1, ...SEASON_2];
        const stats = computeDefendStats(defendRows, [], [], NOW);

        expect(stats.histogram.binWidthH).toBe(2);
        expect(stats.histogram.maxH).toBe(120);
        expect(stats.histogram.bins).toHaveLength(60);
        expect(stats.histogram.bins[20]).toBe(1);
        expect(stats.histogram.bins.reduce((a, b) => a + b, 0)).toBe(stats.lull.n);
    });

    test('three-season fixture: two lulls give a computable fittedK/theta', () => {
        const defendRows = [...SEASON_1, ...SEASON_2, ...SEASON_3];
        const stats = computeDefendStats(defendRows, [], [], NOW);

        expect(stats.counts).toEqual({ defends: 7, trainStarts: 5, seasons: 3 });
        expect(stats.lull.n).toBe(2);
        expect(stats.lull.meanH).toBeCloseTo(30, 6);
        expect(stats.lull.cv).toBeCloseTo(1 / 3, 6);
        expect(stats.lull.fittedK).toBeCloseTo(9, 6);
        expect(stats.lull.fittedTheta).toBeCloseTo(30 / 9, 6);
    });

    test('cross-season isolation: a defend 5 minutes into a new season is still a train start', () => {
        const defendRows = [
            { season: 1, enemy: 0, start_time: 0, end_time: 1000, status: 'fail' },
            // Same enemy, only 300s (5min) after season 1's defend ENDED, but a
            // DIFFERENT season — per-season grouping must not chain across the
            // season boundary.
            { season: 2, enemy: 0, start_time: 1300, end_time: 2000, status: 'success' },
        ];
        const stats = computeDefendStats(defendRows, [], [], NOW);

        expect(stats.counts.trainStarts).toBe(2);
        expect(stats.counts.seasons).toBe(2);
    });
});

describe('computeDefendStats — now.forecast / now.lastTrainStart', () => {
    // Reuses the "window fixture" shape from waveForecast.test.mjs's makeData():
    // a single finished train (enemy 0) that ended 30h before NOW, one active
    // healthy faction, two hidden factions — this should resolve to `window`
    // mode under the real committed wave model.
    const currentSeasonEvents = [
        {
            type: 'defend',
            enemy: 0,
            region: 5,
            start_time: NOW - 40 * HOUR,
            end_time: NOW - 30 * HOUR,
            status: 'fail',
        },
    ];
    const currentStatusRows = [
        { enemy: 0, points: 5000, points_max: 10000, status: 'active' },
        { enemy: 1, points: 0, points_max: 0, status: 'hidden' },
        { enemy: 2, points: 0, points_max: 0, status: 'hidden' },
    ];

    test('window fixture resolves to window mode with the matching lastTrainStart', () => {
        const stats = computeDefendStats([], currentSeasonEvents, currentStatusRows, NOW);

        expect(stats.now.forecast.mode).toBe('window');
        expect(stats.now.forecast.lastTrainStart).toBe(NOW - 40 * HOUR);
        expect(stats.now.lastTrainStart).toBe(NOW - 40 * HOUR);
    });

    test('no current-season defends yet resolves to hidden with a null lastTrainStart', () => {
        const stats = computeDefendStats([], [], [], NOW);

        expect(stats.now.forecast).toEqual({ mode: 'hidden', reason: 'no-train-yet' });
        expect(stats.now.lastTrainStart).toBeNull();
    });
});

describe('computeConcurrencyStats', () => {
    const ev = (season, type, enemy, start, end) => ({
        season,
        type,
        enemy,
        start_time: start,
        end_time: end,
    });

    test('counts overlaps per category and finds triple simultaneity', () => {
        const events = [
            // Season 1: three attacks all overlapping 100-200 => a+a+a, 3 aa pairs
            ev(1, 'attack', 0, 100, 300),
            ev(1, 'attack', 1, 150, 250),
            ev(1, 'attack', 2, 120, 220),
            // plus a defend starting after attacks 1 and 2 ended (260), so it
            // overlaps only attack enemy 0 [100-300] => exactly 1 da-cross pair
            ev(1, 'defend', 1, 260, 400),
        ];
        const s = computeConcurrencyStats(events);
        expect(s.attackAttack.overlaps).toBe(3);
        expect(s.defendDefend.overlaps).toBe(0);
        expect(s.defendAttackCross.overlaps).toBe(1);
        expect(s.defendAttackSame.overlaps).toBe(0); // attack enemy1 ended (250) before the defend began (260)
        expect(s.maxSimultaneous).toBe(3);
        const aaa = s.compositions.find((c) => c.key === 'attack + attack + attack');
        expect(aaa).toBeDefined();
        expect(aaa.firstSeason).toBe(1);
    });

    test('cross-season events never pair', () => {
        const events = [ev(1, 'defend', 0, 100, 200), ev(2, 'defend', 1, 150, 250)];
        const s = computeConcurrencyStats(events);
        expect(s.defendDefend.checked).toBe(0);
        expect(s.defendDefend.overlaps).toBe(0);
        expect(s.maxSimultaneous).toBe(0);
    });

    test('adjacent (touching) intervals do not overlap', () => {
        const events = [ev(1, 'defend', 0, 100, 200), ev(1, 'defend', 1, 200, 300)];
        const s = computeConcurrencyStats(events);
        expect(s.defendDefend.checked).toBe(1);
        expect(s.defendDefend.overlaps).toBe(0);
    });
});
