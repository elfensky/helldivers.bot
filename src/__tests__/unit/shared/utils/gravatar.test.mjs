import { getGravatarUrl } from '@/shared/utils/gravatar.mjs';

describe('getGravatarUrl', () => {
    test('returns correct gravatar URL for a known email', () => {
        // MD5 of "test@example.com" is 55502f40dc8b7c769880b10874abc9d0
        const url = getGravatarUrl('test@example.com');
        expect(url).toBe(
            'https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?s=64',
        );
    });

    test('trims whitespace from email', () => {
        const url = getGravatarUrl('  test@example.com  ');
        expect(url).toBe(
            'https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?s=64',
        );
    });

    test('lowercases email before hashing', () => {
        const url = getGravatarUrl('Test@Example.COM');
        expect(url).toBe(
            'https://www.gravatar.com/avatar/55502f40dc8b7c769880b10874abc9d0?s=64',
        );
    });

    test('URL has correct format', () => {
        const url = getGravatarUrl('user@domain.org');
        expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\/[a-f0-9]{32}\?s=64$/);
    });
});
