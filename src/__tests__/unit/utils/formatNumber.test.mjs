import { formatNumber } from '@/utils/formatNumber.mjs';

describe('formatNumber', () => {
    test('formats billions', () => {
        expect(formatNumber(1_500_000_000)).toBe('1.5B');
    });

    test('formats millions', () => {
        expect(formatNumber(12_300_000)).toBe('12.3M');
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
