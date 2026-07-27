import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

// Absorbed the former unit/shared/utils/utils.test.mjs, a second copy of this
// suite that sat one directory up under a name matching no module. Every input
// it asserted is asserted here; the cases it uniquely covered (BigInt, 0, NaN,
// Infinity) are called out below.
describe('formatNumber', () => {
    test('formats billions', () => {
        expect(formatNumber(1_000_000_000)).toBe('1.0B');
        expect(formatNumber(1_500_000_000)).toBe('1.5B');
        expect(formatNumber(2_500_000_000)).toBe('2.5B');
    });

    test('formats millions with the M suffix from 1M up', () => {
        expect(formatNumber(1_000_000)).toBe('1.0M');
        expect(formatNumber(1_500_000)).toBe('1.5M');
        expect(formatNumber(3_522_088)).toBe('3.5M');
        expect(formatNumber(9_500_000)).toBe('9.5M');
        expect(formatNumber(12_300_000)).toBe('12.3M');
    });

    test('keeps the M suffix and one decimal all the way up to 1B', () => {
        expect(formatNumber(10_000_000)).toBe('10.0M');
        expect(formatNumber(15_000_000)).toBe('15.0M');
        expect(formatNumber(999_000_000)).toBe('999.0M');
    });

    test('keeps numbers just below 1M locale-grouped', () => {
        expect(formatNumber(999_999)).toBe('999,999');
    });

    test('formats thousands with commas (en-US pinned to avoid SSR hydration mismatch)', () => {
        expect(formatNumber(1000)).toBe('1,000');
        expect(formatNumber(1500)).toBe('1,500');
        expect(formatNumber(12345)).toBe('12,345');
    });

    test('formats small numbers as-is', () => {
        expect(formatNumber(0)).toBe('0');
        expect(formatNumber(42)).toBe('42');
        expect(formatNumber(847)).toBe('847');
        expect(formatNumber(999)).toBe('999');
    });

    test('converts BigInt input to a number', () => {
        expect(formatNumber(BigInt(42))).toBe('42');
        expect(formatNumber(BigInt(5_000_000))).toBe('5.0M');
    });

    test('returns dash for undefined', () => {
        expect(formatNumber(undefined)).toBe('—');
    });

    test('returns dash for null', () => {
        expect(formatNumber(null)).toBe('—');
    });

    test('returns dash for non-finite numbers', () => {
        expect(formatNumber(NaN)).toBe('—');
        expect(formatNumber(Infinity)).toBe('—');
    });
});
