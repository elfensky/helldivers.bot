import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

describe('formatNumber', () => {
    test('formats billions', () => {
        expect(formatNumber(1_500_000_000)).toBe('1.5B');
    });

    test('formats millions with the M suffix from 1M up', () => {
        expect(formatNumber(12_300_000)).toBe('12.3M');
        expect(formatNumber(3_522_088)).toBe('3.5M');
        expect(formatNumber(1_000_000)).toBe('1.0M');
    });

    test('keeps numbers just below 1M locale-grouped', () => {
        expect(formatNumber(999_999)).toBe('999,999');
    });

    test('formats thousands with commas', () => {
        expect(formatNumber(12345)).toBe('12,345');
    });

    test('formats small numbers as-is', () => {
        expect(formatNumber(847)).toBe('847');
    });

    test('returns dash for undefined', () => {
        expect(formatNumber(undefined)).toBe('—');
    });

    test('returns dash for null', () => {
        expect(formatNumber(null)).toBe('—');
    });
});
