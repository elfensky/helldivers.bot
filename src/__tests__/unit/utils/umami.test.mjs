import { vi } from 'vitest';
import { umamiTrackPage, umamiTrackEvent } from '@/utils/umami.mjs';

describe('umamiTrackPage', () => {
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
        vi.stubEnv('NODE_ENV', 'development');
        await umamiTrackPage('Home', '/');
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('calls fetch with correct URL and payload when NODE_ENV is production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('UMAMI_SITE_URL', 'analytics.example.com');
        vi.stubEnv('UMAMI_SITE_ID', 'test-id');

        await umamiTrackPage('Home', '/');

        expect(global.fetch).toHaveBeenCalledOnce();
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://analytics.example.com/api/send');
        expect(options.method).toBe('POST');

        const body = JSON.parse(options.body);
        expect(body.type).toBe('event');
        expect(body.payload.website).toBe('test-id');
        expect(body.payload.hostname).toBe('helldivers.bot');
        expect(body.payload.title).toBe('Home');
        expect(body.payload.url).toBe('/');
    });
});

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
