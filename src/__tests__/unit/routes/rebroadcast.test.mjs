import { vi } from 'vitest';

vi.mock('@/db/queries/rebroadcast', () => ({
    queryGetRebroadcastStatus: vi.fn(),
    queryGetRebroadcastSeason: vi.fn(),
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
import {
    queryGetRebroadcastStatus,
    queryGetRebroadcastSeason,
} from '@/db/queries/rebroadcast';
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

describe('POST /api/h1/rebroadcast', () => {
    beforeEach(() => {
        vi.mocked(validateApiKey).mockResolvedValue({
            data: { userId: '1', keyId: '1' },
            error: null,
        });
    });

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

    test('returns 200 with campaign status for get_campaign_status', async () => {
        const mockData = { campaign: 'active' };
        vi.mocked(queryGetRebroadcastStatus).mockResolvedValue({
            query: { json: mockData },
        });

        const res = await POST(createPostRequest({ action: 'get_campaign_status' }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual(mockData);
    });

    test('returns 200 with season data for get_snapshots', async () => {
        const mockData = { season: 5, snapshots: [] };
        vi.mocked(queryGetRebroadcastSeason).mockResolvedValue({
            query: { json: mockData },
        });

        const res = await POST(
            createPostRequest({ action: 'get_snapshots', season: '5' }),
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual(mockData);
    });

    test('returns 404 when get_campaign_status query fails', async () => {
        vi.mocked(queryGetRebroadcastStatus).mockRejectedValue(new Error('DB error'));

        const res = await POST(createPostRequest({ action: 'get_campaign_status' }));
        expect(res.status).toBe(404);
    });

    test('returns 404 when get_snapshots query fails and remote fetch fails', async () => {
        vi.mocked(queryGetRebroadcastSeason).mockRejectedValue(new Error('DB error'));

        const res = await POST(
            createPostRequest({ action: 'get_snapshots', season: '5' }),
        );
        expect(res.status).toBe(404);
    });

    test('returns 200 after fetching remote when local data is null for get_snapshots', async () => {
        const mockData = { season: 5, snapshots: ['fetched'] };
        vi.mocked(queryGetRebroadcastSeason)
            .mockResolvedValueOnce({ query: { json: null } })
            .mockResolvedValueOnce({ query: { json: mockData } });
        vi.mocked(updateSeason).mockResolvedValue({});

        const res = await POST(
            createPostRequest({ action: 'get_snapshots', season: '5' }),
        );
        expect(res.status).toBe(200);
        expect(updateSeason).toHaveBeenCalledWith(5);
        const body = await res.json();
        expect(body.data).toEqual(mockData);
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
