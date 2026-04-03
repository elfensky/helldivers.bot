import { vi } from 'vitest';
import { GET, POST, PUT, DELETE, PATCH, OPTIONS } from '@/app/api/h1/update/route';
import { updateStatus } from '@/update/status';
import { updateSeason } from '@/update/season';

vi.mock('@/update/status', () => ({ updateStatus: vi.fn() }));
vi.mock('@/update/season', () => ({ updateSeason: vi.fn() }));

describe('GET /api/h1/update', () => {
    beforeEach(() => {
        vi.stubEnv('UPDATE_KEY', 'test-secret-key');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test('returns 401 when no authorization header', async () => {
        const req = new Request('http://localhost/api/h1/update');
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    test('returns 401 when authorization header has no Bearer prefix', async () => {
        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'test-secret-key' },
        });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    test('returns 401 when key does not match', async () => {
        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'Bearer wrong-key' },
        });
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    test('returns 200 with correct key and update data', async () => {
        const mockStatusData = { season: 5, time: 1000 };
        const mockSeasonData = { campaign_status: [] };
        vi.mocked(updateStatus).mockResolvedValue(mockStatusData);
        vi.mocked(updateSeason).mockResolvedValue(mockSeasonData);

        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'Bearer test-secret-key' },
        });
        const res = await GET(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.updated.status).toEqual(mockStatusData);
        expect(body.data.updated.season).toEqual(mockSeasonData);
        expect(body.data.timing).toHaveProperty('statusMs');
        expect(body.data.timing).toHaveProperty('seasonMs');
        expect(updateSeason).toHaveBeenCalledWith(5);
    });

    test('returns 500 when updateStatus fails and does not call updateSeason', async () => {
        vi.mocked(updateStatus).mockRejectedValue(new Error('API down'));

        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'Bearer test-secret-key' },
        });
        const res = await GET(req);

        expect(res.status).toBe(500);
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('returns 500 when updateSeason fails', async () => {
        vi.mocked(updateStatus).mockResolvedValue({ season: 5 });
        vi.mocked(updateSeason).mockRejectedValue(new Error('DB write failed'));

        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'Bearer test-secret-key' },
        });
        const res = await GET(req);

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
