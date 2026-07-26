import { describe, test, expect, vi, beforeEach } from 'vitest';
import { expectErrorEnvelope } from '@test-utils';

// Mock dependencies before import. The route now calls computeLiveMapState,
// which internally filters and delegates to computeMapState; we stub both
// to keep the tests focused on route-level wiring rather than map maths.
vi.mock('@/db/queries/getCampaign', () => ({
    getCampaign: vi.fn(),
}));
vi.mock('@/shared/utils/game/computeMapState', () => ({
    computeMapState: vi.fn(),
    computeLiveMapState: vi.fn(),
}));
// getCacheControl comes from the env-free @/config/policy.mjs, so it runs
// unmocked here — the no-store assertion below checks the real tier table.

const { getCampaign } = await import('@/db/queries/getCampaign');
const { computeLiveMapState } = await import('@/shared/utils/game/computeMapState');
const { GET, POST, PUT, DELETE, PATCH, OPTIONS } =
    await import('@/app/api/h1/live/route');

describe('GET /api/h1/live', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('returns 200 with standard success envelope and no-store cache header', async () => {
        const mockCampaign = {
            season: 1,
            events: [
                { event_id: 1, type: 'defend', status: 'active' },
                { event_id: 2, type: 'attack', status: 'success' },
            ],
            status: [{ enemy: 'bugs', points: 50, points_max: 100 }],
        };
        const mockMapState = [0.5];

        getCampaign.mockResolvedValue(mockCampaign);
        computeLiveMapState.mockReturnValue(mockMapState);

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        // no-store is load-bearing: clients (useLiveData) rely on fresh polls.
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        // Standard { time, code, message, data } envelope from successResponse,
        // with the live snapshot nested under `data`. `appVersion` is read from
        // process.env.NEXT_PUBLIC_APP_VERSION at request time and may be
        // undefined in test (JSON.stringify drops undefined keys).
        expect(body).toMatchObject({
            code: 200,
            message: 'OK',
            data: {
                data: mockCampaign,
                mapState: mockMapState,
            },
        });
        expect(typeof body.time).toBe('number');
    });

    test('forwards the full campaign payload to computeLiveMapState (filter lives in the helper)', async () => {
        const mockCampaign = {
            season: 1,
            events: [
                { event_id: 1, type: 'defend', status: 'active' },
                { event_id: 2, type: 'attack', status: 'success' },
                { event_id: 3, type: 'defend', status: 'fail' },
            ],
            status: [{ enemy: 'bugs', points: 50, points_max: 100 }],
        };
        getCampaign.mockResolvedValue(mockCampaign);
        computeLiveMapState.mockReturnValue([]);

        await GET();

        // The active-events filter is now encapsulated in computeLiveMapState —
        // see its own unit test for the "only active events" invariant. The
        // route's job is just to hand the full payload to the helper.
        expect(computeLiveMapState).toHaveBeenCalledWith(mockCampaign);
    });

    test('handles empty events array (forwards payload as-is)', async () => {
        const mockCampaign = { season: 1, events: [], status: [] };
        getCampaign.mockResolvedValue(mockCampaign);
        computeLiveMapState.mockReturnValue([]);

        await GET();

        expect(computeLiveMapState).toHaveBeenCalledWith(mockCampaign);
    });

    test('treats missing events field as part of the same forwarded payload', async () => {
        const mockCampaign = { season: 1, status: [] };
        getCampaign.mockResolvedValue(mockCampaign);
        computeLiveMapState.mockReturnValue([]);

        await GET();

        // computeLiveMapState handles the events ?? [] default internally —
        // the route forwards whatever getCampaign returned without massaging.
        expect(computeLiveMapState).toHaveBeenCalledWith(mockCampaign);
    });

    test('returns 500 with the full error envelope when getCampaign rejects', async () => {
        getCampaign.mockRejectedValue(new Error('DB connection failed'));
        computeLiveMapState.mockReturnValue([]);

        const response = await GET();
        // Lock that getCampaign WAS invoked — otherwise a route that never
        // touches the DB would also produce a 500 envelope.
        expect(getCampaign).toHaveBeenCalledTimes(1);
        // And computeLiveMapState was NOT called (we short-circuit on the error).
        expect(computeLiveMapState).not.toHaveBeenCalled();
        expect(response.status).toBe(500);
        const body = await response.json();
        expectErrorEnvelope(body, {
            code: 500,
            error: 'DB connection failed',
        });
    });

    test('returns 500 with "No campaign data" envelope when getCampaign returns null', async () => {
        getCampaign.mockResolvedValue(null);
        computeLiveMapState.mockReturnValue([]);

        const response = await GET();
        expect(getCampaign).toHaveBeenCalledTimes(1);
        expect(computeLiveMapState).not.toHaveBeenCalled();
        expect(response.status).toBe(500);
        const body = await response.json();
        expectErrorEnvelope(body, { code: 500, error: 'No campaign data' });
    });

    test('serialises BigInts within Number.MAX_SAFE_INTEGER as exact numbers', async () => {
        const safeBig = 9007199254740990n; // < MAX_SAFE_INTEGER
        const mockCampaign = {
            season: 1,
            events: [],
            status: [],
            big_id: safeBig,
        };
        getCampaign.mockResolvedValue(mockCampaign);
        computeLiveMapState.mockReturnValue([]);

        const response = await GET();
        const body = await response.json();

        // Round-trips exactly because the value is < MAX_SAFE_INTEGER.
        // body.data is the envelope payload; body.data.data is the campaign.
        expect(body.data.data.big_id).toBe(9007199254740990);
        // The n-suffixed literal must never reach the wire.
        expect(JSON.stringify(body)).not.toMatch(/\d+n/);
    });

    test('BigInts above MAX_SAFE_INTEGER are CURRENTLY truncated to the nearest representable double (KNOWN PRECISION LOSS — documenting current behaviour)', async () => {
        // This documents the current contract: the response transform uses
        // `Number(bigint)`, which silently loses precision above MAX_SAFE_INTEGER.
        // If this ever causes a real bug (event IDs, statistics counters
        // colliding), the right fix is a string serialisation strategy and a
        // matching contract change in clients — at which point this test
        // should flip to assert the safer behaviour.
        const unsafeBig = 9007199254740993n; // > MAX_SAFE_INTEGER by 1
        getCampaign.mockResolvedValue({
            season: 1,
            events: [],
            status: [],
            big_id: unsafeBig,
        });
        computeLiveMapState.mockReturnValue([]);

        const response = await GET();
        const text = await response.text();

        // 9007199254740993 round-trips through Number() as 9007199254740992
        // (the nearest representable double). Asserting the truncated form
        // is what locks in the current — admittedly lossy — behaviour.
        expect(text).toContain('9007199254740992');
        expect(text).not.toMatch(/\d+n/);
    });
});

describe('disallowed methods on /api/h1/live', () => {
    test.each([
        ['POST', POST],
        ['PUT', PUT],
        ['DELETE', DELETE],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])('%s returns 405 with the standard error envelope', async (_, handler) => {
        const response = await handler();
        expect(response.status).toBe(405);
        const body = await response.json();
        expectErrorEnvelope(body, { code: 405 });
        expect(body.message).toBe('Method not allowed');
    });
});
