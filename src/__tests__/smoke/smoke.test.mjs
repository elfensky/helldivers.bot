const BASE_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';

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
        ['/docs', 'Docs page'],
        ['/docs/about', 'Docs About page'],
        ['/docs/faq', 'Docs FAQ page'],
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
        expect(body.code).toBe(401);
        expect(body.message).toBe('Unauthorized');
    });

    test('POST /api/h1/rebroadcast with invalid API key returns 401', async () => {
        const response = await fetch(`${BASE_URL}/api/h1/rebroadcast`, {
            method: 'POST',
            headers: { Authorization: 'Bearer invalid-key-that-does-not-exist' },
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.code).toBe(401);
    });

    test('GET /api/h1/rebroadcast returns 405 without key check', async () => {
        const response = await fetch(`${BASE_URL}/api/h1/rebroadcast`);
        expect(response.status).toBe(405);
        const body = await response.json();
        expect(body.code).toBe(405);
    });

    test('GET /opengraph-image returns a PNG image', async () => {
        const response = await fetch(`${BASE_URL}/opengraph-image`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('image/png');
    });

    test('Archives page renders with Ministry Interference wrappers (truth text intact)', async () => {
        const response = await fetch(`${BASE_URL}/archives`);
        expect(response.status).toBe(200);
        const body = await response.text();
        // Hijackable idles on the server (no browser JS), so the truth text
        // is the only content in the SSR HTML — no propaganda strings present.
        expect(body).toContain('Declassified Campaign Archives');
        // Body description from ArchivesHeader.
        expect(body).toContain('Records verified by the Bureau of War Information');
    });

    test('Homepage renders with Ministry Interference wrappers (truth text intact)', async () => {
        const response = await fetch(`${BASE_URL}/`);
        expect(response.status).toBe(200);
        const body = await response.text();
        // DashboardClient wraps the hero heading in a Hijackable; idle SSR
        // renders the truth directly so it must appear in the HTML.
        expect(body).toContain('Track Managed Democracy Across the Galaxy');
    });
});
