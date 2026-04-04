import { formatTimeAgo } from '@/shared/utils/format/formatTimeAgo.mjs';

describe('formatTimeAgo', () => {
    test('returns seconds ago for < 60s', () => {
        const now = new Date('2026-03-28T12:01:00Z');
        const date = new Date('2026-03-28T12:00:15Z');
        expect(formatTimeAgo(date, now)).toBe('Updated 45s ago');
    });

    test('returns minutes ago for >= 60s', () => {
        const now = new Date('2026-03-28T12:05:00Z');
        const date = new Date('2026-03-28T12:02:00Z');
        expect(formatTimeAgo(date, now)).toBe('Updated 3m ago');
    });

    test('returns hours ago for >= 60m', () => {
        const now = new Date('2026-03-28T14:00:00Z');
        const date = new Date('2026-03-28T12:00:00Z');
        expect(formatTimeAgo(date, now)).toBe('Updated 2h ago');
    });

    test('returns null for null input', () => {
        expect(formatTimeAgo(null)).toBe(null);
    });

    test('returns null for undefined input', () => {
        expect(formatTimeAgo(undefined)).toBe(null);
    });
});
