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
    await import('@/app/api/v1/h1/map/route');
const { default: db } = await import('@/db/db');
const { updateSeason } = await import('@/update/season.mjs');
const { getCacheControl } = await import('@/config/policy.mjs');

const VALID_KEY = { id: 'key-1', userId: 'user-1', enabled: true };

function req(query = '', { key = 'test-key' } = {}) {
    return new Request(`http://localhost/api/v1/h1/map${query}`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
    });
}

function seasonRow(overrides = {}) {
    return {
        season: 34,
        last_updated: new Date('2024-01-01T00:00:00Z'),
        introduction_order: [0, 1, 2],
        points_max: [1000, 2000, 3000],
        season_duration: 604800,
        ...overrides,
    };
}

function statusRow(enemy, overrides = {}) {
    return {
        id: `status-${enemy}`,
        season: 34,
        enemy,
        bucket: 100,
        time: 105,
        // 40% of the 1000-point front => sectors 1-4 held, 5 in progress.
        points: 400,
        points_taken: 0,
        status: 'active',
        ...overrides,
    };
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

/** Wire the db mock up for a season that exists and is fully populated. */
function givenPopulatedSeason({ events = [] } = {}) {
    db.h1_season.findFirst.mockResolvedValue(seasonRow());
    liveStatusRows = [statusRow(0), statusRow(1), statusRow(2)];
    db.h1_status.findMany.mockResolvedValue([statusRow(0), statusRow(1), statusRow(2)]);
    db.h1_statistic.findMany.mockResolvedValue([]);
    db.h1_event.findMany.mockResolvedValue(events);
}

beforeEach(() => {
    // The global setup's beforeEach runs vi.clearAllMocks() before this one.
    rateLimitCount = 1;
    liveStatusRows = [];
    liveStatRows = [];
    db.ApiKey.findUnique.mockResolvedValue(VALID_KEY);
    db.$queryRaw.mockImplementation(routeQueryRaw);
});

describe('GET /api/v1/h1/map — auth gate', () => {
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

describe('GET /api/v1/h1/map — query validation', () => {
    test('400 when at=<datetime> (historical map not yet supported)', async () => {
        const res = await GET(req('?at=2024-01-01T00:00:00Z'));
        expect(res.status).toBe(400);
        const body = await res.json();
        // errorResponse puts the canonical status text in `message` and the
        // caller's detail string in `error` — assert the field that carries it.
        expect(body.message).toBe('Bad Request');
        expect(body.error).toMatch(/use at=latest/);
        // Rejected before the season read — the guard is a real short-circuit.
        expect(db.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('400 with a field-scoped message when enemy is not a known faction', async () => {
        const res = await GET(req('?enemy=squids'));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/^Invalid query: enemy/);
    });

    test('400 when season is not a positive integer', async () => {
        const res = await GET(req('?season=-3'));
        expect(res.status).toBe(400);
    });

    test('at=latest is the default and is accepted', async () => {
        givenPopulatedSeason();
        const res = await GET(req());
        expect(res.status).toBe(200);
    });
});

describe('GET /api/v1/h1/map — happy path', () => {
    test('200 returns the projected fronts, season/bucket meta and rate-limit headers', async () => {
        givenPopulatedSeason();

        const res = await GET(req());
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe(getCacheControl('latest'));
        // public_read is 120/min; history_read is 30/min. The header is the
        // only externally visible proof of which group was charged.
        expect(res.headers.get('RateLimit-Limit')).toBe('120');
        // The mocked counter returns count=1, so 119 of 120 remain.
        expect(res.headers.get('RateLimit-Remaining')).toBe('119');

        const body = await res.json();
        expect(body.code).toBe(200);

        const { data } = body;
        expect(data.season).toBe(34);
        expect(data.bucket).toBe(100);
        expect(data.events).toBe('active');
        expect(Object.keys(data.fronts).sort()).toEqual([
            'bugs',
            'cyborgs',
            'illuminate',
            'superEarth',
        ]);

        // Real map maths, not a stub: 400/1000 points on a 10-sector front means
        // sectors 1-4 are captured and sector 5 is in progress.
        const bugs = data.fronts.bugs;
        expect(bugs.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(bugs.find((r) => r.id === 4).status).toBe('captured');
        expect(bugs.find((r) => r.id === 5).status).toBe('in_progress');
        expect(bugs.find((r) => r.id === 6).status).toBe('lost');
        // Each region is self-identifying and carries the camelCased projection.
        expect(bugs[0]).toHaveProperty('pointsMax');
        expect(bugs[0]).not.toHaveProperty('points_max');
    });

    test('only ACTIVE events reach activeEvents (the live-map filter invariant)', async () => {
        givenPopulatedSeason({
            events: [
                {
                    type: 'attack',
                    event_id: 1,
                    status: 'active',
                    enemy: 0,
                    region: 11,
                    points: 10,
                    points_max: 100,
                    start_time: 1,
                    end_time: 2,
                },
                {
                    type: 'defend',
                    event_id: 2,
                    status: 'success',
                    enemy: 1,
                    region: 3,
                    points: 20,
                    points_max: 200,
                    start_time: 3,
                    end_time: 4,
                },
            ],
        });

        const res = await GET(req());
        const { data } = await res.json();
        expect(data.activeEvents).toHaveLength(1);
        expect(data.activeEvents[0]).toMatchObject({
            type: 'attack',
            enemy: 'bugs',
            enemyId: 0,
            region: 11,
            pointsMax: 100,
            startTime: 1,
            endTime: 2,
        });
    });

    test('events=none drops the overlay and empties activeEvents', async () => {
        givenPopulatedSeason({
            events: [
                {
                    type: 'attack',
                    event_id: 1,
                    status: 'active',
                    enemy: 0,
                    region: 11,
                    points: 10,
                    points_max: 100,
                    start_time: 1,
                    end_time: 2,
                },
            ],
        });

        const res = await GET(req('?events=none'));
        expect(res.status).toBe(200);
        const { data } = await res.json();
        expect(data.events).toBe('none');
        expect(data.activeEvents).toEqual([]);
    });

    test('enemy=cyborgs narrows fronts to that faction plus superEarth', async () => {
        givenPopulatedSeason();
        const res = await GET(req('?enemy=cyborgs'));
        expect(res.status).toBe(200);
        const { data } = await res.json();
        expect(Object.keys(data.fronts).sort()).toEqual(['cyborgs', 'superEarth']);
    });
});

describe('GET /api/v1/h1/map — rate limiting', () => {
    test('429 with Retry-After once the public_read window is exceeded', async () => {
        givenPopulatedSeason();
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
        givenPopulatedSeason();
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
});

describe('GET /api/v1/h1/map — season resolution', () => {
    test('404 when the current season has no populated row (never backfilled)', async () => {
        db.h1_season.findFirst.mockResolvedValue(null);

        const res = await GET(req());
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Season not found');
        // `season=current` must never trigger a backfill — a missing current
        // season is a worker/DB fault, not an absent historic season.
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('404 after a backfill attempt when an explicit season is unknown upstream', async () => {
        db.h1_season.findFirst.mockResolvedValue(null);
        const err = new Error('no such season');
        err.cause = 'SEASON_NOT_FOUND';
        vi.mocked(updateSeason).mockRejectedValue(err);

        const res = await GET(req('?season=999'));
        expect(res.status).toBe(404);
        expect(updateSeason).toHaveBeenCalledWith(999);
    });

    test('an explicit missing season is backfilled, then re-read and served', async () => {
        db.h1_season.findFirst
            .mockResolvedValueOnce(null) // first read: absent
            .mockResolvedValueOnce(seasonRow({ season: 12 })); // after backfill
        liveStatusRows = [statusRow(0), statusRow(1), statusRow(2)];
        db.h1_status.findMany.mockResolvedValue([statusRow(0)]);
        db.h1_statistic.findMany.mockResolvedValue([]);
        db.h1_event.findMany.mockResolvedValue([]);
        vi.mocked(updateSeason).mockResolvedValue({});

        const res = await GET(req('?season=12'));
        expect(res.status).toBe(200);
        expect(updateSeason).toHaveBeenCalledWith(12);
        const { data } = await res.json();
        expect(data.season).toBe(12);
    });

    test('500 when the season read throws', async () => {
        db.h1_season.findFirst.mockRejectedValue(new Error('DB error'));
        const res = await GET(req());
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
