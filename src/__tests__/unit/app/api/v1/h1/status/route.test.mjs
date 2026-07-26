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
    await import('@/app/api/v1/h1/status/route');
const { default: db } = await import('@/db/db');
const { updateSeason } = await import('@/update/season.mjs');
const { getCacheControl } = await import('@/config/policy.mjs');
const { encodeCursor } = await import('@/shared/utils/api/cursor.mjs');

const VALID_KEY = { id: 'key-1', userId: 'user-1', enabled: true };
const SEASON = 42;
const BUCKET = 1700000000;

function req(query = '', { key = 'test-key', headers = {} } = {}) {
    return new Request(`http://localhost/api/v1/h1/status${query}`, {
        headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers },
    });
}

function seasonRow(overrides = {}) {
    return {
        season: SEASON,
        last_updated: new Date('2024-01-01T00:00:00Z'),
        introduction_order: [0, 1, 2],
        points_max: [1000, 2000, 3000],
        season_duration: 604800,
        ...overrides,
    };
}

/** A raw h1_status row as returned by getCampaign's DISTINCT ON query. */
function liveRow(enemy, overrides = {}) {
    return {
        id: `status-${enemy}`,
        season: SEASON,
        enemy,
        bucket: BUCKET,
        time: BUCKET + 5,
        points: 400,
        points_taken: 0,
        status: 'active',
        ...overrides,
    };
}

/** An h1_status history row as returned by getStatusHistory. */
function historyRow(enemy, bucket, points = 100) {
    return { enemy, points, time: bucket + 5, bucket };
}

/**
 * `enforceRateLimit` and `getCampaign` both go through `db.$queryRaw`, so a
 * `mockResolvedValueOnce` chain silently mis-feeds whichever runs first (the
 * limiter). Dispatch on the SQL text instead — order-independent, and it lets
 * the real limiter run rather than being stubbed out.
 */
let rateLimitCount = 1;
let liveStatusRows = [];
let liveStatRows = [];

function routeQueryRaw(strings) {
    const sql = Array.isArray(strings) ? strings.join(' ') : String(strings);
    if (sql.includes('api_rate_limit'))
        return Promise.resolve([{ count: rateLimitCount }]);
    if (sql.includes('h1_statistic')) return Promise.resolve(liveStatRows);
    if (sql.includes('h1_status')) return Promise.resolve(liveStatusRows);
    return Promise.resolve([]);
}

beforeEach(() => {
    // The global setup's beforeEach runs vi.clearAllMocks() before this one.
    rateLimitCount = 1;
    liveStatusRows = [liveRow(0), liveRow(1), liveRow(2)];
    liveStatRows = [];
    db.ApiKey.findUnique.mockResolvedValue(VALID_KEY);
    db.$queryRaw.mockImplementation(routeQueryRaw);
    db.h1_season.findFirst.mockResolvedValue(seasonRow());
    db.h1_status.findMany.mockResolvedValue([liveRow(0), liveRow(1), liveRow(2)]);
    db.h1_statistic.findMany.mockResolvedValue([]);
    db.h1_event.findMany.mockResolvedValue([]);
});

describe('GET /api/v1/h1/status — auth gate', () => {
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

    test('401 even on mode=history — the gate precedes the mode split', async () => {
        db.ApiKey.findUnique.mockResolvedValue(null);
        const res = await GET(req('?mode=history'));
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

describe('GET /api/v1/h1/status — query validation', () => {
    test.each([
        ['mode is not latest/history', '?mode=sideways', /^Invalid query: mode/],
        ['enemy is not a known faction', '?enemy=squids', /^Invalid query: enemy/],
        ['season is negative', '?season=-3', /^Invalid query: season/],
        ['limit is above the 500 cap', '?limit=501', /^Invalid query: limit/],
        ['limit is zero', '?limit=0', /^Invalid query: limit/],
        ['order is not asc/desc', '?order=sideways', /^Invalid query: order/],
        ['to is not a date', '?mode=history&to=tomorrow', /^Invalid query: to/],
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
});

describe('GET /api/v1/h1/status?mode=latest', () => {
    test('200 returns one item per faction with the real percent maths', async () => {
        const res = await GET(req());
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe(getCacheControl('latest'));
        // mode=latest is a live read: no ETag, and never a 304.
        expect(res.headers.get('ETag')).toBeNull();

        const { data } = await res.json();
        expect(data.mode).toBe('latest');
        expect(data.season).toBe(SEASON);
        expect(data.bucket).toBe(BUCKET);
        expect(data.items).toHaveLength(3);
        expect(data.items[0]).toEqual({
            enemy: 'bugs',
            enemyId: 0,
            points: 400,
            pointsMax: 1000,
            percent: 40,
            players: 0,
            updatedAt: new Date((BUCKET + 5) * 1000).toISOString(),
        });
        // points_max comes from the season row, so each faction gets its own.
        expect(data.items.map((i) => i.pointsMax)).toEqual([1000, 2000, 3000]);
        expect(data.page).toEqual({ limit: 100, nextCursor: null });
    });

    test('?enemy= narrows the response to that faction', async () => {
        const res = await GET(req('?enemy=illuminate'));
        const { data } = await res.json();
        expect(data.items).toHaveLength(1);
        expect(data.items[0].enemyId).toBe(2);
    });

    test('mode=latest is billed against the public_read group', async () => {
        const res = await GET(req());
        // public_read is 120/min; history_read is 30/min. The header is the
        // only externally visible proof of which group was charged.
        expect(res.headers.get('RateLimit-Limit')).toBe('120');
    });

    test('429 with Retry-After once the public_read window is exceeded', async () => {
        rateLimitCount = 100_000; // far past any configured limit
        const res = await GET(req());
        expect(res.status).toBe(429);
        // toBeTruthy() would pass for the string '0'. Retry-After must carry
        // the real seconds-until-window-reset, i.e. mirror RateLimit-Reset.
        const retryAfter = res.headers.get('Retry-After');
        expect(retryAfter).toBe(res.headers.get('RateLimit-Reset'));
        expect(Number(retryAfter)).toBeGreaterThan(0);
        expect(Number(retryAfter)).toBeLessThanOrEqual(60);
        expect(res.headers.get('RateLimit-Remaining')).toBe('0');
        // Limiter must gate the data read, not merely annotate the response.
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('the limiter fails open when its counter store is unreachable', async () => {
        db.$queryRaw.mockImplementation((strings) => {
            const sql = Array.isArray(strings) ? strings.join(' ') : String(strings);
            if (sql.includes('api_rate_limit')) {
                return Promise.reject(new Error('limiter store down'));
            }
            return routeQueryRaw(strings);
        });
        const res = await GET(req());
        expect(res.status).toBe(200);
    });

    test('404 when season=current has no populated row, without backfilling', async () => {
        db.h1_season.findFirst.mockResolvedValue(null);
        const res = await GET(req());
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Season not found');
        // `season=current` must never trigger a backfill — a missing current
        // season is a worker/DB fault, not an absent historic season.
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('an explicit missing season is backfilled, then re-read and served', async () => {
        db.h1_season.findFirst
            .mockResolvedValueOnce(null) // first read: absent
            .mockResolvedValueOnce(seasonRow({ season: 12 })); // after backfill
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

    test('500 when the campaign read throws', async () => {
        db.h1_season.findFirst.mockRejectedValue(new Error('DB error'));
        const res = await GET(req());
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Internal server error');
    });
});

describe('GET /api/v1/h1/status?mode=history', () => {
    beforeEach(() => {
        db.h1_status.findMany.mockResolvedValue([historyRow(0, BUCKET)]);
        db.h1_statistic.findMany.mockResolvedValue([
            { bucket: BUCKET, enemy: 0, players: 88 },
        ]);
    });

    test('200 returns bucketed history items merged with player counts', async () => {
        const res = await GET(req('?mode=history'));
        expect(res.status).toBe(200);

        const { data } = await res.json();
        expect(data.mode).toBe('history');
        expect(data.season).toBe(SEASON);
        expect(data.items).toEqual([
            {
                enemy: 'bugs',
                enemyId: 0,
                points: 100,
                pointsMax: 1000,
                percent: 10,
                // Players live on h1_statistic and are joined by `bucket:enemy`.
                players: 88,
                updatedAt: new Date((BUCKET + 5) * 1000).toISOString(),
                // history items carry `bucket`; latest items do not.
                bucket: BUCKET,
            },
        ]);
        expect(data.page).toEqual({ limit: 100, nextCursor: null });
    });

    test('mode=history is billed against the stricter history_read group', async () => {
        const res = await GET(req('?mode=history'));
        // 30/min vs public_read's 120/min — the mode picks the group.
        expect(res.headers.get('RateLimit-Limit')).toBe('30');
    });

    test('429 once the history_read window is exceeded', async () => {
        rateLimitCount = 100_000;
        const res = await GET(req('?mode=history'));
        expect(res.status).toBe(429);
        expect(res.headers.get('RateLimit-Limit')).toBe('30');
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('400 on a garbage cursor, before the query runs', async () => {
        const res = await GET(req('?mode=history&cursor=not-a-real-cursor'));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid cursor');
        expect(db.h1_status.findMany).not.toHaveBeenCalled();
    });

    test('a decoded cursor becomes a keyset predicate on (bucket, enemy)', async () => {
        const res = await GET(req(`?mode=history&cursor=${encodeCursor(500, 1)}`));
        expect(res.status).toBe(200);
        expect(db.h1_status.findMany).toHaveBeenCalledWith(
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

    test('order=asc flips both the sort and the cursor comparison', async () => {
        const res = await GET(
            req(`?mode=history&order=asc&cursor=${encodeCursor(500, 1)}`),
        );
        expect(res.status).toBe(200);
        expect(db.h1_status.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: [{ bucket: 'asc' }, { enemy: 'asc' }],
                where: expect.objectContaining({
                    AND: [
                        {
                            OR: [
                                { bucket: { gt: 500 } },
                                { bucket: 500, enemy: { gt: 1 } },
                            ],
                        },
                    ],
                }),
            }),
        );
    });

    test('from/to ISO datetimes become unix-second bucket bounds', async () => {
        const res = await GET(
            req(
                '?mode=history&from=2023-11-14T22:13:20Z&to=2023-11-15T22:13:20Z&limit=5',
            ),
        );
        expect(res.status).toBe(200);
        expect(db.h1_status.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: [
                        { bucket: { gte: 1700000000 } },
                        { bucket: { lte: 1700086400 } },
                    ],
                }),
                // limit + 1 is the has-next-page probe.
                take: 6,
            }),
        );
    });

    test('a full page advertises a cursor to continue from', async () => {
        // limit + 1 rows come back; the extra one is the next-page signal.
        db.h1_status.findMany.mockResolvedValue([
            historyRow(0, 300),
            historyRow(1, 300),
            historyRow(0, 200),
        ]);
        const res = await GET(req('?mode=history&limit=2'));
        const { data } = await res.json();
        expect(data.items).toHaveLength(2);
        expect(data.page).toEqual({ limit: 2, nextCursor: encodeCursor(300, 1) });
    });

    test('season=current uses the short tier, an explicit number the long one', async () => {
        const live = await GET(req('?mode=history'));
        expect(live.headers.get('Cache-Control')).toBe(getCacheControl('current-season'));

        const closed = await GET(req('?mode=history&season=7'));
        expect(closed.headers.get('Cache-Control')).toBe(
            getCacheControl('closed-season'),
        );
    });

    test('replaying the issued ETag as if-none-match yields a bodiless 304', async () => {
        const first = await GET(req('?mode=history&season=7'));
        expect(first.status).toBe(200);
        const etag = first.headers.get('ETag');
        expect(etag).toBeTruthy();

        const second = await GET(
            req('?mode=history&season=7', { headers: { 'if-none-match': etag } }),
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
        const res = await GET(
            req('?mode=history', { headers: { 'if-none-match': '"stale"' } }),
        );
        expect(res.status).toBe(200);
    });

    test('the ETag tracks the data, not the response envelope timing', async () => {
        const a = await GET(req('?mode=history&season=7'));
        const b = await GET(req('?mode=history&season=7'));
        expect(a.headers.get('ETag')).toBe(b.headers.get('ETag'));

        db.h1_status.findMany.mockResolvedValue([historyRow(0, BUCKET, 999)]);
        const c = await GET(req('?mode=history&season=7'));
        expect(c.headers.get('ETag')).not.toBe(a.headers.get('ETag'));
    });

    test('404 when season=current has no populated row, without backfilling', async () => {
        db.h1_season.findFirst.mockResolvedValue(null);
        const res = await GET(req('?mode=history'));
        expect(res.status).toBe(404);
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('an explicit missing season is backfilled, then re-read and served', async () => {
        db.h1_season.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(seasonRow({ season: 12 }));
        vi.mocked(updateSeason).mockResolvedValue({});

        const res = await GET(req('?mode=history&season=12'));
        expect(res.status).toBe(200);
        expect(updateSeason).toHaveBeenCalledWith(12);
        const { data } = await res.json();
        expect(data.season).toBe(12);
    });

    test('500 when the history read throws', async () => {
        db.h1_status.findMany.mockRejectedValue(new Error('DB error'));
        const res = await GET(req('?mode=history'));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Internal server error');
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
