import { describe, test, expect } from 'vitest';
import { addOrdinalSuffix } from '@/shared/utils/format/addOrdinalSuffix.mjs';

// Ordinal-suffix rules in English:
//   - 1st, 2nd, 3rd, 4th..10th
//   - 11th, 12th, 13th are the trap: not 11st/12nd/13rd
//   - 21st, 22nd, 23rd resume the pattern
//   - 101st, 102nd, 103rd; 111th, 112th, 113th (trap repeats)
// The implementation reads the last two digits to handle 11/12/13, then the
// last digit for the normal pattern. Each branch needs at least one test.

describe('addOrdinalSuffix — single-digit pattern', () => {
    test.each([
        [1, '1st'],
        [2, '2nd'],
        [3, '3rd'],
        [4, '4th'],
        [5, '5th'],
        [6, '6th'],
        [7, '7th'],
        [8, '8th'],
        [9, '9th'],
        [10, '10th'],
    ])('%i → %s', (n, expected) => {
        expect(addOrdinalSuffix(n)).toBe(expected);
    });
});

describe('addOrdinalSuffix — teens trap (11/12/13 are always "th")', () => {
    test.each([
        [11, '11th'],
        [12, '12th'],
        [13, '13th'],
        [14, '14th'],
        [15, '15th'],
        [16, '16th'],
        [17, '17th'],
        [18, '18th'],
        [19, '19th'],
        [20, '20th'],
    ])('%i → %s', (n, expected) => {
        expect(addOrdinalSuffix(n)).toBe(expected);
    });
});

describe('addOrdinalSuffix — pattern resumes after the teens', () => {
    test.each([
        [21, '21st'],
        [22, '22nd'],
        [23, '23rd'],
        [24, '24th'],
        [31, '31st'],
        [42, '42nd'],
        [53, '53rd'],
        [99, '99th'],
        [100, '100th'],
    ])('%i → %s', (n, expected) => {
        expect(addOrdinalSuffix(n)).toBe(expected);
    });
});

describe('addOrdinalSuffix — hundreds and beyond (teens trap repeats every 100)', () => {
    test.each([
        [101, '101st'],
        [102, '102nd'],
        [103, '103rd'],
        // The 111-113 trap — these are the bug-prone cases.
        [111, '111th'],
        [112, '112th'],
        [113, '113th'],
        [114, '114th'],
        [121, '121st'],
        [123, '123rd'],
        // Larger ranges.
        [1001, '1001st'],
        [1012, '1012th'],
        [1023, '1023rd'],
        [2013, '2013th'],
    ])('%i → %s', (n, expected) => {
        expect(addOrdinalSuffix(n)).toBe(expected);
    });
});

describe('addOrdinalSuffix — edge cases', () => {
    test('0 → "0th" (zero takes the "th" branch via default case)', () => {
        expect(addOrdinalSuffix(0)).toBe('0th');
    });
});
