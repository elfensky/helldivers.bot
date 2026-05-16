import { vi } from 'vitest';
import { GET, POST, PUT, DELETE, PATCH, OPTIONS } from '@/app/api/h1/update/route';
import { updateStatus } from '@/update/status.mjs';
import { updateSeason } from '@/update/season.mjs';
import { expectSuccessEnvelope, expectErrorEnvelope } from '@test-utils';

vi.mock('@/update/status', () => ({ updateStatus: vi.fn() }));
vi.mock('@/update/season', () => ({ updateSeason: vi.fn() }));
vi.mock('@/update/pushNotifier', () => ({
    checkAndNotify: vi.fn().mockResolvedValue(undefined),
}));

describe('GET /api/h1/update', () => {
    beforeEach(() => {
        vi.stubEnv('UPDATE_KEY', 'test-secret-key');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test('returns 401 with full error envelope when no authorization header', async () => {
        const req = new Request('http://localhost/api/h1/update');
        const res = await GET(req);
        expect(res.status).toBe(401);
        expectErrorEnvelope(await res.json(), { code: 401 });
        // Auth gate must short-circuit BEFORE any work happens.
        expect(updateStatus).not.toHaveBeenCalled();
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('returns 401 when authorization header has no Bearer prefix', async () => {
        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'test-secret-key' },
        });
        const res = await GET(req);
        expect(res.status).toBe(401);
        expectErrorEnvelope(await res.json(), { code: 401 });
        expect(updateStatus).not.toHaveBeenCalled();
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('returns 401 when key does not match', async () => {
        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'Bearer wrong-key' },
        });
        const res = await GET(req);
        expect(res.status).toBe(401);
        expectErrorEnvelope(await res.json(), { code: 401 });
        expect(updateStatus).not.toHaveBeenCalled();
        expect(updateSeason).not.toHaveBeenCalled();
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
        expectSuccessEnvelope(body, { code: 200 });
        expect(body.data.updated.status).toEqual(mockStatusData);
        expect(body.data.updated.season).toEqual(mockSeasonData);
        expect(body.data.timing).toHaveProperty('statusMs');
        expect(body.data.timing).toHaveProperty('seasonMs');
        expect(updateSeason).toHaveBeenCalledWith(5, { protectedBucket: 900 });
    });

    test('returns 500 with error envelope when updateStatus fails (does not call updateSeason)', async () => {
        vi.mocked(updateStatus).mockRejectedValue(new Error('API down'));

        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'Bearer test-secret-key' },
        });
        const res = await GET(req);

        expect(res.status).toBe(500);
        expectErrorEnvelope(await res.json(), { code: 500 });
        expect(updateSeason).not.toHaveBeenCalled();
    });

    test('returns 500 with error envelope when updateSeason fails', async () => {
        vi.mocked(updateStatus).mockResolvedValue({ season: 5, time: 1000 });
        vi.mocked(updateSeason).mockRejectedValue(new Error('DB write failed'));

        const req = new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'Bearer test-secret-key' },
        });
        const res = await GET(req);

        expect(res.status).toBe(500);
        expectErrorEnvelope(await res.json(), { code: 500 });
    });
});

describe('GET /api/h1/update — season transition detection', () => {
    // The route keeps `lastSeasonObserved` as module-level state to detect
    // season transitions across polls. These tests reset the route module
    // between cases via vi.resetModules() so each test starts with a clean
    // null state.

    let transitionUpdateStatus;
    let transitionUpdateSeason;
    let transitionGET;

    beforeEach(async () => {
        vi.resetModules();
        vi.stubEnv('UPDATE_KEY', 'test-secret-key');
        // Re-import after reset so we get fresh mock instances bound to the
        // re-imported route module.
        const statusModule = await import('@/update/status');
        const seasonModule = await import('@/update/season');
        const routeModule = await import('@/app/api/h1/update/route');
        transitionUpdateStatus = statusModule.updateStatus;
        transitionUpdateSeason = seasonModule.updateSeason;
        transitionGET = routeModule.GET;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    const makeReq = () =>
        new Request('http://localhost/api/h1/update', {
            headers: { Authorization: 'Bearer test-secret-key' },
        });

    test('runs closing pass on outgoing season when current season is higher', async () => {
        vi.mocked(transitionUpdateStatus)
            .mockResolvedValueOnce({ season: 156, time: 1000 })
            .mockResolvedValueOnce({ season: 157, time: 1010 });
        vi.mocked(transitionUpdateSeason).mockResolvedValue({ season: 0 });

        // Poll 1: no prior observation, no closing pass, only current-season call
        await transitionGET(makeReq());
        expect(transitionUpdateSeason).toHaveBeenCalledTimes(1);
        expect(transitionUpdateSeason).toHaveBeenNthCalledWith(1, 156, {
            protectedBucket: 900,
        });

        // Poll 2: prior was 156, current is 157 — closing pass (no opts) THEN current season (with protectedBucket)
        await transitionGET(makeReq());
        expect(transitionUpdateSeason).toHaveBeenCalledTimes(3);
        expect(transitionUpdateSeason).toHaveBeenNthCalledWith(2, 156); // closing pass — no protectedBucket
        expect(transitionUpdateSeason).toHaveBeenNthCalledWith(3, 157, {
            protectedBucket: 900,
        });
    });

    test('does not run closing pass when season stays the same across polls', async () => {
        vi.mocked(transitionUpdateStatus)
            .mockResolvedValueOnce({ season: 157, time: 1000 })
            .mockResolvedValueOnce({ season: 157, time: 1010 });
        vi.mocked(transitionUpdateSeason).mockResolvedValue({ season: 0 });

        await transitionGET(makeReq());
        await transitionGET(makeReq());

        expect(transitionUpdateSeason).toHaveBeenCalledTimes(2);
        expect(transitionUpdateSeason).toHaveBeenNthCalledWith(1, 157, {
            protectedBucket: 900,
        });
        expect(transitionUpdateSeason).toHaveBeenNthCalledWith(2, 157, {
            protectedBucket: 900,
        });
    });

    test('closing pass failure is non-fatal and current season still processes', async () => {
        vi.mocked(transitionUpdateStatus)
            .mockResolvedValueOnce({ season: 156, time: 1000 })
            .mockResolvedValueOnce({ season: 157, time: 1010 });
        vi.mocked(transitionUpdateSeason)
            .mockResolvedValueOnce({ season: 0 }) // poll 1 current
            .mockRejectedValueOnce(new Error('closing pass API error')) // poll 2 closing
            .mockResolvedValueOnce({ season: 0 }); // poll 2 current

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await transitionGET(makeReq());
        const res2 = await transitionGET(makeReq());

        // Current season update still succeeded
        expect(res2.status).toBe(200);
        expect(transitionUpdateSeason).toHaveBeenCalledTimes(3);
        // Closing pass for 156 logged the failure
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Closing pass for season 156 failed'),
            expect.any(String),
        );

        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });
});

describe('disallowed methods on /api/h1/update', () => {
    test.each([
        ['POST', POST],
        ['PUT', PUT],
        ['DELETE', DELETE],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])('%s returns 405 with the standard error envelope', async (_name, handler) => {
        const res = await handler();
        expect(res.status).toBe(405);
        const body = await res.json();
        expectErrorEnvelope(body, { code: 405 });
        expect(body.message).toBe('Method not allowed');
    });
});
