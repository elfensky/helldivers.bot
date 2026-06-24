import { selectClosestCalls } from '@/features/archives/selectClosestCalls.mjs';

const ev = (o) => ({ type: 'defend', status: 'fail', points_max: 100, ...o });

test('returns narrowest defend losses, closest to holding first', () => {
    const events = [
        ev({ region: 1, enemy: 0, points: 95 }), // 0.95
        ev({ region: 2, enemy: 1, points: 99 }), // 0.99 — narrowest
        ev({ region: 3, enemy: 2, points: 92 }), // 0.92
    ];
    const calls = selectClosestCalls(events);
    expect(calls.map((c) => c.region)).toEqual([2, 1, 3]);
    expect(calls[0].ratio).toBeCloseTo(0.99);
});

test('excludes wins, actives, attacks, and blowout losses below minRatio', () => {
    const events = [
        ev({ region: 1, enemy: 0, points: 100, status: 'success' }), // win
        ev({ region: 2, enemy: 0, points: 99, status: 'active' }), // in progress
        ev({ region: 3, enemy: 0, points: 99, type: 'attack' }), // attack (unreliable)
        ev({ region: 4, enemy: 0, points: 50 }), // 0.50 blowout, below 0.9
        ev({ region: 5, enemy: 1, points: 91 }), // 0.91 — the only qualifier
    ];
    const calls = selectClosestCalls(events);
    expect(calls).toHaveLength(1);
    expect(calls[0].region).toBe(5);
});

test('caps at limit (default 3) and respects an override', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
        ev({ region: i, enemy: 0, points: 90 + i }),
    );
    expect(selectClosestCalls(events)).toHaveLength(3);
    expect(selectClosestCalls(events, { limit: 5 })).toHaveLength(5);
});

test('guards points_max = 0 (no divide-by-zero) and null input', () => {
    expect(
        selectClosestCalls([ev({ region: 1, enemy: 0, points: 0, points_max: 0 })]),
    ).toEqual([]);
    expect(selectClosestCalls(null)).toEqual([]);
});
