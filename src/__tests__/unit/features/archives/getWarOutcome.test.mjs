import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';

describe('getWarOutcome', () => {
    test('returns null when no data', () => {
        expect(getWarOutcome({})).toBeNull();
        expect(getWarOutcome({ snapshots: [], events: [], live: [] })).toBeNull();
    });

    test('returns victory when all 3 live factions defeated (early return)', () => {
        const data = {
            live: [
                { status: 'defeated' },
                { status: 'defeated' },
                { status: 'defeated' },
            ],
            snapshots: [],
            events: [],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('victory');
        expect(result.reason).toBe('All enemy factions have been defeated.');
    });

    test('returns victory when all 3 homeworlds captured via events (no defeat signal)', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'attack', status: 'success', enemy: 0 },
                { type: 'attack', status: 'success', enemy: 1 },
                { type: 'attack', status: 'success', enemy: 2 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('victory');
    });

    test('returns victory when snapshot shows all 3 defeated', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [
                {
                    data: JSON.stringify([
                        { status: 'defeated' },
                        { status: 'defeated' },
                        { status: 'defeated' },
                    ]),
                },
            ],
            events: [],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('victory');
    });

    test('returns defeat when last region-0 defend event failed', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [{ type: 'defend', region: 0, status: 'fail', end_time: 100 }],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
    });

    test('defeat signal overrides victory signal (conflicting signals)', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'attack', status: 'success', enemy: 0 },
                { type: 'attack', status: 'success', enemy: 1 },
                { type: 'attack', status: 'success', enemy: 2 },
                { type: 'defend', region: 0, status: 'fail', end_time: 200 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
    });

    test('returns defeat when no victory signal and data exists', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [{ type: 'attack', status: 'fail', enemy: 0 }],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
    });

    test('returns null when only empty arrays', () => {
        const data = {
            snapshots: [],
            events: [],
            live: [],
        };
        expect(getWarOutcome(data)).toBeNull();
    });
});
