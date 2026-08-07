import { describe, expect, test } from 'vitest';
import { groupBy } from '@/shared/utils/groupBy.mjs';

// Pinned against the built-in it replaces: same key order, same value order,
// same SameValueZero key comparison. If these drift, the three call sites
// swapped off Map.groupBy in #495 change behaviour silently.
describe('groupBy', () => {
    test('buckets by key, preserving encounter order within a group', () => {
        const groups = groupBy([1, 2, 3, 4, 5], (n) => (n % 2 === 0 ? 'even' : 'odd'));

        expect(groups.get('odd')).toEqual([1, 3, 5]);
        expect(groups.get('even')).toEqual([2, 4]);
    });

    test('orders keys by first appearance, like Map.groupBy', () => {
        const groups = groupBy(['b', 'a', 'b'], (s) => s);

        expect([...groups.keys()]).toEqual(['b', 'a']);
    });

    test('passes the index to the key function', () => {
        const groups = groupBy(['x', 'y', 'z'], (_item, i) => i % 2);

        expect(groups.get(0)).toEqual(['x', 'z']);
        expect(groups.get(1)).toEqual(['y']);
    });

    test('returns an empty Map for empty input', () => {
        expect(groupBy([], (x) => x).size).toBe(0);
    });

    test('matches Map.groupBy on the same input', () => {
        const items = [
            { s: 2, n: 'a' },
            { s: 1, n: 'b' },
            { s: 2, n: 'c' },
        ];
        const key = (x) => x.s;

        expect([...groupBy(items, key)]).toEqual([...Map.groupBy(items, key)]);
    });
});
