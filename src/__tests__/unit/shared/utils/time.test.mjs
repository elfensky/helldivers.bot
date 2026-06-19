import {
    performanceTime,
    roundedPerformanceTime,
    timeSince,
} from '@/shared/utils/time.mjs';

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
