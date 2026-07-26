import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// /api/glitchtip is a CSP-violation / Sentry tunnel route. It captures
// `process.env.SENTRY_DSN` at MODULE LOAD time — so to test different DSN
// configurations we vi.resetModules() and dynamic-import the route after
// stubbing the env. Otherwise the const DSN closure won't see the new env.

const SAMPLE_DSN = 'https://abc123publickey@glitchtip.example.com/42';
const SAMPLE_ENVELOPE = '{"event_id":"x"}\n{"type":"event"}\n{"message":"hi"}';

async function loadRoute() {
    vi.resetModules();
    return await import('@/app/api/glitchtip/route');
}

function postEnvelope(body = SAMPLE_ENVELOPE) {
    return new Request('http://localhost/api/glitchtip', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body,
    });
}

beforeEach(() => {
    // Default: DSN configured. Individual tests override.
    vi.stubEnv('SENTRY_DSN', SAMPLE_DSN);
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete globalThis.fetch;
});

describe('POST /api/glitchtip — DSN not configured', () => {
    test('returns 503 "Tunnel not configured" when SENTRY_DSN is unset', async () => {
        vi.stubEnv('SENTRY_DSN', '');
        const { POST } = await loadRoute();

        const res = await POST(postEnvelope());

        expect(res.status).toBe(503);
        const text = await res.text();
        expect(text).toBe('Tunnel not configured');
    });

    test('does not attempt to fetch the upstream when DSN is unset', async () => {
        vi.stubEnv('SENTRY_DSN', '');
        const fetchSpy = vi.fn();
        globalThis.fetch = fetchSpy;
        const { POST } = await loadRoute();

        await POST(postEnvelope());

        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('POST /api/glitchtip — forwarding', () => {
    test('forwards the raw body to the correct upstream URL derived from the DSN', async () => {
        const fetchSpy = vi.fn(() =>
            Promise.resolve(new Response(null, { status: 200 })),
        );
        globalThis.fetch = fetchSpy;
        const { POST } = await loadRoute();

        await POST(postEnvelope(SAMPLE_ENVELOPE));

        // DSN: https://abc123publickey@glitchtip.example.com/42
        //   → host=glitchtip.example.com, publicKey=abc123publickey, projectId=42
        //   → ingestUrl=https://glitchtip.example.com/api/42/envelope/?sentry_key=abc123publickey&sentry_version=7
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0];
        expect(url).toBe(
            'https://glitchtip.example.com/api/42/envelope/?sentry_key=abc123publickey&sentry_version=7',
        );
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({
            'Content-Type': 'text/plain;charset=UTF-8',
        });
        expect(init.body).toBe(SAMPLE_ENVELOPE);
    });

    test('mirrors the upstream status code on the response', async () => {
        const fetchSpy = vi.fn(() =>
            Promise.resolve(new Response(null, { status: 202 })),
        );
        globalThis.fetch = fetchSpy;
        const { POST } = await loadRoute();

        const res = await POST(postEnvelope());

        expect(res.status).toBe(202);
    });

    test('upstream 4xx is mirrored (status passes through, body is null)', async () => {
        const fetchSpy = vi.fn(() =>
            Promise.resolve(new Response('rejected', { status: 413 })),
        );
        globalThis.fetch = fetchSpy;
        const { POST } = await loadRoute();

        const res = await POST(postEnvelope());

        expect(res.status).toBe(413);
        // Source returns `new Response(null, { status: response.status })` — body is empty.
        expect(await res.text()).toBe('');
    });
});

describe('POST /api/glitchtip — failure', () => {
    test('returns 502 "Tunnel error" when the upstream fetch throws', async () => {
        globalThis.fetch = vi.fn(() => Promise.reject(new Error('connection refused')));
        const { POST } = await loadRoute();

        const res = await POST(postEnvelope());

        expect(res.status).toBe(502);
        const text = await res.text();
        expect(text).toBe('Tunnel error');
    });
});

describe('POST /api/glitchtip — DSN parsing edge cases', () => {
    test('DSN with non-numeric project id is still parsed (project id is just the path segment)', async () => {
        vi.stubEnv('SENTRY_DSN', 'https://key@glitchtip.example.com/project-name');
        const fetchSpy = vi.fn(() =>
            Promise.resolve(new Response(null, { status: 200 })),
        );
        globalThis.fetch = fetchSpy;
        const { POST } = await loadRoute();

        await POST(postEnvelope());

        expect(fetchSpy.mock.calls[0][0]).toBe(
            'https://glitchtip.example.com/api/project-name/envelope/?sentry_key=key&sentry_version=7',
        );
    });

    test('DSN with non-default port is preserved in the ingest URL', async () => {
        vi.stubEnv('SENTRY_DSN', 'https://key@glitchtip.example.com:8443/7');
        const fetchSpy = vi.fn(() =>
            Promise.resolve(new Response(null, { status: 200 })),
        );
        globalThis.fetch = fetchSpy;
        const { POST } = await loadRoute();

        await POST(postEnvelope());

        expect(fetchSpy.mock.calls[0][0]).toBe(
            'https://glitchtip.example.com:8443/api/7/envelope/?sentry_key=key&sentry_version=7',
        );
    });
});
