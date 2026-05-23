import { describe, test, expect } from 'vitest';
import { MINISTRY_CONTENT, pickAlt } from '@/features/ministry/ministryContent.mjs';

const TONES = ['winning', 'losing'];
const CATEGORIES = ['heading', 'value', 'body', 'footer'];

describe('MINISTRY_CONTENT structure', () => {
    test('has both tones with all four categories', () => {
        for (const tone of TONES) {
            expect(MINISTRY_CONTENT[tone]).toBeDefined();
            for (const cat of CATEGORIES) {
                expect(Array.isArray(MINISTRY_CONTENT[tone][cat])).toBe(true);
            }
        }
    });

    test('every pool has at least 12 entries (enforces minimum)', () => {
        for (const tone of TONES) {
            for (const cat of CATEGORIES) {
                expect(MINISTRY_CONTENT[tone][cat].length).toBeGreaterThanOrEqual(12);
            }
        }
    });

    test('every entry is a non-empty string', () => {
        for (const tone of TONES) {
            for (const cat of CATEGORIES) {
                for (const entry of MINISTRY_CONTENT[tone][cat]) {
                    expect(typeof entry).toBe('string');
                    expect(entry.length).toBeGreaterThan(0);
                }
            }
        }
    });
});

describe('pickAlt', () => {
    test('returns the first entry when rng() returns 0', () => {
        const rng = () => 0;
        const result = pickAlt('heading', 'winning', rng);
        expect(result).toBe(MINISTRY_CONTENT.winning.heading[0]);
    });

    test('returns the last entry when rng() returns 0.9999', () => {
        const rng = () => 0.9999;
        const result = pickAlt('heading', 'losing', rng);
        const pool = MINISTRY_CONTENT.losing.heading;
        expect(result).toBe(pool[pool.length - 1]);
    });

    test('returns the last entry when rng() returns exactly 1.0 (guards Math.floor edge)', () => {
        const rng = () => 1.0;
        const result = pickAlt('heading', 'winning', rng);
        const pool = MINISTRY_CONTENT.winning.heading;
        expect(result).toBe(pool[pool.length - 1]);
    });

    test('returns undefined for unknown category', () => {
        expect(pickAlt('nav', 'winning', Math.random)).toBeUndefined();
        expect(pickAlt('button', 'losing', Math.random)).toBeUndefined();
        expect(pickAlt('bogus', 'winning', Math.random)).toBeUndefined();
    });

    test('returns undefined for unknown tone', () => {
        expect(pickAlt('heading', 'neutral', Math.random)).toBeUndefined();
        expect(pickAlt('heading', null, Math.random)).toBeUndefined();
    });
});
