import { describe, expect, test } from 'vitest';
import {
    parseStatusQuery,
    projectLatest,
    projectHistory,
    encodeCursor,
    decodeCursor,
} from '@/app/api/v1/h1/status/statusProjection.mjs';

const sp = (qs) => new URLSearchParams(qs);

describe('parseStatusQuery', () => {
    test('applies defaults for an empty query', () => {
        const r = parseStatusQuery(sp(''));
        expect(r.success).toBe(true);
        expect(r.data).toMatchObject({
            season: 'current',
            mode: 'latest',
            limit: 100,
            order: 'desc',
        });
        expect(r.data.enemy).toBeUndefined();
    });

    test('parses a full valid query', () => {
        const r = parseStatusQuery(
            sp('season=42&enemy=cyborgs&mode=history&limit=50&order=asc'),
        );
        expect(r.success).toBe(true);
        expect(r.data.season).toBe(42);
        expect(r.data.enemy).toBe('cyborgs');
        expect(r.data.mode).toBe('history');
        expect(r.data.limit).toBe(50);
        expect(r.data.order).toBe('asc');
    });

    test.each([
        ['enemy=martians', /enemy/],
        ['mode=sideways', /mode/],
        ['limit=0', /limit/],
        ['limit=501', /limit/],
        ['season=-3', /season/],
        ['season=abc', /season/],
    ])('rejects invalid query %s', (qs, re) => {
        const r = parseStatusQuery(sp(qs));
        expect(r.success).toBe(false);
        expect(r.message).toMatch(re);
    });
});

describe('cursor round-trip', () => {
    test('encode → decode is stable', () => {
        const c = encodeCursor(1700000000, 2);
        expect(decodeCursor(c)).toEqual({ bucket: 1700000000, enemy: 2 });
    });

    test('malformed cursor decodes to null', () => {
        expect(decodeCursor('not-a-cursor!!')).toBeNull();
    });
});

describe('projectLatest', () => {
    const rows = [
        {
            enemy: 1,
            points: 50,
            points_max: 100,
            players: 10,
            time: 1700000000,
            bucket: 1700000000,
        },
        {
            enemy: 0,
            points: 200,
            points_max: 200,
            players: 30,
            time: 1700000900,
            bucket: 1700000900,
        },
        {
            enemy: 2,
            points: 0,
            points_max: 0,
            players: 0,
            time: 1700000000,
            bucket: 1700000000,
        },
    ];

    test('projects, sorts by enemyId, and computes percent', () => {
        const out = projectLatest(rows, 42, 100);
        expect(out.season).toBe(42);
        expect(out.mode).toBe('latest');
        expect(out.bucket).toBe(1700000900); // max bucket
        expect(out.items.map((i) => i.enemyId)).toEqual([0, 1, 2]);
        expect(out.items[0]).toMatchObject({
            enemy: 'bugs',
            enemyId: 0,
            points: 200,
            pointsMax: 200,
            percent: 100,
            players: 30,
            updatedAt: '2023-11-14T22:28:20.000Z',
        });
        expect(out.items[1].percent).toBe(50);
        expect(out.items[2].percent).toBe(0); // guards pointsMax=0
        expect(out.items[0]).not.toHaveProperty('bucket'); // latest items omit bucket
        expect(out.page).toEqual({ limit: 100, nextCursor: null });
    });

    test('filters by enemyId', () => {
        const out = projectLatest(rows, 42, 100, 1);
        expect(out.items).toHaveLength(1);
        expect(out.items[0].enemy).toBe('cyborgs');
    });
});

describe('projectHistory', () => {
    const pointsMaxByEnemy = { 0: 200, 1: 100, 2: 300 };
    const playersByKey = { '1700000000:0': 5, '1700000900:0': 9 };

    test('projects rows with bucket, players, points_max lookups', () => {
        const rows = [{ enemy: 0, points: 100, time: 1700000000, bucket: 1700000000 }];
        const out = projectHistory(rows, pointsMaxByEnemy, playersByKey, 42, 100);
        expect(out.mode).toBe('history');
        expect(out.items[0]).toMatchObject({
            enemy: 'bugs',
            enemyId: 0,
            points: 100,
            pointsMax: 200,
            percent: 50,
            players: 5,
            bucket: 1700000000,
        });
        expect(out.page.nextCursor).toBeNull();
    });

    test('emits nextCursor when there are more than limit rows', () => {
        // limit 1, two rows → hasMore; the extra row is dropped and cursor points
        // at the last *returned* row.
        const rows = [
            { enemy: 0, points: 100, time: 1700000000, bucket: 1700000900 },
            { enemy: 0, points: 90, time: 1700000000, bucket: 1700000000 },
        ];
        const out = projectHistory(rows, pointsMaxByEnemy, playersByKey, 42, 1);
        expect(out.items).toHaveLength(1);
        expect(out.items[0].bucket).toBe(1700000900);
        expect(out.page.nextCursor).toBe(encodeCursor(1700000900, 0));
        expect(decodeCursor(out.page.nextCursor)).toEqual({
            bucket: 1700000900,
            enemy: 0,
        });
    });

    test('missing players/points_max default to 0', () => {
        const rows = [{ enemy: 2, points: 10, time: 1700000000, bucket: 1700000000 }];
        const out = projectHistory(rows, pointsMaxByEnemy, playersByKey, 42, 100);
        expect(out.items[0].players).toBe(0); // no key in playersByKey
        expect(out.items[0].pointsMax).toBe(300);
    });
});
