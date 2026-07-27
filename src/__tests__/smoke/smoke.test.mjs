const BASE_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';

// An unreachable server is a FAILURE, not a skip. This suite exists to catch
// "the app doesn't boot" — silently passing when there is nothing to talk to
// makes it a smoke alarm with the battery pulled out. CI must never be able to
// get a green tick from a suite that ran zero assertions.
//
// Local escape hatch: set SMOKE_ALLOW_SKIP=1 to downgrade to a skip while
// iterating without a server. It is opt-in on purpose — CI sets nothing, so
// CI fails.
const allowSkip = /^(1|true)$/i.test(process.env.SMOKE_ALLOW_SKIP ?? '');

const serverAvailable = await fetch(`${BASE_URL}/api/healthcheck`)
    .then(() => true)
    .catch(() => false);

if (!serverAvailable) {
    const hint =
        `No server is reachable at ${BASE_URL} — the smoke suite cannot verify anything.\n` +
        `    Start one first (npm run dev, or npm run build && npm start), or point the\n` +
        `    suite elsewhere with TEST_SERVER_URL=http://host:port.\n` +
        `    To skip instead of fail while working locally: SMOKE_ALLOW_SKIP=1 npm run test:smoke`;

    if (!allowSkip) {
        throw new Error(hint);
    }
    console.warn(`\n  ⚠ ${hint}\n  SMOKE_ALLOW_SKIP is set — skipping smoke tests.\n`);
}

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

// ─── Public v1 API ──────────────────────────────────────────────────
//
// Every /api/v1/h1/* route is key-gated, so these assertions need a real key in
// a real database. `SEED_TEST_API_KEY` supplies one. The CI workflow splits the
// key in two: `prisma/seed/seed.mjs` is handed only the sha-256 digest (which it
// writes to `ApiKey.hash`), and the plaintext comes here — the one place that
// actually has to put it on the wire as a Bearer token. Absent the variable the
// block skips, so `npm run test:smoke` against a plain dev server still works
// unchanged.
//
// What lives here and not in the unit suite: unit tests mock the DB and call the
// route handler directly, which cannot observe what an HTTP client actually
// receives. These assert the wire contract — response headers surviving the
// Next.js response pipeline, and the conditional-request round trip.
const apiKey = process.env.SEED_TEST_API_KEY ?? '';
const authHeaders = { Authorization: `Bearer ${apiKey}` };

// A season guaranteed to be in the seed corpus (prisma/seed/seasons/ ships
// 1..156). Used wherever a *closed* season is required: stats and
// status?mode=history pick their cache tier from the `season` param, so an
// explicit number is what makes them advertise the long TTL.
const CLOSED_SEASON = 1;

// Verbatim values from src/config/policy.mjs. Duplicated on purpose — asserting
// against an import of the same table would only prove the table equals itself.
const CACHE_CONTROL = {
    latest: 'public, max-age=10, stale-while-revalidate=30',
    currentSeason: 'public, max-age=60, stale-while-revalidate=300',
    closedSeason: 'public, max-age=3600, stale-while-revalidate=86400',
};

describe.runIf(serverAvailable && apiKey !== '')('Public v1 API smoke tests', () => {
    // The Frozen-Tail / Living-Head cache split plus the rate-limit grouping,
    // per route. These two headers are the API's whole freshness and fair-use
    // contract, and a route swapping tiers is invisible to every other check.
    const contracts = [
        {
            name: 'map',
            path: '/api/v1/h1/map',
            cacheControl: CACHE_CONTROL.latest,
            rateLimit: '120', // public_read
        },
        {
            name: 'season (includes current)',
            path: '/api/v1/h1/season',
            cacheControl: CACHE_CONTROL.currentSeason,
            rateLimit: '120', // public_read
        },
        {
            name: 'stats (closed season)',
            path: `/api/v1/h1/stats?season=${CLOSED_SEASON}`,
            cacheControl: CACHE_CONTROL.closedSeason,
            rateLimit: '30', // history_read
        },
        {
            name: 'status mode=latest',
            path: '/api/v1/h1/status?mode=latest',
            cacheControl: CACHE_CONTROL.latest,
            rateLimit: '120', // public_read
        },
        {
            name: 'status mode=history (closed season)',
            path: `/api/v1/h1/status?mode=history&season=${CLOSED_SEASON}`,
            cacheControl: CACHE_CONTROL.closedSeason,
            rateLimit: '30', // history_read
        },
    ];

    for (const { name, path, cacheControl, rateLimit } of contracts) {
        test(`GET ${name} returns 200 with its cache + rate-limit headers`, async () => {
            const response = await fetch(`${BASE_URL}${path}`, { headers: authHeaders });
            expect(response.status).toBe(200);
            expect(response.headers.get('cache-control')).toBe(cacheControl);
            expect(response.headers.get('ratelimit-limit')).toBe(rateLimit);
        });
    }

    test('stats ETag round-trips to a 304 via If-None-Match', async () => {
        const first = await fetch(`${BASE_URL}/api/v1/h1/stats?season=${CLOSED_SEASON}`, {
            headers: authHeaders,
        });
        expect(first.status).toBe(200);
        const etag = first.headers.get('etag');
        expect(etag).toBeTruthy();

        const second = await fetch(
            `${BASE_URL}/api/v1/h1/stats?season=${CLOSED_SEASON}`,
            { headers: { ...authHeaders, 'If-None-Match': etag } },
        );
        expect(second.status).toBe(304);
        // A 304 must re-send the validators so the client cache can refresh.
        expect(second.headers.get('etag')).toBe(etag);
        expect(second.headers.get('cache-control')).toBe(CACHE_CONTROL.closedSeason);
    });

    test('v1 route without an Authorization header returns 401', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/h1/map`);
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.code).toBe(401);
    });

    test('v1 route with an unknown API key returns 401', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/h1/map`, {
            headers: { Authorization: 'Bearer not-a-real-key' },
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.code).toBe(401);
    });

    test('map rejects a historical `at` with 400 (not yet supported)', async () => {
        const response = await fetch(`${BASE_URL}/api/v1/h1/map?at=2020-01-01`, {
            headers: authHeaders,
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.code).toBe(400);
    });

    test('stats rejects a malformed cursor with 400', async () => {
        const response = await fetch(
            `${BASE_URL}/api/v1/h1/stats?season=${CLOSED_SEASON}&cursor=not-a-cursor`,
            { headers: authHeaders },
        );
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.code).toBe(400);
    });

    // Deliberately NOT tested here: rate-limit exhaustion (429). The counter is a
    // shared fixed window keyed by client IP, so a test that burns 120 requests
    // to prove the 121st is rejected would poison every other assertion sharing
    // that window and go flaky the moment CI runs two jobs from one egress IP.
    // The limiter's arithmetic is covered by the unit suite instead; what only
    // an HTTP round trip can show — that the headers are emitted at all, with
    // the right per-group limit — is covered by `contracts` above.
});
