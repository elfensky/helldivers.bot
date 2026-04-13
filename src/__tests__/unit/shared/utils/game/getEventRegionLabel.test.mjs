import { describe, expect, test } from 'vitest';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';

describe('getEventRegionLabel', () => {
    test('sector defend event returns the sector region name', () => {
        expect(getEventRegionLabel({ type: 'defend', enemy: 1, region: 5 })).toBe(
            'Horolium System',
        );
    });

    test('Super Earth defend event from Cyborgs returns "Super Earth"', () => {
        expect(getEventRegionLabel({ type: 'defend', enemy: 1, region: 0 })).toBe(
            'Super Earth',
        );
    });

    test('Super Earth defend event from Bugs returns "Super Earth"', () => {
        expect(getEventRegionLabel({ type: 'defend', enemy: 0, region: 0 })).toBe(
            'Super Earth',
        );
    });

    test('Super Earth defend event from Illuminate returns "Super Earth"', () => {
        expect(getEventRegionLabel({ type: 'defend', enemy: 2, region: 0 })).toBe(
            'Super Earth',
        );
    });

    test('attack event on homeworld returns homeworld region name', () => {
        expect(getEventRegionLabel({ type: 'attack', enemy: 0, region: 11 })).toBe(
            'Kepler System',
        );
    });

    test('attack event on homeworld (Cyborg) returns "Cyberstan Region"', () => {
        expect(getEventRegionLabel({ type: 'attack', enemy: 1, region: 11 })).toBe(
            'Cyberstan Region',
        );
    });

    test('unknown enemy/region falls back to "Unknown Region"', () => {
        expect(getEventRegionLabel({ type: 'defend', enemy: 9, region: 99 })).toBe(
            'Unknown Region',
        );
    });

    test('attack event on region 0 does not special-case — falls through to normal lookup', () => {
        // Attack events should never target region 0 in practice, but the
        // helper must not crash and must not claim "Super Earth" for attacks.
        expect(getEventRegionLabel({ type: 'attack', enemy: 1, region: 0 })).toBe(
            'Unknown Region',
        );
    });

    test('missing event returns "Unknown Region"', () => {
        expect(getEventRegionLabel(null)).toBe('Unknown Region');
        expect(getEventRegionLabel(undefined)).toBe('Unknown Region');
    });
});
