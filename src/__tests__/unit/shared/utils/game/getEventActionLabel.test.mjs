import { describe, expect, test } from 'vitest';
import { getEventActionLabel } from '@/shared/utils/game/getEventActionLabel.mjs';

describe('getEventActionLabel', () => {
    test('attack active → "Attacking"', () => {
        expect(getEventActionLabel({ type: 'attack', status: 'active' })).toBe(
            'Attacking',
        );
    });

    test('attack success → "Captured"', () => {
        expect(getEventActionLabel({ type: 'attack', status: 'success' })).toBe(
            'Captured',
        );
    });

    test('attack fail → "Lost"', () => {
        expect(getEventActionLabel({ type: 'attack', status: 'fail' })).toBe('Lost');
    });

    test('defend active → "Defending"', () => {
        expect(getEventActionLabel({ type: 'defend', status: 'active' })).toBe(
            'Defending',
        );
    });

    test('defend success → "Defended"', () => {
        expect(getEventActionLabel({ type: 'defend', status: 'success' })).toBe(
            'Defended',
        );
    });

    test('defend fail → "Lost"', () => {
        expect(getEventActionLabel({ type: 'defend', status: 'fail' })).toBe('Lost');
    });

    test('unknown type → empty string', () => {
        expect(getEventActionLabel({ type: 'invade', status: 'active' })).toBe('');
    });

    test('unknown status → empty string', () => {
        expect(getEventActionLabel({ type: 'attack', status: 'paused' })).toBe('');
    });

    test('null/undefined → empty string', () => {
        expect(getEventActionLabel(null)).toBe('');
        expect(getEventActionLabel(undefined)).toBe('');
    });
});
