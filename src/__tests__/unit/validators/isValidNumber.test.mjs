import { isValidNumber } from '@/validators/isValidNumber.mjs';

describe('isValidNumber', () => {
    test('accepts positive integers', () => {
        expect(isValidNumber.safeParse(1).success).toBe(true);
        expect(isValidNumber.safeParse(42).success).toBe(true);
        expect(isValidNumber.safeParse(999999).success).toBe(true);
    });

    test('coerces numeric strings to numbers', () => {
        const result = isValidNumber.safeParse('5');
        expect(result.success).toBe(true);
        expect(result.data).toBe(5);
    });

    test('coerces large numeric strings', () => {
        const result = isValidNumber.safeParse('12345');
        expect(result.success).toBe(true);
        expect(result.data).toBe(12345);
    });

    test('rejects zero', () => {
        expect(isValidNumber.safeParse(0).success).toBe(false);
        expect(isValidNumber.safeParse('0').success).toBe(false);
    });

    test('rejects negative numbers', () => {
        expect(isValidNumber.safeParse(-1).success).toBe(false);
        expect(isValidNumber.safeParse('-5').success).toBe(false);
    });

    test('rejects floats', () => {
        expect(isValidNumber.safeParse(1.5).success).toBe(false);
        expect(isValidNumber.safeParse('3.14').success).toBe(false);
    });

    test('rejects non-numeric strings', () => {
        expect(isValidNumber.safeParse('abc').success).toBe(false);
        expect(isValidNumber.safeParse('').success).toBe(false);
        expect(isValidNumber.safeParse('12abc').success).toBe(false);
    });

    test('rejects null and undefined', () => {
        expect(isValidNumber.safeParse(null).success).toBe(false);
        expect(isValidNumber.safeParse(undefined).success).toBe(false);
    });

    test('rejects non-number non-string types', () => {
        expect(isValidNumber.safeParse(true).success).toBe(false);
        expect(isValidNumber.safeParse([]).success).toBe(false);
        expect(isValidNumber.safeParse({}).success).toBe(false);
    });

    test('rejects NaN-producing strings', () => {
        expect(isValidNumber.safeParse('NaN').success).toBe(false);
        expect(isValidNumber.safeParse('Infinity').success).toBe(false);
    });
});
