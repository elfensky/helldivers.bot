import { describe, expect, test } from 'vitest';
import { parseStatsQuery, projectStats } from '@/app/api/v1/h1/stats/statsProjection.mjs';
import { encodeCursor, decodeCursor } from '@/shared/utils/api/cursor.mjs';

const sp = (qs) => new URLSearchParams(qs);

describe('parseStatsQuery', () => {
    test('applies defaults', () => {
        const r = parseStatsQuery(sp(''));
        expect(r.success).toBe(true);
        expect(r.data).toMatchObject({ season: 'current', limit: 100, order: 'desc' });
    });

    test.each([
        ['enemy=martians', /enemy/],
        ['limit=0', /limit/],
        ['limit=501', /limit/],
        ['season=-1', /season/],
        ['season=all', /season/], // cross-season totals are served by the frontend
        ['order=up', /order/],
    ])('rejects invalid query %s', (qs, re) => {
        const r = parseStatsQuery(sp(qs));
        expect(r.success).toBe(false);
        expect(r.message).toMatch(re);
    });
});

describe('projectStats', () => {
    const rows = [
        {
            enemy: 0,
            bucket: 1700000900,
            players: 88,
            missions: 100,
            successful_missions: 70,
            kills: 1234567890n,
            deaths: 5000n,
            shots: 999999n,
            hits: 888888n,
        },
        {
            enemy: 1,
            bucket: 1700000000,
            players: 40,
            missions: 10,
            successful_missions: 10,
            kills: 5n,
            deaths: 0n,
            shots: 100n,
            hits: 90n,
        },
    ];

    test('projects rows, derives missions won/lost, converts BigInt → number', () => {
        const out = projectStats(rows, 159, 100, 900);
        expect(out.season).toBe(159);
        expect(out.bucketSize).toBe(900);
        expect(out.items[0]).toEqual({
            bucket: 1700000900,
            enemy: 'bugs',
            enemyId: 0,
            season: 159,
            missionsWon: 70,
            missionsLost: 30, // 100 - 70
            kills: 1234567890,
            deaths: 5000,
            shots: 999999,
            hits: 888888,
            players: 88,
        });
        expect(typeof out.items[0].kills).toBe('number');
        expect(out.items[1].missionsLost).toBe(0); // 10 - 10, never negative
        expect(out.page).toEqual({ limit: 100, nextCursor: null });
    });

    test('emits nextCursor when there are more than limit rows', () => {
        const out = projectStats(rows, 159, 1, 900);
        expect(out.items).toHaveLength(1);
        expect(out.page.nextCursor).toBe(encodeCursor(1700000900, 0));
        expect(decodeCursor(out.page.nextCursor)).toEqual({
            bucket: 1700000900,
            enemy: 0,
        });
    });
});
