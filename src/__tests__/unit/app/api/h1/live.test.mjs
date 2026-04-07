import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before import
vi.mock('@/db/queries/getCampaign', () => ({
    getCampaign: vi.fn(),
}));
vi.mock('@/shared/utils/game/computeMapState', () => ({
    computeMapState: vi.fn(),
}));

const { getCampaign } = await import('@/db/queries/getCampaign');
const { computeMapState } = await import('@/shared/utils/game/computeMapState');
const { GET, POST, PUT, DELETE, PATCH, OPTIONS } = await import(
    '@/app/api/h1/live/route'
);

describe('/api/h1/live', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('GET returns campaign data with mapState', async () => {
        const mockCampaign = {
            season: 1,
            events: [
                { event_id: 1, type: 'defend', status: 'active' },
                { event_id: 2, type: 'attack', status: 'success' },
            ],
            live: [{ enemy: 'bugs', points: 50, points_max: 100 }],
        };
        const mockMapState = [0.5];

        getCampaign.mockResolvedValue(mockCampaign);
        computeMapState.mockReturnValue(mockMapState);

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(body.data).toEqual(mockCampaign);
        expect(body.mapState).toEqual(mockMapState);

        // computeMapState should only receive active events
        expect(computeMapState).toHaveBeenCalledWith(
            mockCampaign.live,
            [mockCampaign.events[0]], // only the active one
        );
    });

    test('GET returns 500 when getCampaign fails', async () => {
        getCampaign.mockRejectedValue(new Error('DB connection failed'));
        computeMapState.mockReturnValue([]);

        const response = await GET();
        expect(response.status).toBe(500);
    });

    test('GET returns 500 when getCampaign returns null', async () => {
        getCampaign.mockResolvedValue(null);
        computeMapState.mockReturnValue([]);

        const response = await GET();
        expect(response.status).toBe(500);
    });

    test('GET serializes bigint values as numbers', async () => {
        const mockCampaign = {
            season: 1,
            events: [],
            live: [],
            big_id: 9007199254740993n,
        };
        getCampaign.mockResolvedValue(mockCampaign);
        computeMapState.mockReturnValue([]);

        const response = await GET();
        const text = await response.text();

        // bigint should be serialized as number, not throw
        expect(text).toContain('9007199254740992'); // Number() truncation
        // bigint literal suffix 'n' should not appear in JSON output
        expect(text).not.toMatch(/\d+n/);
    });

    test.each([
        ['POST', POST],
        ['PUT', PUT],
        ['DELETE', DELETE],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])('%s returns 405', async (_, handler) => {
        const response = await handler();
        expect(response.status).toBe(405);
    });
});
