import { vi } from 'vitest';
import { umamiTrackEvent } from '@/shared/utils/umami.mjs';

describe('umamiTrackEvent', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = vi.fn(() =>
            Promise.resolve({ text: () => Promise.resolve('ok') }),
        );
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.unstubAllEnvs();
    });

    test('returns early without calling fetch when NODE_ENV is not production', async () => {
        vi.stubEnv('NODE_ENV', 'test');
        await umamiTrackEvent('Home', '/', 'click', { button: 'cta' });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('calls fetch with name and data in payload when NODE_ENV is production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('UMAMI_SITE_URL', 'analytics.example.com');
        vi.stubEnv('UMAMI_SITE_ID', 'test-id');

        await umamiTrackEvent('Home', '/', 'button_click', { section: 'hero' });

        expect(global.fetch).toHaveBeenCalledOnce();
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://analytics.example.com/api/send');

        const body = JSON.parse(options.body);
        expect(body.type).toBe('event');
        expect(body.payload.website).toBe('test-id');
        expect(body.payload.hostname).toBe('helldivers.bot');
        expect(body.payload.title).toBe('Home');
        expect(body.payload.url).toBe('/');
        expect(body.payload.name).toBe('button_click');
        expect(body.payload.data).toEqual({ section: 'hero' });
    });
});

describe('sendUmamiEvent error handling', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.unstubAllEnvs();
    });

    test('catches and logs fetch errors without throwing', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('UMAMI_SITE_URL', 'analytics.example.com');
        vi.stubEnv('UMAMI_SITE_ID', 'test-id');

        const networkError = new Error('Network failure');
        global.fetch = vi.fn(() => Promise.reject(networkError));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // Should not throw despite fetch rejecting
        await umamiTrackEvent('Home', '/', 'test-event');

        expect(consoleSpy).toHaveBeenCalledWith('Error:', networkError);
        consoleSpy.mockRestore();
    });
});
