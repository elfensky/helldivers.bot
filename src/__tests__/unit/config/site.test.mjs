import { afterEach, describe, expect, test, vi } from 'vitest';

async function loadSiteUrl(value) {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (value === undefined) {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    } else {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', value);
    }
    const mod = await import('@/config/site.mjs');
    return mod.SITE_URL;
}

afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
});

describe('SITE_URL', () => {
    test('defaults to the production origin when NEXT_PUBLIC_SITE_URL is unset', async () => {
        expect(await loadSiteUrl(undefined)).toBe('https://helldivers.bot');
    });

    test('uses NEXT_PUBLIC_SITE_URL when a self-hoster sets it', async () => {
        expect(await loadSiteUrl('https://hd.example.org')).toBe(
            'https://hd.example.org',
        );
    });
});
