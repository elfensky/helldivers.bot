import { vi } from 'vitest';

// backfillAndRetry -> backfillSeason -> updateSeason hits the real HD1 API over
// the network. Stub the season module so a 404/backfill path never leaves the
// process. SEASON_NOT_FOUND must keep its identity: backfillSeason compares
// `error.cause === SEASON_NOT_FOUND` to choose 404 vs 500.
vi.mock('@/update/season.mjs', () => ({
    updateSeason: vi.fn(),
    SEASON_NOT_FOUND: 'SEASON_NOT_FOUND',
}));

const { GET, POST, PUT, DELETE, PATCH, OPTIONS } =
    await import('@/app/api/v1/h1/season/route');
const { default: db } = await import('@/db/db');
const { updateSeason } = await import('@/update/season.mjs');
const { getCacheControl } = await import('@/config/policy.mjs');

const VALID_KEY = { id: 'key-1', userId: 'user-1', enabled: true };
const CURRENT = 50;

function req(query = '', { key = 'test-key' } = {}) {
    return new Request(`http://localhost/api/v1/h1/season${query}`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
    });
}

function seasonRow(season, overrides = {}) {
    return {
        season,
        last_updated: new Date('2024-01-01T00:00:00Z'),
        // Rank-per-faction: bugs introduced 1st, illuminate 2nd, cyborgs 3rd.
        introduction_order: [0, 2, 1],
        points_max: [1000, 2000, 3000],
        season_duration: 604800,
        ...overrides,
    };
}

// Unlike the map/status routes, `getSeasons` uses Prisma model methods only —
// nothing else touches `$queryRaw`, so the limiter owns it outright and a plain
// resolved value is enough (no SQL-text dispatch needed here).
let rateLimitCount = 1;

beforeEach(() => {
    // The global setup's beforeEach runs vi.clearAllMocks() before this one.
    rateLimitCount = 1;
    db.ApiKey.findUnique.mockResolvedValue(VALID_KEY);
    db.$queryRaw.mockImplementation(() => Promise.resolve([{ count: rateLimitCount }]));
    // getSeasons resolves the current season from the newest stamped row.
    db.h1_season.findFirst.mockResolvedValue({ season: CURRENT });
    db.h1_season.findMany.mockResolvedValue([seasonRow(CURRENT)]);
});

describe('GET /api/v1/h1/season — auth gate', () => {
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

describe('GET /api/v1/h1/season — query validation', () => {
    test.each([
        ['non-numeric', '?season=abc'],
        ['zero', '?season=0'],
        ['negative', '?season=-3'],
        ['fractional', '?season=1.5'],
    ])('400 when season is %s', async (_label, query) => {
        const res = await GET(req(query));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.message).toBe('Bad Request');
        expect(body.error).toMatch(/^Invalid query: season/);
        // Rejected before the season read — the guard is a real short-circuit.
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('one bad value in a multi-season list rejects the whole request', async () => {
        const res = await GET(req('?season=1&season=nope&season=3'));
        expect(res.status).toBe(400);
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('no season param defaults to the current season', async () => {
        const res = await GET(req());
        expect(res.status).toBe(200);
        expect(db.h1_season.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { season: { in: [CURRENT] } } }),
        );
    });
});

describe('GET /api/v1/h1/season — happy path', () => {
    test('200 projects a season into the public shape with rate-limit headers', async () => {
        const res = await GET(req());
        expect(res.status).toBe(200);
        expect(res.headers.get('RateLimit-Limit')).toBeTruthy();
        expect(res.headers.get('RateLimit-Remaining')).toBeTruthy();

        const body = await res.json();
        expect(body.code).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toEqual({
            season: CURRENT,
            isCurrent: true,
            lastUpdated: '2024-01-01T00:00:00.000Z',
            // Real projection maths: [0, 2, 1] ranks bugs → illuminate → cyborgs.
            introductionOrder: ['bugs', 'illuminate', 'cyborgs'],
            pointsMax: { bugs: 1000, cyborgs: 2000, illuminate: 3000 },
            seasonDuration: 604800,
        });
    });

    test('repeated ?season= params are all passed through and returned', async () => {
        db.h1_season.findMany.mockResolvedValue([seasonRow(10), seasonRow(11)]);
        const res = await GET(req('?season=10&season=11'));
        expect(res.status).toBe(200);
        expect(db.h1_season.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { season: { in: [10, 11] } } }),
        );
        const { data } = await res.json();
        expect(data.map((s) => s.season)).toEqual([10, 11]);
        expect(data.every((s) => s.isCurrent === false)).toBe(true);
    });

    test('`current` mixed with its own number is de-duplicated into one query id', async () => {
        const res = await GET(req(`?season=current&season=${CURRENT}`));
        expect(res.status).toBe(200);
        expect(db.h1_season.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { season: { in: [CURRENT] } } }),
        );
    });
});

describe('GET /api/v1/h1/season — cache tier', () => {
    test('a response containing the current season uses the current-season tier', async () => {
        const res = await GET(req());
        expect(res.headers.get('Cache-Control')).toBe(getCacheControl('current-season'));
    });

    test('a closed-season-only response uses the long closed-season tier', async () => {
        db.h1_season.findMany.mockResolvedValue([seasonRow(10)]);
        const res = await GET(req('?season=10'));
        expect(res.headers.get('Cache-Control')).toBe(getCacheControl('closed-season'));
    });

    test('one current season among closed ones is enough to shorten the TTL', async () => {
        db.h1_season.findMany.mockResolvedValue([seasonRow(10), seasonRow(CURRENT)]);
        const res = await GET(req(`?season=10&season=${CURRENT}`));
        expect(res.headers.get('Cache-Control')).toBe(getCacheControl('current-season'));
    });
});

describe('GET /api/v1/h1/season — backfill', () => {
    test('a single explicit miss is backfilled, then re-read and served', async () => {
        db.h1_season.findMany
            .mockResolvedValueOnce([]) // first read: absent
            .mockResolvedValueOnce([seasonRow(12)]); // after backfill
        vi.mocked(updateSeason).mockResolvedValue({});

        const res = await GET(req('?season=12'));
        expect(res.status).toBe(200);
        expect(updateSeason).toHaveBeenCalledWith(12);
        const { data } = await res.json();
        expect(data.map((s) => s.season)).toEqual([12]);
    });

    test('404 after a backfill attempt when the season is unknown upstream', async () => {
        db.h1_season.findMany.mockResolvedValue([]);
        const err = new Error('no such season');
        err.cause = 'SEASON_NOT_FOUND';
        vi.mocked(updateSeason).mockRejectedValue(err);

        const res = await GET(req('?season=999'));
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Season not found');
        expect(updateSeason).toHaveBeenCalledWith(999);
    });

    test('a multi-season request never backfills — misses are silently omitted', async () => {
        // Season 10 exists, 11 does not. rows is non-empty, so the route serves
        // what it has; the caller must request 11 on its own to trigger a fetch.
        db.h1_season.findMany.mockResolvedValue([seasonRow(10)]);
        const res = await GET(req('?season=10&season=11'));
        expect(res.status).toBe(200);
        const { data } = await res.json();
        expect(data.map((s) => s.season)).toEqual([10]);
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('a multi-season request that misses entirely 404s without backfilling', async () => {
        db.h1_season.findMany.mockResolvedValue([]);
        const res = await GET(req('?season=997&season=998'));
        expect(res.status).toBe(404);
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('season=current is never backfilled — a missing current season is a DB fault', async () => {
        db.h1_season.findMany.mockResolvedValue([]);
        const res = await GET(req('?season=current'));
        expect(res.status).toBe(404);
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('404 without backfill when no season exists at all (getSeasons returns null)', async () => {
        db.h1_season.findFirst.mockResolvedValue(null);
        const res = await GET(req('?season=12'));
        expect(res.status).toBe(404);
        expect(updateSeason).not.toHaveBeenCalled();
    });
});

describe('GET /api/v1/h1/season — failures', () => {
    test('500 when the season read throws', async () => {
        db.h1_season.findMany.mockRejectedValue(new Error('DB error'));
        const res = await GET(req());
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Internal server error');
    });
});

describe('GET /api/v1/h1/season — rate limiting', () => {
    test('429 with Retry-After once the public_read window is exceeded', async () => {
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
