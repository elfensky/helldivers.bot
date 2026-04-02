const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const serverAvailable = await fetch(`${BASE_URL}/api/healthcheck`)
    .then(() => true)
    .catch(() => {
        console.error(
            `\n  ✘ Dev server is not running on ${BASE_URL} — skipping smoke tests.\n` +
                `    Start it with: npm run dev\n`,
        );
        return false;
    });

describe.runIf(serverAvailable)('Smoke tests', () => {
    const pages = [
        ['/', 'Homepage'],
        ['/archives', 'Archives page'],
        ['/faq', 'FAQ page'],
        ['/about', 'About page'],
        ['/docs', 'Docs page'],
    ];

    for (const [path, name] of pages) {
        test(`${name} loads (${path})`, async () => {
            const response = await fetch(`${BASE_URL}${path}`);
            expect(response.status).toBe(200);
            const body = await response.text();
            expect(body.length).toBeGreaterThan(0);
        });
    }

    test('GET /api/healthcheck returns 200', async () => {
        const response = await fetch(`${BASE_URL}/api/healthcheck`);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data.alive).toBe(true);
    });

    test('POST /api/h1/rebroadcast without API key returns 401', async () => {
        const response = await fetch(`${BASE_URL}/api/h1/rebroadcast`, {
            method: 'POST',
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error_code).toBe(6);
        expect(body.error_message).toBe('Unauthorized');
    });

    test('POST /api/h1/rebroadcast with invalid API key returns 401', async () => {
        const response = await fetch(`${BASE_URL}/api/h1/rebroadcast`, {
            method: 'POST',
            headers: { Authorization: 'Bearer invalid-key-that-does-not-exist' },
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.error_code).toBe(6);
    });

    test('GET /api/h1/rebroadcast returns 405 without key check', async () => {
        const response = await fetch(`${BASE_URL}/api/h1/rebroadcast`);
        expect(response.status).toBe(405);
        const body = await response.json();
        expect(body.error_code).toBe(5);
    });

    test('GET /opengraph-image returns a PNG image', async () => {
        const response = await fetch(`${BASE_URL}/opengraph-image`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('image/png');
    });
});
