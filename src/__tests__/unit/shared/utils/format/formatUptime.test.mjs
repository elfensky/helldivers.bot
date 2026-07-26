import { describe, test, expect } from 'vitest';
import { formatUptime } from '@/shared/utils/format/formatUptime.mjs';

describe('formatUptime', () => {
    test('returns dash for null input', () => {
        expect(formatUptime(null)).toBe('—');
    });

    test('returns minutes for short uptime', () => {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        expect(formatUptime(thirtyMinsAgo)).toBe('30m');
    });

    test('returns hours and minutes', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000 - 15 * 60 * 1000);
        expect(formatUptime(twoHoursAgo)).toBe('2h 15m');
    });

    test('returns days and hours', () => {
        const threeDaysAgo = new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000 - 14 * 60 * 60 * 1000,
        );
        expect(formatUptime(threeDaysAgo)).toBe('3d 14h');
    });

    test('returns 0m for just-started', () => {
        expect(formatUptime(new Date())).toBe('0m');
    });
});
