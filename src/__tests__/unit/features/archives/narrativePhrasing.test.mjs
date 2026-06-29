import { describe, it, expect } from 'vitest';
import { pickVariant, PHRASES } from '@/features/archives/narrativePhrasing.mjs';

describe('pickVariant', () => {
    const pool = ['a', 'b', 'c'];

    it('is deterministic for the same (season, key)', () => {
        expect(pickVariant(pool, 155, 42)).toBe(pickVariant(pool, 155, 42));
    });

    it('stays within the pool', () => {
        for (let k = 0; k < 50; k++) {
            expect(pool).toContain(pickVariant(pool, 157, k));
        }
    });

    it('varies across keys and seasons (not always index 0)', () => {
        const picks = new Set();
        for (let k = 0; k < 20; k++) picks.add(pickVariant(pool, 155, k));
        expect(picks.size).toBeGreaterThan(1);
    });

    it('handles a single-element pool', () => {
        expect(pickVariant(['only'], 1, 1)).toBe('only');
    });
});

describe('PHRASES pools', () => {
    it('every pool has at least 2 variants and renders a non-empty string', () => {
        for (const [name, pool] of Object.entries(PHRASES)) {
            expect(pool.length, name).toBeGreaterThanOrEqual(2);
            // render variant 0 with dummy args — must be a non-empty string
            const out = pool[0]('Region', 'Bugs', 3, 'over 2 days', '', 25000);
            expect(typeof out, name).toBe('string');
            expect(out.length, name).toBeGreaterThan(0);
        }
    });
});
