import { describe, test, expect } from 'vitest';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

// Contract:
//   - Input is seconds.
//   - Output is the two largest units, in short English: "y", "mo", "w", "d",
//     "h", "m", "s", "ms". Rounded, no spacing between number and unit.
//   - `largest: 2` means at most two adjacent units are concatenated.
//   - `spacer: ''` means no separator between value+unit (e.g. "1h30m").

describe('formatCompactDuration — primary units', () => {
    test('zero seconds → "0s"', () => {
        expect(formatCompactDuration(0)).toBe('0s');
    });

    test('45 seconds → "45s"', () => {
        expect(formatCompactDuration(45)).toBe('45s');
    });

    test('60 seconds → "1m" (one minute, no trailing 0s)', () => {
        expect(formatCompactDuration(60)).toBe('1m');
    });

    test('3600 seconds → "1h"', () => {
        expect(formatCompactDuration(3600)).toBe('1h');
    });

    test('86400 seconds → "1d"', () => {
        expect(formatCompactDuration(86400)).toBe('1d');
    });

    test('604800 seconds → "1w"', () => {
        expect(formatCompactDuration(604800)).toBe('1w');
    });
});

describe('formatCompactDuration — two-unit composition (largest: 2)', () => {
    test('90 seconds → "1m30s"', () => {
        expect(formatCompactDuration(90)).toBe('1m30s');
    });

    test('3725 seconds (1h2m5s) shows only the TWO largest units: "1h2m"', () => {
        // largest: 2 drops the seconds — 5s is the third unit and disappears.
        expect(formatCompactDuration(3725)).toBe('1h2m');
    });

    test('one day, two hours → "1d2h"', () => {
        expect(formatCompactDuration(86400 + 7200)).toBe('1d2h');
    });

    test('one week, three days → "1w3d"', () => {
        expect(formatCompactDuration(604800 + 3 * 86400)).toBe('1w3d');
    });
});

describe('formatCompactDuration — rounding', () => {
    test('59.5 seconds rounds UP to "1m" (boundary crosses into the next unit)', () => {
        // Exact behaviour locked in: humanize-duration's round:true rounds the
        // smallest displayed unit half-up. Largest:2 then promotes 60s → 1m.
        expect(formatCompactDuration(59.5)).toBe('1m');
    });

    test('59.4 seconds rounds DOWN to "59s" (stays in the seconds unit)', () => {
        expect(formatCompactDuration(59.4)).toBe('59s');
    });

    test('125.5 seconds → "2m6s" (rounds the trailing seconds half-up)', () => {
        // 125.5s = 2m + 5.5s → rounded → 2m6s.
        expect(formatCompactDuration(125.5)).toBe('2m6s');
    });

    test('125.4 seconds → "2m5s" (rounds the trailing seconds down)', () => {
        expect(formatCompactDuration(125.4)).toBe('2m5s');
    });
});

describe('formatCompactDuration — short-English language tokens', () => {
    test('output uses single-letter (or short) unit suffixes, never long English ("minute"/"hour"/etc.)', () => {
        const samples = [60, 3600, 86400, 90, 3725, 604800];
        for (const s of samples) {
            const out = formatCompactDuration(s);
            // Should not contain any English-word units.
            expect(out).not.toMatch(/\b(second|minute|hour|day|week|month|year)s?\b/);
            // Should match short tokens (number followed by one of: y mo w d h m s ms).
            expect(out).toMatch(/(y|mo|w|d|h|m|s|ms)/);
        }
    });

    test('no whitespace in output (spacer: "")', () => {
        expect(formatCompactDuration(3725)).not.toMatch(/\s/);
    });
});
