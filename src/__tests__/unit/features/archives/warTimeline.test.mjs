import { buildTimeline, computeMomentMapState } from '@/features/archives/WarTimeline';

// ─── buildTimeline ──────────────────────────────────────────

describe('buildTimeline', () => {
    test('empty data returns empty array', () => {
        expect(buildTimeline({})).toEqual([]);
    });

    test('snapshots only produces snapshot moments sorted by time', () => {
        const data = {
            snapshots: [
                { time: 300, data: '[]' },
                { time: 100, data: '[]' },
                { time: 200, data: '[]' },
            ],
        };
        const moments = buildTimeline(data);
        expect(moments).toHaveLength(3);
        expect(moments.every((m) => m.kind === 'snapshot')).toBe(true);
        expect(moments.map((m) => m.time)).toEqual([100, 200, 300]);
    });

    test('resolved events produce start and end moments', () => {
        const data = {
            events: [
                {
                    start_time: 100,
                    end_time: 200,
                    status: 'success',
                    enemy: 0,
                    type: 'defend',
                },
            ],
        };
        const moments = buildTimeline(data);
        expect(moments).toHaveLength(2);
        expect(moments[0].kind).toBe('event_start');
        expect(moments[1].kind).toBe('event_end');
    });

    test('active events produce start moment only', () => {
        const data = {
            events: [
                {
                    start_time: 100,
                    end_time: 100,
                    status: 'active',
                    enemy: 0,
                    type: 'defend',
                },
            ],
        };
        const moments = buildTimeline(data);
        expect(moments).toHaveLength(1);
        expect(moments[0].kind).toBe('event_start');
    });

    test('events with same start and end time do not produce end moment', () => {
        const data = {
            events: [
                {
                    start_time: 100,
                    end_time: 100,
                    status: 'fail',
                    enemy: 1,
                    type: 'defend',
                },
            ],
        };
        const moments = buildTimeline(data);
        expect(moments).toHaveLength(1);
        expect(moments[0].kind).toBe('event_start');
    });

    test('same-time moments sort by kind priority: snapshot < event_start < event_end', () => {
        const data = {
            snapshots: [{ time: 100, data: '[]' }],
            events: [
                {
                    start_time: 100,
                    end_time: 200,
                    status: 'success',
                    enemy: 0,
                    type: 'defend',
                },
                {
                    start_time: 50,
                    end_time: 100,
                    status: 'fail',
                    enemy: 1,
                    type: 'attack',
                },
            ],
        };
        const moments = buildTimeline(data);
        // At time 100: snapshot, event_start (defend), event_end (attack)
        const atTime100 = moments.filter((m) => m.time === 100);
        expect(atTime100.map((m) => m.kind)).toEqual([
            'snapshot',
            'event_start',
            'event_end',
        ]);
    });
});

// ─── computeMomentMapState ──────────────────────────────────

describe('computeMomentMapState', () => {
    test('no snapshots returns hidden state for all factions', () => {
        const moment = { time: 100 };
        const data = { snapshots: [], events: [] };
        const result = computeMomentMapState(moment, data);
        // All three factions should have sector 1 with status 'lost' (hidden input → lost output)
        expect(result).toBeDefined();
        expect(result[0]).toBeDefined();
        expect(result[1]).toBeDefined();
        expect(result[2]).toBeDefined();
    });

    test('finds nearest snapshot at or before moment time', () => {
        const moment = { time: 250 };
        const data = {
            snapshots: [
                {
                    time: 100,
                    data: [
                        { enemy: 0, points: 10000, points_max: 100000, status: 'active' },
                        { enemy: 1, points: 20000, points_max: 100000, status: 'active' },
                        { enemy: 2, points: 30000, points_max: 100000, status: 'active' },
                    ],
                },
                {
                    time: 200,
                    data: [
                        { enemy: 0, points: 50000, points_max: 100000, status: 'active' },
                        { enemy: 1, points: 60000, points_max: 100000, status: 'active' },
                        { enemy: 2, points: 70000, points_max: 100000, status: 'active' },
                    ],
                },
                {
                    time: 300,
                    data: [
                        { enemy: 0, points: 90000, points_max: 100000, status: 'active' },
                        { enemy: 1, points: 90000, points_max: 100000, status: 'active' },
                        { enemy: 2, points: 90000, points_max: 100000, status: 'active' },
                    ],
                },
            ],
            events: [],
            points_max: { points: [100000, 100000, 100000] },
        };
        const result = computeMomentMapState(moment, data);
        // Should use the time=200 snapshot (50k points for bugs = 5 sectors)
        expect(result[0][5].status).toBe('captured');
        expect(result[0][6].status).toBe('in_progress');
    });

    test('parses both string JSON and object snapshot data', () => {
        const makeFactions = (pts) => [
            { enemy: 0, points: pts, points_max: 100000, status: 'active' },
            { enemy: 1, points: pts, points_max: 100000, status: 'active' },
            { enemy: 2, points: pts, points_max: 100000, status: 'active' },
        ];
        const base = { events: [], points_max: { points: [100000, 100000, 100000] } };

        // String JSON
        const strResult = computeMomentMapState(
            { time: 100 },
            {
                ...base,
                snapshots: [{ time: 100, data: JSON.stringify(makeFactions(30000)) }],
            },
        );
        expect(strResult[0][3].status).toBe('captured');
        expect(strResult[0][4].status).toBe('in_progress');

        // Pre-parsed object
        const objResult = computeMomentMapState(
            { time: 100 },
            {
                ...base,
                snapshots: [{ time: 100, data: makeFactions(30000) }],
            },
        );
        expect(objResult[0][3].status).toBe('captured');
        expect(objResult[0][4].status).toBe('in_progress');
    });

    test('filters active and completed events at moment time', () => {
        const moment = { time: 150 };
        const data = {
            snapshots: [
                {
                    time: 100,
                    data: [
                        { enemy: 0, points: 50000, points_max: 100000, status: 'active' },
                        { enemy: 1, points: 50000, points_max: 100000, status: 'active' },
                        { enemy: 2, points: 50000, points_max: 100000, status: 'active' },
                    ],
                },
            ],
            events: [
                {
                    type: 'defend',
                    enemy: 0,
                    region: 5,
                    start_time: 120,
                    end_time: 200,
                    status: 'active',
                },
                {
                    type: 'defend',
                    enemy: 1,
                    region: 3,
                    start_time: 80,
                    end_time: 140,
                    status: 'fail',
                },
                {
                    type: 'defend',
                    enemy: 2,
                    region: 4,
                    start_time: 300,
                    end_time: 400,
                    status: 'active',
                },
            ],
            points_max: { points: [100000, 100000, 100000] },
        };
        const result = computeMomentMapState(moment, data);
        // Event for faction 0 is active at time 150 (120-200)
        expect(result[0][5].event).toBe('active');
        // Event for faction 1 ended at 140, completed with fail → sectors lost
        expect(result[1][3].status).toBe('lost');
        // Event for faction 2 hasn't started yet (300) → should not appear
        expect(result[2][4].event).not.toBe('active');
    });
});
