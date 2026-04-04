import { addOrdinalSuffix } from '@/shared/utils/format/addOrdinalSuffix.mjs';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

describe('addOrdinalSuffix', () => {
    test('1st, 2nd, 3rd, 4th', () => {
        expect(addOrdinalSuffix(1)).toBe('1st');
        expect(addOrdinalSuffix(2)).toBe('2nd');
        expect(addOrdinalSuffix(3)).toBe('3rd');
        expect(addOrdinalSuffix(4)).toBe('4th');
    });

    test('11th, 12th, 13th are special cases', () => {
        expect(addOrdinalSuffix(11)).toBe('11th');
        expect(addOrdinalSuffix(12)).toBe('12th');
        expect(addOrdinalSuffix(13)).toBe('13th');
    });

    test('21st, 22nd, 23rd follow standard rules', () => {
        expect(addOrdinalSuffix(21)).toBe('21st');
        expect(addOrdinalSuffix(22)).toBe('22nd');
        expect(addOrdinalSuffix(23)).toBe('23rd');
    });

    test('100th ends in th', () => {
        expect(addOrdinalSuffix(100)).toBe('100th');
    });

    test('101st follows standard rules', () => {
        expect(addOrdinalSuffix(101)).toBe('101st');
    });

    test('111th, 112th, 113th are special cases', () => {
        expect(addOrdinalSuffix(111)).toBe('111th');
        expect(addOrdinalSuffix(112)).toBe('112th');
        expect(addOrdinalSuffix(113)).toBe('113th');
    });
});

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

    test('millions use M suffix with one decimal', () => {
        expect(formatNumber(1000000)).toBe('1.0M');
        expect(formatNumber(1500000)).toBe('1.5M');
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
