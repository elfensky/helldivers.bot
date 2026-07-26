import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// /api/auth/[...all]/route.js evaluates `if (auth) { ... }` at MODULE LOAD
// time, so to test both the configured and disabled branches we
// vi.resetModules() and override the @/auth mock per scenario.
// The global setup mock of @/auth is a truthy stub; that covers the
// configured path. For the disabled path we re-mock @/auth → { auth: null }.

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GET/POST /api/auth/[...all] — auth disabled (BETTER_AUTH_SECRET absent)', () => {
    beforeEach(() => {
        // Override the global @/auth mock so this scenario sees a null export.
        vi.resetModules();
        vi.doMock('@/auth', () => ({ auth: null }));
    });

    test('GET returns 503 with the standard JSON error body', async () => {
        const { GET } = await import('@/app/api/auth/[...all]/route');
        const res = await GET(new Request('http://localhost/api/auth/session'));
        expect(res.status).toBe(503);
        expect(res.headers.get('Content-Type')).toContain('application/json');
        const body = await res.json();
        expect(body).toEqual({
            error: 'Auth is not configured on this instance',
        });
    });

    test('POST returns 503 with the standard JSON error body', async () => {
        const { POST } = await import('@/app/api/auth/[...all]/route');
        const res = await POST(
            new Request('http://localhost/api/auth/sign-in', { method: 'POST' }),
        );
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body).toEqual({
            error: 'Auth is not configured on this instance',
        });
    });

    test('GET and POST share the same disabledHandler (no per-method drift)', async () => {
        const { GET, POST } = await import('@/app/api/auth/[...all]/route');
        // Both must produce the same body / status.
        const gRes = await GET(new Request('http://localhost/api/auth/session'));
        const pRes = await POST(
            new Request('http://localhost/api/auth/sign-in', { method: 'POST' }),
        );
        expect(gRes.status).toBe(pRes.status);
        expect(await gRes.json()).toEqual(await pRes.json());
    });
});

describe('GET/POST /api/auth/[...all] — auth configured', () => {
    // Spy targets for the BetterAuth handler delegation.
    const mockGet = vi.fn(async () => new Response('get-ok', { status: 200 }));
    const mockPost = vi.fn(async () => new Response('post-ok', { status: 200 }));
    const fakeAuth = { api: {}, $context: 'fake-auth-instance' };

    beforeEach(() => {
        mockGet.mockClear();
        mockPost.mockClear();
        vi.resetModules();
        // Explicitly re-mock @/auth as truthy here — earlier describes use
        // vi.doMock('@/auth', () => ({ auth: null })), and doMock persists
        // until overridden. We override with a non-null auth instance.
        vi.doMock('@/auth', () => ({ auth: fakeAuth }));
        vi.doMock('better-auth/next-js', () => ({
            toNextJsHandler: vi.fn(() => ({ GET: mockGet, POST: mockPost })),
        }));
    });

    test('GET delegates to toNextJsHandler(auth).GET', async () => {
        const { GET } = await import('@/app/api/auth/[...all]/route');
        const req = new Request('http://localhost/api/auth/session');
        const res = await GET(req);

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('get-ok');
        expect(mockGet).toHaveBeenCalledTimes(1);
        // The delegate is invoked with the actual Request, not a transformed copy.
        expect(mockGet).toHaveBeenCalledWith(req);
    });

    test('POST delegates to toNextJsHandler(auth).POST', async () => {
        const { POST } = await import('@/app/api/auth/[...all]/route');
        const req = new Request('http://localhost/api/auth/sign-in', {
            method: 'POST',
        });
        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('post-ok');
        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith(req);
    });

    test('toNextJsHandler is called once at module load with the auth instance', async () => {
        // The route does a top-level `await import('better-auth/next-js')`
        // and then calls toNextJsHandler(auth). Importing the route is what
        // triggers that — the test then re-reads the mocked module to inspect
        // the call record.
        await import('@/app/api/auth/[...all]/route');
        const betterAuthNextJs = await import('better-auth/next-js');
        expect(betterAuthNextJs.toNextJsHandler).toHaveBeenCalledTimes(1);
        // It receives the auth instance we mocked in beforeEach.
        expect(betterAuthNextJs.toNextJsHandler).toHaveBeenCalledWith(fakeAuth);
    });
});
