import { describe, test, expect } from 'vitest';
import { getClientIp } from '@/shared/utils/api/clientIp.mjs';

const req = (headers) => new Request('http://localhost', { headers });

describe('getClientIp', () => {
    test('takes the first x-forwarded-for hop', () => {
        expect(getClientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe(
            '1.2.3.4',
        );
    });

    test('trims whitespace around the hop', () => {
        expect(getClientIp(req({ 'x-forwarded-for': '  9.9.9.9 ' }))).toBe('9.9.9.9');
    });

    test('falls back to x-real-ip', () => {
        expect(getClientIp(req({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8');
    });

    test('returns "unknown" when neither header is present', () => {
        expect(getClientIp(req({}))).toBe('unknown');
    });
});
