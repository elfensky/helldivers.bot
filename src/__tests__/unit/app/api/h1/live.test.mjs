import { describe, test, expect, vi, beforeEach } from 'vitest';
import { expectErrorEnvelope } from '@test-utils';

// Mock dependencies before import.
vi.mock('@/db/queries/getCampaign', () => ({
    getCampaign: vi.fn(),
}));
vi.mock('@/shared/utils/game/computeMapState', () => ({
    computeMapState: vi.fn(),
}));

const { getCampaign } = await import('@/db/queries/getCampaign');
const { computeMapState } = await import('@/shared/utils/game/computeMapState');
const { GET, POST, PUT, DELETE, PATCH, OPTIONS } =
    await import('@/app/api/h1/live/route');

describe('GET /api/h1/live', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('returns 200 with { data, mapState } envelope and no-store cache header', async () => {
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
        computeMapState.mockReturnValue(mockMapState);

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        // no-store is load-bearing: clients (useLiveData) rely on fresh polls.
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        // Success envelope on this route is INTENTIONALLY flat — not the
        // standard { time, code, message, data } — because the client reads
        // it as a single live snapshot. Locking in the exact shape so a
        // future "let's standardise envelopes" PR has to update this test.
        expect(body).toEqual({ data: mockCampaign, mapState: mockMapState });
        expect(body).not.toHaveProperty('time');
        expect(body).not.toHaveProperty('code');
        expect(body).not.toHaveProperty('message');
    });

    test('passes only active events to computeMapState (not completed/success/fail)', async () => {
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
        computeMapState.mockReturnValue([]);

        await GET();

        // Completed events are already reflected in status snapshot points —
        // re-applying them would double-count. Active events only.
        expect(computeMapState).toHaveBeenCalledWith(mockCampaign.status, [
            mockCampaign.events[0],
        ]);
    });

    test('handles empty events array (mapState computed from status alone)', async () => {
        const mockCampaign = { season: 1, events: [], status: [] };
        getCampaign.mockResolvedValue(mockCampaign);
        computeMapState.mockReturnValue([]);

        await GET();

        expect(computeMapState).toHaveBeenCalledWith([], []);
    });

    test('treats missing events field as empty (defaults to [])', async () => {
        const mockCampaign = { season: 1, status: [] };
        getCampaign.mockResolvedValue(mockCampaign);
        computeMapState.mockReturnValue([]);

        await GET();

        // events ?? [] in the source — must filter on an empty array, not crash.
        expect(computeMapState).toHaveBeenCalledWith([], []);
    });

    test('returns 500 with the full error envelope when getCampaign rejects', async () => {
        getCampaign.mockRejectedValue(new Error('DB connection failed'));
        computeMapState.mockReturnValue([]);

        const response = await GET();
        expect(response.status).toBe(500);
        const body = await response.json();
        expectErrorEnvelope(body, {
            code: 500,
            error: 'DB connection failed',
        });
    });

    test('returns 500 with "No campaign data" envelope when getCampaign returns null', async () => {
        getCampaign.mockResolvedValue(null);
        computeMapState.mockReturnValue([]);

        const response = await GET();
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
        computeMapState.mockReturnValue([]);

        const response = await GET();
        const body = await response.json();

        // Round-trips exactly because the value is < MAX_SAFE_INTEGER.
        expect(body.data.big_id).toBe(9007199254740990);
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
        computeMapState.mockReturnValue([]);

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
