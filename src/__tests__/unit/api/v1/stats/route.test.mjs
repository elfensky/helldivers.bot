import { vi } from 'vitest';

// stats/route.js is the one v1 route that genuinely needs `config` (for
// `config.bucketSize`), and `@/config/server.mjs` parses process.env eagerly at
// module load — it throws when POSTGRES_URL / UPDATE_KEY / UPDATE_INTERVAL are
// absent, as they are in the test runner. Stub just the config object; the pure
// `getCacheControl` now comes from the env-free `@/config/policy.mjs` and runs
// for real.
const BUCKET_SIZE = 900;
vi.mock('@/config/server.mjs', () => ({ config: { bucketSize: BUCKET_SIZE } }));

// backfillAndRetry -> backfillSeason -> updateSeason hits the real HD1 API over
// the network. Stub the season module so a 404/backfill path never leaves the
// process. SEASON_NOT_FOUND must keep its identity: backfillSeason compares
// `error.cause === SEASON_NOT_FOUND` to choose 404 vs 500.
vi.mock('@/update/season.mjs', () => ({
    updateSeason: vi.fn(),
    SEASON_NOT_FOUND: 'SEASON_NOT_FOUND',
}));

const { GET, POST, PUT, DELETE, PATCH, OPTIONS } =
    await import('@/app/api/v1/h1/stats/route');
const { default: db } = await import('@/db/db');
const { updateSeason } = await import('@/update/season.mjs');
const { getCacheControl } = await import('@/config/policy.mjs');
const { encodeCursor } = await import('@/shared/utils/api/cursor.mjs');

const VALID_KEY = { id: 'key-1', userId: 'user-1', enabled: true };
const SEASON = 42;

function req(query = '', { key = 'test-key', headers = {} } = {}) {
    return new Request(`http://localhost/api/v1/h1/stats${query}`, {
        headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers },
    });
}

function statRow(enemy, bucket, overrides = {}) {
    return {
        enemy,
        bucket,
        players: 88,
        missions: 100,
        successful_missions: 70,
        kills: 1234n,
        deaths: 5n,
        shots: 99n,
        hits: 88n,
        ...overrides,
    };
}

// `getStats` uses Prisma model methods only, so `$queryRaw` belongs entirely to
// the rate limiter here — a plain resolved count is enough (no SQL dispatch).
let rateLimitCount = 1;

beforeEach(() => {
    // The global setup's beforeEach runs vi.clearAllMocks() before this one.
    rateLimitCount = 1;
    db.ApiKey.findUnique.mockResolvedValue(VALID_KEY);
    db.$queryRaw.mockImplementation(() => Promise.resolve([{ count: rateLimitCount }]));
    db.h1_season.findFirst.mockResolvedValue({ season: SEASON });
    db.h1_statistic.findMany.mockResolvedValue([statRow(0, 1700000000)]);
});

describe('GET /api/v1/h1/stats — auth gate', () => {
    test('401 when the Authorization header is missing entirely', async () => {
        const res = await GET(req('', { key: null }));
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.code).toBe(401);
        expect(body.error).toBe('Unauthorized');
        // The gate must short-circuit before any data read.
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('401 when the key is not in the database', async () => {
        db.ApiKey.findUnique.mockResolvedValue(null);
        const res = await GET(req());
        expect(res.status).toBe(401);
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('403 when the key exists but is disabled', async () => {
        db.ApiKey.findUnique.mockResolvedValue({ ...VALID_KEY, enabled: false });
        const res = await GET(req());
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('Forbidden');
    });

    test('503 when the key lookup itself fails (DB unreachable)', async () => {
        db.ApiKey.findUnique.mockRejectedValue(new Error('connection refused'));
        const res = await GET(req());
        expect(res.status).toBe(503);
    });
});

describe('GET /api/v1/h1/stats — query validation', () => {
    test.each([
        ['enemy is not a known faction', '?enemy=squids', /^Invalid query: enemy/],
        ['season is negative', '?season=-3', /^Invalid query: season/],
        ['limit is above the 500 cap', '?limit=501', /^Invalid query: limit/],
        ['limit is zero', '?limit=0', /^Invalid query: limit/],
        ['order is not asc/desc', '?order=sideways', /^Invalid query: order/],
        ['from is not a date', '?from=yesterday', /^Invalid query: from/],
    ])('400 when %s', async (_label, query, pattern) => {
        const res = await GET(req(query));
        expect(res.status).toBe(400);
        const body = await res.json();
        // errorResponse puts the canonical status text in `message` and the
        // caller's detail string in `error` — assert the field that carries it.
        expect(body.message).toBe('Bad Request');
        expect(body.error).toMatch(pattern);
        // Rejected before the season read — the guard is a real short-circuit.
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('400 on a garbage cursor, before the query runs', async () => {
        const res = await GET(req('?cursor=not-a-real-cursor'));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid cursor');
        expect(db.h1_statistic.findMany).not.toHaveBeenCalled();
    });
});

describe('GET /api/v1/h1/stats — happy path', () => {
    test('200 projects rows into the public shape with bucketSize and page meta', async () => {
        const res = await GET(req());
        expect(res.status).toBe(200);
        expect(res.headers.get('RateLimit-Limit')).toBe('30'); // history_read
        expect(res.headers.get('ETag')).toMatch(/^".+"$/);

        const body = await res.json();
        expect(body.code).toBe(200);
        expect(body.data).toEqual({
            season: SEASON,
            bucketSize: BUCKET_SIZE,
            items: [
                {
                    bucket: 1700000000,
                    enemy: 'bugs',
                    enemyId: 0,
                    season: SEASON,
                    missionsWon: 70,
                    missionsLost: 30,
                    // BigInt columns must survive JSON serialization as numbers.
                    kills: 1234,
                    deaths: 5,
                    shots: 99,
                    hits: 88,
                    players: 88,
                },
            ],
            page: { limit: 100, nextCursor: null },
        });
    });

    test('the query is driven by the parsed params (enemy, from/to, limit, order)', async () => {
        const res = await GET(
            req(
                '?season=7&enemy=illuminate&from=2023-11-14T22:13:20Z&to=2023-11-15T22:13:20Z&limit=5&order=asc',
            ),
        );
        expect(res.status).toBe(200);
        expect(db.h1_statistic.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    enemy: 2,
                    // ISO datetimes are converted to unix seconds for the query.
                    AND: [
                        { bucket: { gte: 1700000000 } },
                        { bucket: { lte: 1700086400 } },
                    ],
                }),
                // limit + 1 is the has-next-page probe.
                take: 6,
                orderBy: [{ bucket: 'asc' }, { enemy: 'asc' }],
            }),
        );
    });

    test('a full page advertises a cursor to continue from', async () => {
        // limit + 1 rows come back; the extra one is the next-page signal.
        db.h1_statistic.findMany.mockResolvedValue([
            statRow(0, 300),
            statRow(1, 300),
            statRow(0, 200),
        ]);
        const res = await GET(req('?limit=2'));
        const { data } = await res.json();
        expect(data.items).toHaveLength(2);
        expect(data.page).toEqual({ limit: 2, nextCursor: encodeCursor(300, 1) });
    });

    test('a decoded cursor becomes a keyset predicate on (bucket, enemy)', async () => {
        const res = await GET(req(`?cursor=${encodeCursor(500, 1)}`));
        expect(res.status).toBe(200);
        expect(db.h1_statistic.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: [
                        {
                            OR: [
                                { bucket: { lt: 500 } },
                                { bucket: 500, enemy: { gt: 1 } },
                            ],
                        },
                    ],
                }),
            }),
        );
    });
});

describe('GET /api/v1/h1/stats — caching', () => {
    test('season=current (the default) uses the short current-season tier', async () => {
        const res = await GET(req());
        expect(res.headers.get('Cache-Control')).toBe(getCacheControl('current-season'));
    });

    test('an explicit season number uses the long closed-season tier', async () => {
        const res = await GET(req('?season=7'));
        expect(res.headers.get('Cache-Control')).toBe(getCacheControl('closed-season'));
    });

    test('replaying the issued ETag as if-none-match yields a bodiless 304', async () => {
        const first = await GET(req('?season=7'));
        expect(first.status).toBe(200);
        const etag = first.headers.get('ETag');
        expect(etag).toBeTruthy();

        const second = await GET(
            req('?season=7', { headers: { 'if-none-match': etag } }),
        );
        expect(second.status).toBe(304);
        expect(second.headers.get('ETag')).toBe(etag);
        // The 304 must re-send the validators so the cache can refresh its TTL.
        expect(second.headers.get('Cache-Control')).toBe(
            getCacheControl('closed-season'),
        );
        expect(second.headers.get('RateLimit-Limit')).toBe('30');
        expect(await second.text()).toBe('');
    });

    test('a stale if-none-match falls through to a fresh 200', async () => {
        const res = await GET(req('', { headers: { 'if-none-match': '"stale"' } }));
        expect(res.status).toBe(200);
    });

    test('the ETag tracks the data, not the response envelope timing', async () => {
        const a = await GET(req('?season=7'));
        const b = await GET(req('?season=7'));
        expect(a.headers.get('ETag')).toBe(b.headers.get('ETag'));

        db.h1_statistic.findMany.mockResolvedValue([
            statRow(0, 1700000000, { kills: 9999n }),
        ]);
        const c = await GET(req('?season=7'));
        expect(c.headers.get('ETag')).not.toBe(a.headers.get('ETag'));
    });
});

describe('GET /api/v1/h1/stats — season resolution', () => {
    test('404 when season=current has no populated row, without backfilling', async () => {
        db.h1_season.findFirst.mockResolvedValue(null);
        const res = await GET(req());
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Season not found');
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('an explicit missing season is backfilled, then re-read and served', async () => {
        db.h1_season.findFirst
            .mockResolvedValueOnce(null) // first read: absent
            .mockResolvedValueOnce({ season: 12 }); // after backfill
        vi.mocked(updateSeason).mockResolvedValue({});

        const res = await GET(req('?season=12'));
        expect(res.status).toBe(200);
        expect(updateSeason).toHaveBeenCalledWith(12);
        const { data } = await res.json();
        expect(data.season).toBe(12);
    });

    test('404 after a backfill attempt when the season is unknown upstream', async () => {
        db.h1_season.findFirst.mockResolvedValue(null);
        const err = new Error('no such season');
        err.cause = 'SEASON_NOT_FOUND';
        vi.mocked(updateSeason).mockRejectedValue(err);

        const res = await GET(req('?season=999'));
        expect(res.status).toBe(404);
        expect(updateSeason).toHaveBeenCalledWith(999);
    });

    test('500 when the stats read throws', async () => {
        db.h1_statistic.findMany.mockRejectedValue(new Error('DB error'));
        const res = await GET(req());
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Internal server error');
    });
});

describe('GET /api/v1/h1/stats — rate limiting', () => {
    test('429 with Retry-After once the history_read window is exceeded', async () => {
        rateLimitCount = 100_000; // far past any configured limit

        const res = await GET(req());
        expect(res.status).toBe(429);
        expect(res.headers.get('Retry-After')).toBeTruthy();
        expect(res.headers.get('RateLimit-Remaining')).toBe('0');
        // Limiter must gate the data read, not merely annotate the response.
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('the limiter fails open when its counter store is unreachable', async () => {
        db.$queryRaw.mockRejectedValue(new Error('limiter store down'));
        const res = await GET(req());
        expect(res.status).toBe(200);
    });
});

describe('method not allowed', () => {
    test.each([
        ['POST', POST],
        ['PUT', PUT],
        ['DELETE', DELETE],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])('%s returns 405', async (_name, handler) => {
        const res = await handler();
        expect(res.status).toBe(405);
    });
});
