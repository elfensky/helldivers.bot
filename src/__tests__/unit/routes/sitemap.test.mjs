import sitemap, { dynamic } from '@/app/sitemap.js';

describe('sitemap', () => {
    test('returns array of 6 entries', async () => {
        const entries = await sitemap();
        expect(entries).toHaveLength(6);
    });

    test('each entry has url, lastModified, changeFrequency, and priority', async () => {
        const entries = await sitemap();
        for (const entry of entries) {
            expect(entry).toHaveProperty('url');
            expect(entry).toHaveProperty('lastModified');
            expect(entry).toHaveProperty('changeFrequency');
            expect(entry).toHaveProperty('priority');
        }
    });

    test('first entry is root URL with priority 1', async () => {
        const entries = await sitemap();
        expect(entries[0].url).toBe('https://helldivers.bot/');
        expect(entries[0].priority).toBe(1);
    });

    test('dynamic export equals force-dynamic', () => {
        expect(dynamic).toBe('force-dynamic');
    });
});
