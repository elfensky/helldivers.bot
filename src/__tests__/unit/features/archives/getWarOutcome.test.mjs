import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';

describe('getWarOutcome', () => {
    test('returns null when no data', () => {
        expect(getWarOutcome({})).toBeNull();
        expect(getWarOutcome({ snapshots: [], events: [], status: [] })).toBeNull();
    });

    test('returns victory when all 3 live factions defeated (early return)', () => {
        const data = {
            status: [
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
            status: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'attack', status: 'success', enemy: 0, end_time: 100 },
                { type: 'attack', status: 'success', enemy: 1, end_time: 200 },
                { type: 'attack', status: 'success', enemy: 2, end_time: 300 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('victory');
        expect(result.faction).toBe(2); // last homeworld captured (end_time: 300)
    });

    test('returns victory when snapshot shows all 3 defeated', () => {
        const data = {
            status: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
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
            status: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'defend', region: 0, status: 'fail', enemy: 1, end_time: 100 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
        expect(result.faction).toBe(1); // attacker in failed r0 defend
    });

    test('attributes defeat faction to the LATEST failed r0 defend', () => {
        const data = {
            status: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'defend', region: 0, status: 'fail', enemy: 0, end_time: 100 },
                { type: 'defend', region: 0, status: 'fail', enemy: 2, end_time: 200 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
        expect(result.faction).toBe(2);
    });

    test('defeat faction is null when there is no failed r0 defend evidence', () => {
        const data = {
            status: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [{ type: 'attack', status: 'fail', enemy: 0 }],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
        expect(result.faction).toBeNull();
    });

    test('defeat faction is null when the last r0 defend succeeded (season 153 pattern)', () => {
        // Last SE defend was successful — by product rule, there is no single
        // faction that "defeated" the Helldivers. Do not guess from other signals.
        const data = {
            status: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                {
                    type: 'defend',
                    region: 0,
                    status: 'success',
                    enemy: 0,
                    end_time: 999,
                },
                // Plenty of failed non-r0 defends — must be ignored
                { type: 'defend', region: 5, status: 'fail', enemy: 1, end_time: 100 },
                { type: 'defend', region: 6, status: 'fail', enemy: 1, end_time: 200 },
                { type: 'defend', region: 7, status: 'fail', enemy: 1, end_time: 300 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
        expect(result.faction).toBeNull();
    });

    test('defeat signal overrides victory signal (conflicting signals)', () => {
        const data = {
            status: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
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
            status: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
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
            status: [],
        };
        expect(getWarOutcome(data)).toBeNull();
    });
});
