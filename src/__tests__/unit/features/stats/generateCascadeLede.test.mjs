import { describe, it, expect } from 'vitest';
import { generateCascadeLede } from '@/features/stats/generateCascadeLede.mjs';

const cascade = (overrides) => ({
    season: 155,
    length: 9,
    faction: 'The Illuminate',
    regions: [8, 7, 6, 5, 4, 3, 2, 1, 0],
    durationSec: 14 * 3600 + 32 * 60,
    ...overrides,
});

describe('generateCascadeLede', () => {
    it('returns null for no cascades', () => {
        expect(generateCascadeLede([], 200)).toBeNull();
        expect(generateCascadeLede(null, 200)).toBeNull();
    });

    it('uses "pushed all the way home" when the last region is 0', () => {
        const lede = generateCascadeLede([cascade()], 200);
        expect(lede).toContain('pushed all the way home');
        expect(lede).toContain('1 cascade');
        expect(lede).toContain('200 wars');
        expect(lede).toContain('season 155');
        expect(lede).toContain('The Illuminate');
    });

    it('uses "pushed all the way home" when the last region is 11', () => {
        const lede = generateCascadeLede([cascade({ regions: [13, 12, 11] })], 10);
        expect(lede).toContain('pushed all the way home');
    });

    it('falls back to "swept N regions in DURATION" otherwise', () => {
        const lede = generateCascadeLede(
            [cascade({ length: 5, regions: [6, 5, 4, 3, 2], durationSec: 9 * 3600 })],
            50,
        );
        expect(lede).toContain('swept 5 regions in 9h');
    });

    it('pluralizes "cascades" and "wars" correctly', () => {
        const ledeMany = generateCascadeLede([cascade(), cascade({ season: 142 })], 2);
        expect(ledeMany).toContain('2 cascades');
        expect(ledeMany).toContain('2 wars');

        const ledeOne = generateCascadeLede([cascade()], 1);
        expect(ledeOne).toContain('1 cascade ');
        expect(ledeOne).toContain('1 war.');
    });
});
