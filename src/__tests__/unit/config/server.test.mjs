import { afterEach, describe, expect, test, vi } from 'vitest';

// Minimal valid env. parseServerConfig is pure (takes an explicit env), but the
// module also parses process.env eagerly at import — so we stub the required
// vars before importing so the eager `config` export doesn't throw on load.
const REQUIRED = {
    POSTGRES_URL: 'postgresql://localhost:5432/test',
    UPDATE_KEY: 'test-update-key',
    UPDATE_INTERVAL: '20',
};

async function loadModule(env = REQUIRED) {
    vi.resetModules();
    vi.unstubAllEnvs();
    for (const [key, value] of Object.entries(env)) {
        if (value !== undefined) vi.stubEnv(key, value);
    }
    return import('@/config/server.mjs');
}

afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
});

describe('parseServerConfig', () => {
    test('parses required vars and applies derived defaults', async () => {
        const { parseServerConfig } = await loadModule();
        const config = parseServerConfig(REQUIRED);

        expect(config.db.url).toBe('postgresql://localhost:5432/test');
        expect(config.worker.updateKey).toBe('test-update-key');
        expect(config.worker.updateInterval).toBe(20);
        expect(config.worker.port).toBe(3000); // default
        expect(config.bucketSize).toBe(900); // default
        expect(config.nodeEnv).toBe('development'); // default
        expect(config.deployEnv).toBeNull();
        expect(config.auth).toBe(false);
        expect(config.analytics).toEqual({ umami: false, sentry: false });
    });

    test('returns a deeply frozen object', async () => {
        const { parseServerConfig } = await loadModule();
        const config = parseServerConfig(REQUIRED);
        expect(Object.isFrozen(config)).toBe(true);
        expect(Object.isFrozen(config.worker)).toBe(true);
        expect(() => {
            // @ts-expect-error - intentional mutation attempt
            config.bucketSize = 1;
        }).toThrow();
    });

    test.each(['POSTGRES_URL', 'UPDATE_KEY', 'UPDATE_INTERVAL'])(
        'throws a readable error when required var %s is missing',
        async (missing) => {
            const { parseServerConfig } = await loadModule();
            const env = { ...REQUIRED };
            delete env[missing];
            expect(() => parseServerConfig(env)).toThrow(
                /Invalid server environment configuration/,
            );
        },
    );

    test('throws when UPDATE_INTERVAL is not a positive integer', async () => {
        const { parseServerConfig } = await loadModule();
        expect(() => parseServerConfig({ ...REQUIRED, UPDATE_INTERVAL: 'abc' })).toThrow(
            /Invalid server environment configuration/,
        );
        expect(() => parseServerConfig({ ...REQUIRED, UPDATE_INTERVAL: '-5' })).toThrow(
            /Invalid server environment configuration/,
        );
    });

    test('parses custom PORT and BUCKET_SIZE', async () => {
        const { parseServerConfig } = await loadModule();
        const config = parseServerConfig({
            ...REQUIRED,
            PORT: '8080',
            BUCKET_SIZE: '3600',
        });
        expect(config.worker.port).toBe(8080);
        expect(config.bucketSize).toBe(3600);
    });

    describe('auth (presence-as-config, all-or-none)', () => {
        const AUTH_VARS = {
            BETTER_AUTH_SECRET: 'secret',
            BETTER_AUTH_URL: 'http://localhost:3000',
            AUTH_DISCORD_ID: 'd-id',
            AUTH_DISCORD_SECRET: 'd-secret',
            AUTH_GITHUB_ID: 'g-id',
            AUTH_GITHUB_SECRET: 'g-secret',
            AUTH_GOOGLE_ID: 'go-id',
            AUTH_GOOGLE_SECRET: 'go-secret',
        };

        test('auth is true when fully configured', async () => {
            const { parseServerConfig } = await loadModule();
            const config = parseServerConfig({ ...REQUIRED, ...AUTH_VARS });
            expect(config.auth).toBe(true);
        });

        test.each(Object.keys(AUTH_VARS).filter((k) => k !== 'BETTER_AUTH_SECRET'))(
            'throws when BETTER_AUTH_SECRET is set but %s is missing',
            async (missing) => {
                const { parseServerConfig } = await loadModule();
                const env = { ...REQUIRED, ...AUTH_VARS };
                delete env[missing];
                expect(() => parseServerConfig(env)).toThrow(
                    new RegExp(`Auth is enabled.*${missing}`),
                );
            },
        );
    });

    test('reports configured analytics services', async () => {
        const { parseServerConfig } = await loadModule();
        const config = parseServerConfig({
            ...REQUIRED,
            UMAMI_SITE_ID: 'abc',
            SENTRY_DSN: 'https://x@glitchtip/1',
        });
        expect(config.analytics).toEqual({ umami: true, sentry: true });
    });

    test('deployEnv passes through when set', async () => {
        const { parseServerConfig } = await loadModule();
        const config = parseServerConfig({ ...REQUIRED, DEPLOY_ENV: 'staging' });
        expect(config.deployEnv).toBe('staging');
    });
});

describe('config (eager singleton)', () => {
    test('reflects the parsed environment', async () => {
        const { config } = await loadModule();
        expect(config.db.url).toBe(REQUIRED.POSTGRES_URL);
        expect(config.worker.updateInterval).toBe(20);
    });
});

describe('getCacheControl', () => {
    test('returns the header value for each tier', async () => {
        const { getCacheControl } = await loadModule();
        expect(getCacheControl('live')).toBe('no-store');
        expect(getCacheControl('latest')).toBe(
            'public, max-age=10, stale-while-revalidate=30',
        );
        expect(getCacheControl('current-season')).toBe(
            'public, max-age=60, stale-while-revalidate=300',
        );
        expect(getCacheControl('closed-season')).toBe(
            'public, max-age=3600, stale-while-revalidate=86400',
        );
    });

    test('throws on an unknown tier', async () => {
        const { getCacheControl } = await loadModule();
        expect(() => getCacheControl('nope')).toThrow(/Unknown cache tier/);
    });
});

describe('getRateLimitConfig', () => {
    test('returns the limit config for each group', async () => {
        const { getRateLimitConfig } = await loadModule();
        expect(getRateLimitConfig('public_read')).toEqual({
            limit: 120,
            windowSeconds: 60,
        });
        expect(getRateLimitConfig('history_read')).toEqual({
            limit: 30,
            windowSeconds: 60,
        });
        expect(getRateLimitConfig('rebroadcast')).toEqual({
            limit: 60,
            windowSeconds: 60,
        });
        expect(getRateLimitConfig('backfill_trigger')).toEqual({
            limit: 5,
            windowSeconds: 60,
        });
    });

    test('throws on an unknown group', async () => {
        const { getRateLimitConfig } = await loadModule();
        expect(() => getRateLimitConfig('nope')).toThrow(/Unknown rate-limit group/);
    });
});
