import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// next.config.mjs reads env at import time, so each case re-imports it. The
// Sentry wrapper is mocked: this checks the options the repo passes in, not
// what the Sentry SDK does with them.

const { withSentryConfig } = vi.hoisted(() => ({
    withSentryConfig: vi.fn((config) => ({ wrapped: true, config })),
}));

vi.mock('@sentry/nextjs/config', () => ({ withSentryConfig }));
vi.mock('@next/mdx', () => ({
    default: () => (config) => ({ ...config, mdx: true }),
}));

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const CONFIG = path.join(REPO, 'next.config.mjs');

async function loadConfig() {
    vi.resetModules();
    return (await import(CONFIG)).default;
}

describe('next.config.mjs Sentry wrapper', () => {
    beforeEach(() => {
        withSentryConfig.mockClear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('wraps the config with source maps deleted after upload and a throwing errorHandler', async () => {
        vi.stubEnv('SENTRY_AUTH_TOKEN', 'x');
        const result = await loadConfig();

        expect(withSentryConfig).toHaveBeenCalledTimes(1);
        const [wrappedConfig, options] = withSentryConfig.mock.calls[0];

        expect(options.sourcemaps.deleteSourcemapsAfterUpload).toBe(true);
        expect(() => options.errorHandler(new Error('x'))).toThrow('x');
        expect(options).not.toHaveProperty('silent');

        expect(wrappedConfig).not.toHaveProperty('productionBrowserSourceMaps');
        expect(result).toEqual({ wrapped: true, config: wrappedConfig });
        expect(result.config).not.toHaveProperty('productionBrowserSourceMaps');
    });

    it('skips the Sentry wrapper when no auth token is set', async () => {
        vi.stubEnv('SENTRY_AUTH_TOKEN', undefined);
        const result = await loadConfig();

        expect(withSentryConfig).not.toHaveBeenCalled();
        expect(result).toHaveProperty('mdx', true);
    });
});
