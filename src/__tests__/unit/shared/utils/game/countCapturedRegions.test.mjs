import { countCapturedRegions } from '@/shared/utils/game/countCapturedRegions.mjs';

function makeMap(overrides = {}) {
    const base = {};
    for (let r = 1; r <= 11; r++) base[r] = { status: 'lost', percent: 0 };
    return Object.assign(base, overrides);
}

describe('countCapturedRegions', () => {
    test('returns zeros for null/undefined input', () => {
        expect(countCapturedRegions(null)).toEqual({
            captured: 0,
            inProgressRegion: null,
            total: 11,
        });
        expect(countCapturedRegions(undefined)).toEqual({
            captured: 0,
            inProgressRegion: null,
            total: 11,
        });
    });

    test('counts captured sectors with no in-progress', () => {
        const map = makeMap({
            1: { status: 'captured', percent: 100 },
            2: { status: 'captured', percent: 100 },
            3: { status: 'captured', percent: 100 },
        });
        expect(countCapturedRegions(map)).toEqual({
            captured: 3,
            inProgressRegion: null,
            total: 11,
        });
    });

    test('detects in-progress sector', () => {
        const map = makeMap({
            1: { status: 'captured', percent: 100 },
            2: { status: 'captured', percent: 100 },
            3: { status: 'captured', percent: 100 },
            4: { status: 'in_progress', percent: 64 },
        });
        expect(countCapturedRegions(map)).toEqual({
            captured: 3,
            inProgressRegion: 4,
            total: 11,
        });
    });

    test('detects active homeworld assault', () => {
        const map = makeMap();
        for (let r = 1; r <= 10; r++) map[r] = { status: 'captured', percent: 100 };
        map[11] = { status: 'active', percent: 38 };

        expect(countCapturedRegions(map)).toEqual({
            captured: 10,
            inProgressRegion: 11,
            total: 11,
        });
    });

    test('counts homeworld as captured when defeated', () => {
        const map = makeMap();
        for (let r = 1; r <= 11; r++) map[r] = { status: 'captured', percent: 100 };

        expect(countCapturedRegions(map)).toEqual({
            captured: 11,
            inProgressRegion: null,
            total: 11,
        });
    });

    test('handles all-lost map', () => {
        expect(countCapturedRegions(makeMap())).toEqual({
            captured: 0,
            inProgressRegion: null,
            total: 11,
        });
    });

    test('ignores unknown statuses', () => {
        const map = makeMap({
            1: { status: 'captured' },
            2: { status: 'weird-status' },
            3: { status: 'in_progress', percent: 10 },
        });
        expect(countCapturedRegions(map)).toEqual({
            captured: 1,
            inProgressRegion: 3,
            total: 11,
        });
    });
});
