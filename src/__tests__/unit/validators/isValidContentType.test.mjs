import { isValidContentType } from '@/validators/isValidContentType.js';

describe('isValidContentType', () => {
    test('accepts multipart/form-data', () => {
        expect(isValidContentType.safeParse('multipart/form-data').success).toBe(true);
    });

    test('accepts multipart/form-data with boundary', () => {
        expect(
            isValidContentType.safeParse(
                'multipart/form-data; boundary=----WebKitFormBoundary',
            ).success,
        ).toBe(true);
    });

    test('accepts application/x-www-form-urlencoded', () => {
        expect(
            isValidContentType.safeParse('application/x-www-form-urlencoded').success,
        ).toBe(true);
    });

    test('rejects application/json', () => {
        expect(isValidContentType.safeParse('application/json').success).toBe(false);
    });

    test('rejects text/plain', () => {
        expect(isValidContentType.safeParse('text/plain').success).toBe(false);
    });

    test('rejects empty string', () => {
        expect(isValidContentType.safeParse('').success).toBe(false);
    });

    test('rejects non-string types', () => {
        expect(isValidContentType.safeParse(123).success).toBe(false);
        expect(isValidContentType.safeParse(null).success).toBe(false);
        expect(isValidContentType.safeParse(undefined).success).toBe(false);
        expect(isValidContentType.safeParse({}).success).toBe(false);
    });

    test('error message is "Invalid content type"', () => {
        const result = isValidContentType.safeParse('text/html');
        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toBe('Invalid content type');
    });
});
