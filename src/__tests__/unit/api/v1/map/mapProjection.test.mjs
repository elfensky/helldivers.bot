import { describe, expect, test } from 'vitest';
import { parseMapQuery, projectMap } from '@/app/api/v1/h1/map/mapProjection.mjs';

const sp = (qs) => new URLSearchParams(qs);

describe('parseMapQuery', () => {
    test('applies defaults', () => {
        const r = parseMapQuery(sp(''));
        expect(r.success).toBe(true);
        expect(r.data).toMatchObject({
            season: 'current',
            at: 'latest',
            events: 'active',
        });
    });

    test('accepts an ISO at (route defers historical)', () => {
        const r = parseMapQuery(sp('at=2026-06-01T00:00:00Z'));
        expect(r.success).toBe(true);
        expect(r.data.at).toBeInstanceOf(Date);
    });

    test.each([
        ['enemy=martians', /enemy/],
        ['events=all', /events/],
        ['season=-1', /season/],
    ])('rejects invalid %s', (qs, re) => {
        const r = parseMapQuery(sp(qs));
        expect(r.success).toBe(false);
        expect(r.message).toMatch(re);
    });
});

describe('projectMap', () => {
    const mapState = {
        0: { 1: { status: 'captured', percent: 100 }, 11: { status: 'lost' } },
        1: { 1: { status: 'lost', percent: 0 } },
        2: { 1: { status: 'in_progress', percent: 50 } },
        3: { 0: { status: 'active' } },
    };

    test('re-keys fronts by faction slug, as id-sorted arrays', () => {
        const out = projectMap(mapState, [], {
            season: 159,
            bucket: 1782004500,
            eventsMode: 'active',
        });
        expect(out).toMatchObject({ season: 159, bucket: 1782004500, events: 'active' });
        expect(Object.keys(out.fronts)).toEqual([
            'bugs',
            'cyborgs',
            'illuminate',
            'superEarth',
        ]);
        // each front is an array; elements self-identify by `id` (sorted ascending)
        expect(Array.isArray(out.fronts.bugs)).toBe(true);
        expect(out.fronts.bugs.map((r) => r.id)).toEqual([1, 11]);
        expect(out.fronts.bugs.find((r) => r.id === 1).status).toBe('captured');
        expect(out.fronts.superEarth[0].id).toBe(0);
        expect(out.activeEvents).toEqual([]);
    });

    test('enemy filter keeps only that front (plus Super Earth)', () => {
        const out = projectMap(mapState, [], {
            season: 159,
            bucket: 0,
            eventsMode: 'active',
            enemyId: 2,
        });
        expect(Object.keys(out.fronts).sort()).toEqual(['illuminate', 'superEarth']);
    });

    test('projects active events to a light shape', () => {
        const events = [
            {
                type: 'attack',
                enemy: 0,
                region: 11,
                status: 'active',
                points: 50,
                points_max: 100,
                start_time: 1000,
                end_time: 2000,
            },
        ];
        const out = projectMap(mapState, events, {
            season: 159,
            bucket: 0,
            eventsMode: 'active',
        });
        expect(out.activeEvents[0]).toEqual({
            type: 'attack',
            enemy: 'bugs',
            enemyId: 0,
            region: 11,
            status: 'active',
            points: 50,
            pointsMax: 100,
            startTime: 1000,
            endTime: 2000,
        });
    });
});
