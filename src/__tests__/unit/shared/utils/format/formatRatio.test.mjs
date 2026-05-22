import { formatRatio } from '@/shared/utils/format/formatRatio.mjs';

describe('formatRatio', () => {
    test('formats a ratio to one decimal place', () => {
        expect(formatRatio(10, 5)).toBe('2.0');
    });

    test('rounds to one decimal place', () => {
        expect(formatRatio(10, 3)).toBe('3.3');
    });

    test('coerces BigInt inputs', () => {
        expect(formatRatio(1_200_000_000n, 50_000_000n)).toBe('24.0');
    });

    test('returns a dash for a zero denominator', () => {
        expect(formatRatio(5, 0)).toBe('—');
    });

    test('returns a dash for a null or undefined denominator', () => {
        expect(formatRatio(5, null)).toBe('—');
        expect(formatRatio(5, undefined)).toBe('—');
    });
});
