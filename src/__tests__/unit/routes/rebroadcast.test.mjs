import { vi } from 'vitest';

vi.mock('@/db/db', () => ({
    default: {
        h1_season: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        h1_status: {
            findMany: vi.fn(),
        },
        h1_event: {
            findMany: vi.fn(),
        },
        $queryRaw: vi.fn(),
    },
}));
vi.mock('@/db/queries/validateApiKey', () => ({ validateApiKey: vi.fn() }));
vi.mock('@/update/season', () => ({ updateSeason: vi.fn() }));
vi.mock('@/shared/utils/umami', () => ({ umamiTrackEvent: vi.fn() }));
vi.mock('next/server', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        after: vi.fn((fn) => fn()),
    };
});

import { POST, GET, PUT, DELETE, PATCH, OPTIONS } from '@/app/api/h1/rebroadcast/route';
import db from '@/db/db';
import { validateApiKey } from '@/db/queries/validateApiKey';
import { updateSeason } from '@/update/season';

function createPostRequest(formEntries) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(formEntries)) {
        formData.append(key, String(value));
    }
    return new Request('http://localhost/api/h1/rebroadcast', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: formData,
    });
}

// Helpers to build the shape the route's DISTINCT ON / findMany queries return.
function makeSeasonRow(overrides = {}) {
    return {
        season: 34,
        intro_order_array: [0, 1, 2],
        points_max_array: [1000, 2000, 3000],
        season_duration: 604800,
        last_updated: new Date('2024-01-01T00:00:00Z'),
        ...overrides,
    };
}
function makeStatusRow(enemy, overrides = {}) {
    return {
        id: `status-${enemy}`,
        season: 34,
        enemy,
        bucket: 100,
        time: 105,
        points: 100 * (enemy + 1),
        points_taken: 50 * (enemy + 1),
        status: 'active',
        ...overrides,
    };
}
function makeStatRow(enemy, overrides = {}) {
    return {
        id: `stat-${enemy}`,
        season: 34,
        enemy,
        bucket: 100,
        time: 110,
        players: 42 + enemy,
        total_unique_players: 420 + enemy,
        missions: 10 + enemy,
        successful_missions: 8 + enemy,
        total_mission_difficulty: 90 + enemy,
        completed_planets: 5 + enemy,
        kills: 1000n + BigInt(enemy),
        deaths: 200n + BigInt(enemy),
        accidentals: 30n + BigInt(enemy),
        shots: 5000n + BigInt(enemy),
        hits: 2500n + BigInt(enemy),
        ...overrides,
    };
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(validateApiKey).mockResolvedValue({
        data: { userId: '1', keyId: '1' },
        error: null,
    });
});

describe('POST /api/h1/rebroadcast — auth & validation', () => {
    test('returns 401 when API key is invalid', async () => {
        vi.mocked(validateApiKey).mockResolvedValue({
            data: null,
            error: 'invalid',
        });
        const res = await POST(createPostRequest({ action: 'get_campaign_status' }));
        expect(res.status).toBe(401);
    });

    test('returns 403 when API key is disabled', async () => {
        vi.mocked(validateApiKey).mockResolvedValue({
            data: null,
            error: 'disabled',
        });
        const res = await POST(createPostRequest({ action: 'get_campaign_status' }));
        expect(res.status).toBe(403);
    });

    test('returns 400 for invalid content type', async () => {
        const request = new Request('http://localhost/api/h1/rebroadcast', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                Authorization: 'Bearer test-key',
            },
            body: JSON.stringify({ action: 'test' }),
        });
        const res = await POST(request);
        expect(res.status).toBe(400);
    });

    test('returns 400 when no action set', async () => {
        const res = await POST(createPostRequest({ foo: 'bar' }));
        expect(res.status).toBe(400);
    });

    test('returns 400 for invalid action', async () => {
        const res = await POST(createPostRequest({ action: 'invalid_action' }));
        expect(res.status).toBe(400);
    });
});

describe('POST /api/h1/rebroadcast — get_campaign_status', () => {
    test('reconstructs wire format from h1_season + h1_status + h1_statistic + h1_event', async () => {
        db.h1_season.findFirst.mockResolvedValue(makeSeasonRow());
        db.$queryRaw
            // first call: status DISTINCT ON
            .mockResolvedValueOnce([
                makeStatusRow(0),
                makeStatusRow(1),
                makeStatusRow(2),
            ])
            // second call: statistic DISTINCT ON
            .mockResolvedValueOnce([
                makeStatRow(0),
                makeStatRow(1),
                makeStatRow(2),
            ]);
        db.h1_event.findMany.mockResolvedValue([
            { type: 'defend', event_id: 1, status: 'active', points: 10, points_max: 100 },
            { type: 'attack', event_id: 2, status: 'active', points: 20, points_max: 200 },
            { type: 'attack', event_id: 3, status: 'active', points: 30, points_max: 300 },
        ]);

        const res = await POST(createPostRequest({ action: 'get_campaign_status' }));
        expect(res.status).toBe(200);
        const body = await res.json();

        // Wire shape
        expect(body.data.error_code).toBe(0);
        expect(body.data.introduction_order).toEqual([0, 1, 2]);
        expect(body.data.points_max).toEqual([1000, 2000, 3000]);
        expect(body.data.time).toBe(110); // max of status.time (105) and stats.time (110)

        // campaign_status[] — one row per faction, enriched with season arrays
        expect(body.data.campaign_status).toHaveLength(3);
        expect(body.data.campaign_status[0]).toEqual({
            enemy: 0,
            points: 100,
            points_taken: 50,
            points_max: 1000,
            status: 'active',
            introduction_order: 0,
        });

        // statistics[] — 3 entries (one per faction), BigInt fields serialized as numbers
        expect(body.data.statistics).toHaveLength(3);
        expect(body.data.statistics[0]).toMatchObject({
            enemy: 0,
            season_duration: 604800,
            players: 42,
            total_unique_players: 420,
            missions: 10,
            successful_missions: 8,
            total_mission_difficulty: 90,
            completed_planets: 5,
            kills: 1000,
            deaths: 200,
            accidentals: 30,
            shots: 5000,
            hits: 2500,
        });

        // The 4 derivable event-count fields MUST be absent.
        expect(body.data.statistics[0]).not.toHaveProperty('defend_events');
        expect(body.data.statistics[0]).not.toHaveProperty('successful_defend_events');
        expect(body.data.statistics[0]).not.toHaveProperty('attack_events');
        expect(body.data.statistics[0]).not.toHaveProperty('successful_attack_events');

        // Active events — defend_event (single) + attack_events (array)
        expect(body.data.defend_event).toMatchObject({ type: 'defend', event_id: 1 });
        expect(body.data.attack_events).toHaveLength(2);
        expect(body.data.attack_events[0]).toMatchObject({ type: 'attack', event_id: 2 });
    });

    test('fills missing faction stats with zero defaults', async () => {
        db.h1_season.findFirst.mockResolvedValue(makeSeasonRow());
        db.$queryRaw
            .mockResolvedValueOnce([
                makeStatusRow(0),
                makeStatusRow(1),
                makeStatusRow(2),
            ])
            // Only enemy 0 has a stat row — 1 and 2 missing.
            .mockResolvedValueOnce([makeStatRow(0)]);
        db.h1_event.findMany.mockResolvedValue([]);

        const res = await POST(createPostRequest({ action: 'get_campaign_status' }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.statistics[1].players).toBe(0);
        expect(body.data.statistics[1].kills).toBe(0);
        expect(body.data.statistics[2].kills).toBe(0);
        expect(body.data.defend_event).toBeNull();
        expect(body.data.attack_events).toEqual([]);
    });

    test('returns 404 when no season has been populated yet', async () => {
        db.h1_season.findFirst.mockResolvedValue(null);

        const res = await POST(createPostRequest({ action: 'get_campaign_status' }));
        expect(res.status).toBe(404);
    });

    test('returns 404 when an underlying query throws', async () => {
        db.h1_season.findFirst.mockRejectedValue(new Error('DB error'));

        const res = await POST(createPostRequest({ action: 'get_campaign_status' }));
        expect(res.status).toBe(404);
    });
});

describe('POST /api/h1/rebroadcast — get_snapshots', () => {
    test('reconstructs wire format from h1_season + h1_status + h1_event', async () => {
        db.h1_season.findUnique.mockResolvedValue(makeSeasonRow({ season: 5 }));
        // Two buckets, each with all 3 factions populated
        db.h1_status.findMany.mockResolvedValue([
            makeStatusRow(0, { season: 5, bucket: 100, time: 105 }),
            makeStatusRow(1, { season: 5, bucket: 100, time: 106 }),
            makeStatusRow(2, { season: 5, bucket: 100, time: 104 }),
            makeStatusRow(0, { season: 5, bucket: 200, time: 205 }),
            makeStatusRow(1, { season: 5, bucket: 200, time: 206 }),
            makeStatusRow(2, { season: 5, bucket: 200, time: 207 }),
        ]);
        db.h1_event.findMany.mockResolvedValue([
            { type: 'defend', event_id: 10, status: 'won' },
            { type: 'attack', event_id: 20, status: 'active' },
        ]);

        const res = await POST(
            createPostRequest({ action: 'get_snapshots', season: '5' }),
        );
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.data.error_code).toBe(0);
        expect(body.data.introduction_order).toEqual([0, 1, 2]);
        expect(body.data.points_max).toEqual([1000, 2000, 3000]);
        expect(body.data.snapshots).toHaveLength(2);
        // Frame time is the max poll time within the bucket.
        expect(body.data.snapshots[0].time).toBe(106);
        expect(body.data.snapshots[1].time).toBe(207);
        expect(body.data.snapshots[0].season).toBe(5);

        // The `data` field is a stringified JSON array, one entry per faction.
        const parsed = JSON.parse(body.data.snapshots[0].data);
        expect(parsed).toHaveLength(3);
        expect(parsed[0]).toEqual({ points: 100, points_taken: 50, status: 'active' });
        expect(parsed[1]).toEqual({ points: 200, points_taken: 100, status: 'active' });
        expect(parsed[2]).toEqual({ points: 300, points_taken: 150, status: 'active' });

        // Events split by type.
        expect(body.data.defend_events).toHaveLength(1);
        expect(body.data.attack_events).toHaveLength(1);
    });

    test('drops sparse buckets missing one or more factions', async () => {
        db.h1_season.findUnique.mockResolvedValue(makeSeasonRow({ season: 5 }));
        db.h1_status.findMany.mockResolvedValue([
            // Sparse bucket: only enemy 0 + 1 written, enemy 2 missing.
            makeStatusRow(0, { season: 5, bucket: 100, time: 105 }),
            makeStatusRow(1, { season: 5, bucket: 100, time: 106 }),
            // Dense bucket: all 3 factions present.
            makeStatusRow(0, { season: 5, bucket: 200, time: 205 }),
            makeStatusRow(1, { season: 5, bucket: 200, time: 206 }),
            makeStatusRow(2, { season: 5, bucket: 200, time: 207 }),
        ]);
        db.h1_event.findMany.mockResolvedValue([]);

        const res = await POST(
            createPostRequest({ action: 'get_snapshots', season: '5' }),
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.snapshots).toHaveLength(1);
        expect(body.data.snapshots[0].time).toBe(207);
    });

    test('fetches from remote when local season is missing, then returns reconstructed data', async () => {
        db.h1_season.findUnique
            .mockResolvedValueOnce(null) // first attempt: no local row
            .mockResolvedValueOnce(makeSeasonRow({ season: 5 })); // after updateSeason()
        db.h1_status.findMany.mockResolvedValue([
            makeStatusRow(0, { season: 5, bucket: 100 }),
            makeStatusRow(1, { season: 5, bucket: 100 }),
            makeStatusRow(2, { season: 5, bucket: 100 }),
        ]);
        db.h1_event.findMany.mockResolvedValue([]);
        vi.mocked(updateSeason).mockResolvedValue({});

        const res = await POST(
            createPostRequest({ action: 'get_snapshots', season: '5' }),
        );
        expect(res.status).toBe(200);
        expect(updateSeason).toHaveBeenCalledWith(5);
        const body = await res.json();
        expect(body.data.snapshots).toHaveLength(1);
    });

    test('returns 404 when remote fetch also fails', async () => {
        db.h1_season.findUnique.mockResolvedValue(null);
        vi.mocked(updateSeason).mockRejectedValue(new Error('fetch failed'));

        const res = await POST(
            createPostRequest({ action: 'get_snapshots', season: '5' }),
        );
        expect(res.status).toBe(404);
    });

    test('returns 404 when an underlying query throws', async () => {
        db.h1_season.findUnique.mockRejectedValue(new Error('DB error'));

        const res = await POST(
            createPostRequest({ action: 'get_snapshots', season: '5' }),
        );
        expect(res.status).toBe(404);
    });
});

describe('method not allowed', () => {
    test.each([
        ['GET', GET],
        ['PUT', PUT],
        ['DELETE', DELETE],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])('%s returns 405', async (_name, handler) => {
        const res = await handler();
        expect(res.status).toBe(405);
    });
});
