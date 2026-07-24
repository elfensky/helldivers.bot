import { describe, it, expect } from 'vitest';
import {
    SECONDS_PER_DAY,
    resolveWarStart,
    dayOf,
    dayFraction,
    warDaySpan,
} from '@/shared/utils/game/warClock.mjs';

const DAY = 86400;
const WAR_START = 1_000_000;

describe('warClock', () => {
    it('exports the canonical seconds-per-day constant', () => {
        expect(SECONDS_PER_DAY).toBe(86400);
    });

    describe('dayOf — 1-based floored war day', () => {
        it('maps the war-start instant to day 1', () => {
            expect(dayOf(WAR_START, WAR_START)).toBe(1);
        });
        it('floors within a day and increments at the boundary', () => {
            expect(dayOf(WAR_START + DAY - 1, WAR_START)).toBe(1);
            expect(dayOf(WAR_START + DAY, WAR_START)).toBe(2);
            expect(dayOf(WAR_START + 5 * DAY, WAR_START)).toBe(6);
        });
        it('clamps pre-war times to day 1 (never 0 or negative)', () => {
            expect(dayOf(WAR_START - 10 * DAY, WAR_START)).toBe(1);
        });
    });

    describe('dayFraction — 0-based fractional days', () => {
        it('maps the war-start instant to 0', () => {
            expect(dayFraction(WAR_START, WAR_START)).toBe(0);
        });
        it('keeps intra-day samples distinct (no flooring)', () => {
            expect(dayFraction(WAR_START + DAY / 2, WAR_START)).toBe(0.5);
            expect(dayFraction(WAR_START + 3 * DAY, WAR_START)).toBe(3);
        });
    });

    describe('resolveWarStart — anchor with min-time fallback', () => {
        it('returns warStart untouched when present (including 0)', () => {
            expect(resolveWarStart(WAR_START, [1, 2, 3])).toBe(WAR_START);
            expect(resolveWarStart(0, [1, 2, 3])).toBe(0);
        });
        it('falls back to the minimum time when warStart is nullish', () => {
            expect(resolveWarStart(null, [30, 10, 20])).toBe(10);
            expect(resolveWarStart(undefined, [30, 10, 20])).toBe(10);
        });
        it('ignores null holes and returns Infinity for empty input', () => {
            expect(resolveWarStart(null, [30, null, 10])).toBe(10);
            expect(resolveWarStart(null, [])).toBe(Infinity);
            expect(resolveWarStart(null, [null, undefined])).toBe(Infinity);
        });
        it('handles large arrays (reduce, not spread)', () => {
            const big = Array.from({ length: 200_000 }, (_, i) => i + 5);
            expect(resolveWarStart(null, big)).toBe(5);
        });
    });

    describe('warDaySpan — whole-day rounded span', () => {
        it('rounds to the nearest whole day', () => {
            expect(warDaySpan(WAR_START, WAR_START + 7 * DAY)).toBe(7);
            expect(warDaySpan(WAR_START, WAR_START + 7.4 * DAY)).toBe(7);
            expect(warDaySpan(WAR_START, WAR_START + 7.6 * DAY)).toBe(8);
        });
        it('is 0 for a zero-length war', () => {
            expect(warDaySpan(WAR_START, WAR_START)).toBe(0);
        });
    });
});
