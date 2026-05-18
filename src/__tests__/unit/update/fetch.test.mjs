import { vi } from 'vitest';
import axios from 'axios';
import { fetchStatus, fetchSeason } from '@/update/fetch.mjs';

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
        isAxiosError: vi.fn(() => false),
    },
}));

describe('fetchStatus', () => {
    test('calls axios.post with the Helldivers API URL', async () => {
        const mockData = { campaign_status: [], time: 1000 };
        vi.mocked(axios.post).mockResolvedValue({ data: mockData });

        await fetchStatus();

        expect(axios.post).toHaveBeenCalledWith(
            'https://api.helldiversgame.com/1.0/',
            expect.any(FormData),
            expect.objectContaining({ httpsAgent: expect.any(Object) }),
        );
    });

    test('returns response.data on success', async () => {
        const mockData = { campaign_status: [], time: 1000 };
        vi.mocked(axios.post).mockResolvedValue({ data: mockData });

        const result = await fetchStatus();

        expect(result).toEqual(mockData);
    });

    test('sends FormData with action=get_campaign_status', async () => {
        vi.mocked(axios.post).mockResolvedValue({ data: { ok: true } });

        await fetchStatus();

        const formArg = vi.mocked(axios.post).mock.calls[0][1];
        expect(formArg.get('action')).toBe('get_campaign_status');
    });

    test('throws when response has no data', async () => {
        vi.mocked(axios.post).mockResolvedValue({ data: null });

        await expect(fetchStatus()).rejects.toThrow('No data received from the API');
    });

    test('throws on axios error', async () => {
        const axiosError = new Error('Request failed');
        axiosError.response = { status: 503, statusText: 'Service Unavailable' };
        vi.mocked(axios.post).mockRejectedValue(axiosError);
        vi.mocked(axios.isAxiosError).mockReturnValue(true);

        await expect(fetchStatus()).rejects.toThrow('Axios error');
    });
});

describe('fetchSeason', () => {
    test('returns data for valid season', async () => {
        const mockData = { snapshots: [] };
        vi.mocked(axios.post).mockResolvedValue({ data: mockData });

        const result = await fetchSeason(5);

        expect(result).toEqual(mockData);
    });

    test('sends FormData with action=get_snapshots and season', async () => {
        vi.mocked(axios.post).mockResolvedValue({ data: { ok: true } });

        await fetchSeason(3);

        const formArg = vi.mocked(axios.post).mock.calls[0][1];
        expect(formArg.get('action')).toBe('get_snapshots');
        expect(formArg.get('season')).toBe('3');
    });

    test('throws on invalid season (string)', async () => {
        await expect(fetchSeason('abc')).rejects.toThrow('Invalid season');
    });

    test('throws on invalid season (negative)', async () => {
        await expect(fetchSeason(-1)).rejects.toThrow('Invalid season');
    });

    test('throws on invalid season (null)', async () => {
        await expect(fetchSeason(null)).rejects.toThrow('Invalid season');
    });

    test('throws on invalid season (zero)', async () => {
        await expect(fetchSeason(0)).rejects.toThrow('Invalid season');
    });
});
