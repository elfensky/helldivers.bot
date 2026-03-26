import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
    const pages = [
        ['/', 'Homepage'],
        ['/war', 'War page'],
        ['/faq', 'FAQ page'],
        ['/about', 'About page'],
        ['/docs', 'Docs page'],
    ];

    for (const [path, name] of pages) {
        test(`${name} loads (${path})`, async ({ page }) => {
            const response = await page.goto(path);
            expect(response.status()).toBe(200);
            await expect(page.locator('body')).not.toBeEmpty();
        });
    }

    test('GET /api/healthcheck returns 200', async ({ request }) => {
        const response = await request.get('/api/healthcheck');
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.data.alive).toBe(true);
    });
});
