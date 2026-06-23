import { describe, expect, test } from 'vitest';
import {
    parseSeasonQuery,
    projectSeasons,
} from '@/app/api/v1/h1/season/seasonProjection.mjs';

const sp = (qs) => new URLSearchParams(qs);

describe('parseSeasonQuery', () => {
    test('defaults to current when no season param', () => {
        const r = parseSeasonQuery(sp(''));
        expect(r.success).toBe(true);
        expect(r.data.seasons).toEqual(['current']);
    });

    test('parses a single season number', () => {
        const r = parseSeasonQuery(sp('season=42'));
        expect(r.data.seasons).toEqual([42]);
    });

    test('parses multiple ?season= params (mixed with current)', () => {
        const r = parseSeasonQuery(sp('season=1&season=2&season=current'));
        expect(r.data.seasons).toEqual([1, 2, 'current']);
    });

    test.each([['season=0'], ['season=-1'], ['season=abc']])(
        'rejects invalid %s',
        (qs) => {
            const r = parseSeasonQuery(sp(qs));
            expect(r.success).toBe(false);
            expect(r.message).toMatch(/season/);
        },
    );
});

describe('projectSeasons', () => {
    const rows = [
        {
            season: 158,
            last_updated: new Date('2026-06-01T00:00:00.000Z'),
            introduction_order: [0, 2, 1], // bugs=0, cyborgs=2, illuminate=1
            points_max: [280970, 325480, 202300],
            season_duration: 86400,
        },
        {
            season: 159,
            last_updated: null,
            introduction_order: [0, 1, 2],
            points_max: [100, 200, 300],
            season_duration: 0,
        },
    ];

    test('projects metadata with isCurrent, slug intro order, points_max object', () => {
        const out = projectSeasons(rows, 159);
        expect(out[0]).toEqual({
            season: 158,
            isCurrent: false,
            lastUpdated: '2026-06-01T00:00:00.000Z',
            // sorted by rank: bugs(0), illuminate(1), cyborgs(2)
            introductionOrder: ['bugs', 'illuminate', 'cyborgs'],
            pointsMax: { bugs: 280970, cyborgs: 325480, illuminate: 202300 },
            seasonDuration: 86400,
        });
        expect(out[1].isCurrent).toBe(true);
        expect(out[1].lastUpdated).toBeNull();
        expect(out[1].introductionOrder).toEqual(['bugs', 'cyborgs', 'illuminate']);
    });
});
