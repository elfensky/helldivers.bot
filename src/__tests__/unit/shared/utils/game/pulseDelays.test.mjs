import { describe, test, expect } from 'vitest';
import { computePulseDelays } from '@/shared/utils/game/pulseDelays.mjs';

describe('computePulseDelays', () => {
    test('returns an empty Map for empty / nullish input', () => {
        expect(computePulseDelays([]).size).toBe(0);
        expect(computePulseDelays(undefined).size).toBe(0);
        expect(computePulseDelays(null).size).toBe(0);
    });

    test('only counts ACTIVE events; ignores success/fail', () => {
        const delays = computePulseDelays([
            { enemy: 0, region: 1, status: 'active' },
            { enemy: 1, region: 2, status: 'success' },
            { enemy: 2, region: 3, status: 'fail' },
        ]);
        expect(delays.size).toBe(1);
        expect(delays.has('0-1')).toBe(true);
    });

    test('keys are "enemy-region" and the first active event has zero offset', () => {
        const delays = computePulseDelays([{ enemy: 4, region: 7, status: 'active' }]);
        expect([...delays.keys()]).toEqual(['4-7']);
        expect(delays.get('4-7')).toBeCloseTo(0);
    });

    test('spaces simultaneous events evenly across the cycle, negative offsets', () => {
        const delays = computePulseDelays(
            [
                { enemy: 0, region: 1, status: 'active' },
                { enemy: 1, region: 1, status: 'active' },
                { enemy: 2, region: 1, status: 'active' },
            ],
            1.5,
        );
        // i * cycleDuration / count → 0, -0.5, -1.0
        expect(delays.get('0-1')).toBeCloseTo(0);
        expect(delays.get('1-1')).toBeCloseTo(-0.5);
        expect(delays.get('2-1')).toBeCloseTo(-1.0);
    });

    test('cycleDuration scales the offsets', () => {
        const delays = computePulseDelays(
            [
                { enemy: 0, region: 1, status: 'active' },
                { enemy: 1, region: 1, status: 'active' },
            ],
            4,
        );
        // second of two → -(1 * 4 / 2) = -2
        expect(delays.get('1-1')).toBeCloseTo(-2);
    });
});
