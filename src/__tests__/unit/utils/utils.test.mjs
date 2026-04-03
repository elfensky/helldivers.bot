import { addOrdinalSuffix } from '@/utils/utils.mjs';

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
