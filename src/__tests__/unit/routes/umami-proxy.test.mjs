import { vi } from 'vitest';

// Stub env before importing the route
vi.stubEnv('UMAMI_SITE_URL', 'analytics.example.com');

const { POST } = await import('@/app/api/umami/route');

describe('POST /api/umami', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = vi.fn(() =>
            Promise.resolve(new Response('ok', { status: 200 })),
        );
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('forwards body and headers to Umami', async () => {
        const body = JSON.stringify({ type: 'event', payload: { url: '/' } });
        const request = new Request('http://localhost:3000/api/umami', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TestBrowser/1.0',
                'X-Forwarded-For': '1.2.3.4',
            },
            body,
        });

        const response = await POST(request);

        expect(global.fetch).toHaveBeenCalledOnce();
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://analytics.example.com/api/send');
        expect(options.method).toBe('POST');
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(options.headers['User-Agent']).toBe('TestBrowser/1.0');
        expect(options.headers['X-Forwarded-For']).toBe('1.2.3.4');
        expect(options.body).toBe(body);
        expect(response.status).toBe(200);
    });

    test('returns 405 for non-POST methods', async () => {
        const request = new Request('http://localhost:3000/api/umami', {
            method: 'GET',
        });

        const { GET } = await import('@/app/api/umami/route');
        const response = await GET(request);
        expect(response.status).toBe(405);
    });

    test('returns 502 when Umami is unreachable', async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error('Connection refused')));

        const request = new Request('http://localhost:3000/api/umami', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });

        const response = await POST(request);
        expect(response.status).toBe(502);
    });
});
