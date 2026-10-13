import { vi } from 'vitest';
import { GET, POST } from '@/app/stats.js/route.js';

const withCookie = (method = 'GET') =>
    new Request('http://localhost:3000/stats.js', {
        method,
        headers: { cookie: 'better-auth.session_token=secret' },
    });

describe('GET /stats.js', () => {
    let originalFetch;

    beforeEach(() => {
        vi.stubEnv('UMAMI_SITE_URL', 'analytics.example.com');
        originalFetch = global.fetch;
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response('console.log(1)', { status: 200 })),
        );
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.unstubAllEnvs();
    });

    test('fetches upstream with the URL alone, so no visitor header goes along', async () => {
        const response = await GET(withCookie());

        expect(global.fetch).toHaveBeenCalledOnce();
        expect(global.fetch).toHaveBeenCalledWith(
            'https://analytics.example.com/script.js',
        );
        expect(global.fetch.mock.calls[0]).toHaveLength(1);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('console.log(1)');
    });

    test('serves JavaScript with a one-hour public cache', async () => {
        const response = await GET(withCookie());

        expect(response.headers.get('Content-Type')).toBe(
            'application/javascript; charset=utf-8',
        );
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    });

    test('returns 404 without calling fetch when UMAMI_SITE_URL is empty', async () => {
        vi.stubEnv('UMAMI_SITE_URL', '');

        const response = await GET(withCookie());

        expect(response.status).toBe(404);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('returns 502 when the upstream fetch fails', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Connection refused')));

        const response = await GET(withCookie());

        expect(response.status).toBe(502);
    });

    test('returns 502 for an upstream error page, never serving it as a script', async () => {
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response('<html>nope</html>', { status: 404 })),
        );

        const response = await GET(withCookie());

        expect(response.status).toBe(502);
        expect(response.headers.get('Content-Type')).not.toMatch(/javascript/);
    });

    test('returns 405 for POST', async () => {
        const response = await POST(withCookie('POST'));

        expect(response.status).toBe(405);
    });
});
