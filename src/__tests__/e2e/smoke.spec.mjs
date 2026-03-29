import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
    const pages = [
        ['/', 'Homepage'],
        ['/archives', 'Archives page'],
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

    test('POST /api/h1/rebroadcast without API key returns 401', async ({ request }) => {
        const response = await request.post('/api/h1/rebroadcast');
        expect(response.status()).toBe(401);
        const body = await response.json();
        expect(body.error_code).toBe(6);
        expect(body.error_message).toBe('Unauthorized');
    });

    test('POST /api/h1/rebroadcast with invalid API key returns 401', async ({
        request,
    }) => {
        const response = await request.post('/api/h1/rebroadcast', {
            headers: { Authorization: 'Bearer invalid-key-that-does-not-exist' },
        });
        expect(response.status()).toBe(401);
        const body = await response.json();
        expect(body.error_code).toBe(6);
    });

    test('GET /api/h1/rebroadcast returns 405 without key check', async ({ request }) => {
        const response = await request.get('/api/h1/rebroadcast');
        expect(response.status()).toBe(405);
        const body = await response.json();
        expect(body.error_code).toBe(5);
    });

    test('GET /opengraph-image returns a PNG image', async ({ request }) => {
        const response = await request.get('/opengraph-image');
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('image/png');
    });
});
