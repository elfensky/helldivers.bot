import { vi } from 'vitest';
import { GET, POST, PUT, DELETE, PATCH, OPTIONS } from '@/app/api/h1/campaign/route';
import { getCampaign } from '@/db/queries/getCampaign';
import { updateSeason } from '@/update/season';

vi.mock('@/db/queries/getCampaign', () => ({ getCampaign: vi.fn() }));
vi.mock('@/update/season', () => ({ updateSeason: vi.fn() }));
vi.mock('@/utils/umami', () => ({ umamiTrackEvent: vi.fn() }));

function createRouteRequest(path) {
    const url = new URL(path, 'http://localhost');
    const req = new Request(url);
    req.nextUrl = url;
    return req;
}

describe('GET /api/h1/campaign', () => {
    test('returns 200 with campaign data when found in DB', async () => {
        const mockCampaign = { season: 5, name: 'Test Campaign' };
        vi.mocked(getCampaign).mockResolvedValue(mockCampaign);

        const res = await GET(createRouteRequest('/api/h1/campaign?season=5'));

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual(mockCampaign);
        expect(getCampaign).toHaveBeenCalledWith(5);
    });

    test('returns 200 without season param (passes null)', async () => {
        const mockCampaign = { season: 1, name: 'Current' };
        vi.mocked(getCampaign).mockResolvedValue(mockCampaign);

        const res = await GET(createRouteRequest('/api/h1/campaign'));

        expect(res.status).toBe(200);
        expect(getCampaign).toHaveBeenCalledWith(null);
    });

    test('returns 400 for invalid season param', async () => {
        const res = await GET(createRouteRequest('/api/h1/campaign?season=abc'));

        expect(res.status).toBe(400);
    });

    test('returns 400 for negative season', async () => {
        const res = await GET(createRouteRequest('/api/h1/campaign?season=-1'));

        expect(res.status).toBe(400);
    });

    test('fetches remote and retries when DB returns null', async () => {
        const mockCampaign = { season: 5, name: 'Fetched' };
        vi.mocked(getCampaign)
            .mockResolvedValueOnce(null) // first call: not in DB
            .mockResolvedValueOnce(mockCampaign); // retry after updateSeason
        vi.mocked(updateSeason).mockResolvedValue({});

        const res = await GET(createRouteRequest('/api/h1/campaign?season=5'));

        expect(res.status).toBe(200);
        expect(updateSeason).toHaveBeenCalledWith(5);
        expect(getCampaign).toHaveBeenCalledTimes(2);
        const body = await res.json();
        expect(body.data).toEqual(mockCampaign);
    });

    test('returns 404 when season not found remotely (invalid_type error)', async () => {
        vi.mocked(getCampaign).mockResolvedValue(null);
        vi.mocked(updateSeason).mockRejectedValue({
            issues: [{ code: 'invalid_type', received: 'null' }],
        });

        const res = await GET(createRouteRequest('/api/h1/campaign?season=999'));

        expect(res.status).toBe(404);
    });

    test('returns 500 when getCampaign throws', async () => {
        vi.mocked(getCampaign).mockRejectedValue(new Error('DB connection lost'));

        const res = await GET(createRouteRequest('/api/h1/campaign?season=5'));

        expect(res.status).toBe(500);
    });

    test('returns 500 when updateSeason throws non-zod error', async () => {
        vi.mocked(getCampaign).mockResolvedValue(null);
        vi.mocked(updateSeason).mockRejectedValue(new Error('Network timeout'));

        const res = await GET(createRouteRequest('/api/h1/campaign?season=5'));

        expect(res.status).toBe(500);
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
