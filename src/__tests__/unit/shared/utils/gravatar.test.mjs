import { getGravatarUrl } from '@/shared/utils/gravatar.mjs';

describe('getGravatarUrl', () => {
    test('returns correct gravatar URL for a known email', async () => {
        // SHA-256 of "test@example.com"
        const url = await getGravatarUrl('test@example.com');
        expect(url).toBe(
            'https://www.gravatar.com/avatar/973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b?s=64',
        );
    });

    test('trims whitespace from email', async () => {
        const url = await getGravatarUrl('  test@example.com  ');
        expect(url).toBe(
            'https://www.gravatar.com/avatar/973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b?s=64',
        );
    });

    test('lowercases email before hashing', async () => {
        const url = await getGravatarUrl('Test@Example.COM');
        expect(url).toBe(
            'https://www.gravatar.com/avatar/973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b?s=64',
        );
    });

    test('URL has correct format', async () => {
        const url = await getGravatarUrl('user@domain.org');
        expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\/[a-f0-9]{64}\?s=64$/);
    });
});
