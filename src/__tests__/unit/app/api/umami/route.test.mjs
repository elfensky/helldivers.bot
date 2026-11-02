import { vi } from 'vitest';

// Stub env before importing the route
vi.stubEnv('UMAMI_SITE_URL', 'analytics.example.com');

const { POST } = await import('@/app/api/umami/route');

describe('POST /api/umami', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })));
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

    describe('visitor IP', () => {
        // The relay reaches Umami through Cloudflare a second time, which labels the hop with
        // this server's IP and country. payload.ip makes Umami use the visitor instead.
        const send = (body, cfConnectingIp) =>
            POST(
                new Request('http://localhost:3000/api/umami', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(cfConnectingIp && { 'CF-Connecting-IP': cfConnectingIp }),
                    },
                    body,
                }),
            );
        const sentBody = () => global.fetch.mock.calls[0][1].body;

        test('sets payload.ip from cf-connecting-ip', async () => {
            await send(
                JSON.stringify({ type: 'event', payload: { url: '/', website: 'w1' } }),
                '203.0.113.9',
            );

            expect(JSON.parse(sentBody())).toEqual({
                type: 'event',
                payload: { url: '/', website: 'w1', ip: '203.0.113.9' },
            });
        });

        test('replaces a client-sent payload.ip', async () => {
            await send(
                JSON.stringify({
                    type: 'event',
                    payload: { url: '/', ip: '198.51.100.7' },
                }),
                '203.0.113.9',
            );

            expect(JSON.parse(sentBody()).payload.ip).toBe('203.0.113.9');
        });

        test('forwards the body unchanged without cf-connecting-ip', async () => {
            const body = JSON.stringify({
                type: 'event',
                payload: { url: '/', ip: '198.51.100.7' },
            });
            await send(body);

            expect(sentBody()).toBe(body);
        });

        test('forwards a non-JSON body unchanged', async () => {
            await send('not json', '203.0.113.9');

            expect(sentBody()).toBe('not json');
        });

        test.each([
            '{"type":"event"}',
            '{"type":"event","payload":null}',
            '{"type":"event","payload":[1]}',
        ])(
            'forwards a body whose payload is not an object unchanged: %s',
            async (body) => {
                await send(body, '203.0.113.9');

                expect(sentBody()).toBe(body);
            },
        );
    });
});
