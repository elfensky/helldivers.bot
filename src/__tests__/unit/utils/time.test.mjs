import {
    performanceTime,
    roundedPerformanceTime,
    formatDate,
    timeSince,
    elapsedSeasonTime,
    elapsedSeconds,
    elapsedDateTime,
} from '@/utils/time.mjs';

describe('performanceTime', () => {
    test('returns elapsed milliseconds since start', () => {
        const start = performance.now() - 100;
        const result = performanceTime(start);
        expect(result).toBeGreaterThanOrEqual(99);
        expect(result).toBeLessThan(200);
    });

    test('returns a number close to zero for a recent start', () => {
        const start = performance.now();
        const result = performanceTime(start);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(50);
    });
});

describe('roundedPerformanceTime', () => {
    test('rounds elapsed time up to the nearest 50', () => {
        // Force a known elapsed time by providing a start value
        const start = performance.now() - 33;
        const result = roundedPerformanceTime(start);
        // 33ms rounds up to 50
        expect(result % 50).toBe(0);
        expect(result).toBeGreaterThanOrEqual(50);
    });

    test('returns 50 for very small elapsed times', () => {
        const start = performance.now() - 1;
        const result = roundedPerformanceTime(start);
        expect(result).toBe(50);
    });

    test('exact multiples of 50 stay unchanged', () => {
        // If elapsed is exactly 100, Math.ceil(100/50)*50 = 100
        const start = performance.now() - 100;
        const result = roundedPerformanceTime(start);
        expect(result % 50).toBe(0);
        expect(result).toBeGreaterThanOrEqual(100);
    });
});

describe('formatDate', () => {
    test('formats a date as YYYY-MM-DD HH:MM:SS', () => {
        const date = new Date(2024, 0, 5, 9, 3, 7); // Jan 5, 2024 09:03:07
        expect(formatDate(date)).toBe('2024-01-05 09:03:07');
    });

    test('pads single-digit months, days, hours, minutes, seconds', () => {
        const date = new Date(2023, 2, 1, 1, 2, 3); // Mar 1, 2023 01:02:03
        expect(formatDate(date)).toBe('2023-03-01 01:02:03');
    });

    test('handles midnight correctly', () => {
        const date = new Date(2025, 11, 31, 0, 0, 0); // Dec 31, 2025 00:00:00
        expect(formatDate(date)).toBe('2025-12-31 00:00:00');
    });

    test('handles end-of-day correctly', () => {
        const date = new Date(2025, 5, 15, 23, 59, 59);
        expect(formatDate(date)).toBe('2025-06-15 23:59:59');
    });
});

describe('timeSince', () => {
    test('returns minutes ago for less than 60 minutes', () => {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60000);
        expect(timeSince(thirtyMinsAgo)).toBe('30 minutes ago');
    });

    test('returns singular minute for exactly 1 minute', () => {
        const oneMinAgo = new Date(Date.now() - 1 * 60000);
        expect(timeSince(oneMinAgo)).toBe('1 minute ago');
    });

    test('returns 0 minutes ago for just now', () => {
        const now = new Date();
        expect(timeSince(now)).toBe('0 minutes ago');
    });

    test('returns hours ago for 1-23 hours', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 3600000);
        expect(timeSince(twoHoursAgo)).toBe('2 hours ago');
    });

    test('returns singular hour for exactly 1 hour', () => {
        const oneHourAgo = new Date(Date.now() - 1 * 3600000);
        expect(timeSince(oneHourAgo)).toBe('1 hour ago');
    });

    test('returns days ago for 24+ hours', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
        expect(timeSince(threeDaysAgo)).toBe('3 days ago');
    });

    test('returns singular day for exactly 1 day', () => {
        const oneDayAgo = new Date(Date.now() - 1 * 86400000);
        expect(timeSince(oneDayAgo)).toBe('1 day ago');
    });

    test('accepts date strings', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
        expect(timeSince(twoHoursAgo)).toBe('2 hours ago');
    });
});

describe('elapsedSeasonTime', () => {
    test('converts seconds to days, hours, minutes, seconds', () => {
        // 1 day + 2 hours + 3 minutes + 4 seconds = 93784 seconds
        const result = elapsedSeasonTime(93784);
        expect(result).toEqual({
            days: 1,
            hours: 2,
            minutes: 3,
            seconds: 4,
        });
    });

    test('handles zero seconds', () => {
        expect(elapsedSeasonTime(0)).toEqual({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
        });
    });

    test('handles exactly one day', () => {
        expect(elapsedSeasonTime(86400)).toEqual({
            days: 1,
            hours: 0,
            minutes: 0,
            seconds: 0,
        });
    });

    test('handles large values', () => {
        // 100 days
        const result = elapsedSeasonTime(100 * 86400);
        expect(result.days).toBe(100);
        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(0);
        expect(result.seconds).toBe(0);
    });

    test('handles only seconds (less than a minute)', () => {
        expect(elapsedSeasonTime(45)).toEqual({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 45,
        });
    });
});

describe('elapsedSeconds', () => {
    test('returns seconds since past date', () => {
        const tenSecsAgo = new Date(Date.now() - 10000);
        const result = elapsedSeconds(tenSecsAgo);
        expect(result).toBeGreaterThanOrEqual(9);
        expect(result).toBeLessThanOrEqual(11);
    });
});

describe('elapsedDateTime', () => {
    test('returns milliseconds since past date', () => {
        const fiveSecsAgo = new Date(Date.now() - 5000);
        const result = elapsedDateTime(fiveSecsAgo);
        expect(result).toBeGreaterThanOrEqual(4900);
        expect(result).toBeLessThanOrEqual(5200);
    });
});
