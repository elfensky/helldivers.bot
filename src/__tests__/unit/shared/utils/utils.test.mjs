import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

describe('formatNumber', () => {
    test('small numbers return as string', () => {
        expect(formatNumber(42)).toBe('42');
        expect(formatNumber(0)).toBe('0');
        expect(formatNumber(999)).toBe('999');
    });

    test('thousands use locale string', () => {
        expect(formatNumber(1000)).toBe(Number(1000).toLocaleString());
        expect(formatNumber(1500)).toBe(Number(1500).toLocaleString());
        expect(formatNumber(999999)).toBe(Number(999999).toLocaleString());
    });

    test('values from 1M up use the M suffix with one decimal', () => {
        expect(formatNumber(1000000)).toBe('1.0M');
        expect(formatNumber(1500000)).toBe('1.5M');
        expect(formatNumber(9500000)).toBe('9.5M');
    });

    test('millions ≥10M use M suffix with one decimal', () => {
        expect(formatNumber(10000000)).toBe('10.0M');
        expect(formatNumber(15000000)).toBe('15.0M');
        expect(formatNumber(999000000)).toBe('999.0M');
    });

    test('billions use B suffix with one decimal', () => {
        expect(formatNumber(1000000000)).toBe('1.0B');
        expect(formatNumber(2500000000)).toBe('2.5B');
    });

    test('BigInt input is converted to number', () => {
        expect(formatNumber(BigInt(42))).toBe('42');
        expect(formatNumber(BigInt(5000000))).toBe('5.0M');
    });

    test('null, undefined, and non-finite return em dash', () => {
        expect(formatNumber(null)).toBe('—');
        expect(formatNumber(undefined)).toBe('—');
        expect(formatNumber(NaN)).toBe('—');
        expect(formatNumber(Infinity)).toBe('—');
    });
});
