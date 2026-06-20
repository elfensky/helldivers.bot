import { vi } from 'vitest';
import { initializeEnvironmentVariables } from '@/shared/utils/initializeEnv.mjs';

const ALL_ENV_VARS = {
    POSTGRES_URL: 'postgresql://localhost:5432/test',
    UPDATE_KEY: 'test-update-key',
    UPDATE_INTERVAL: '60000',
    UMAMI_SITE_ID: 'test-umami-id',
    SENTRY_AUTH_TOKEN: 'test-sentry-token',
    SENTRY_DSN: 'https://key@glitchtip.example.com/1',
    BETTER_AUTH_SECRET: 'test-auth-secret',
    BETTER_AUTH_URL: 'http://localhost:3000',
    AUTH_DISCORD_ID: 'test-discord-id',
    AUTH_DISCORD_SECRET: 'test-discord-secret',
    AUTH_GITHUB_ID: 'test-github-id',
    AUTH_GITHUB_SECRET: 'test-github-secret',
    AUTH_GOOGLE_ID: 'test-google-id',
    AUTH_GOOGLE_SECRET: 'test-google-secret',
};

const CORE_ENV_VARS = {
    POSTGRES_URL: 'postgresql://localhost:5432/test',
    UPDATE_KEY: 'test-update-key',
    UPDATE_INTERVAL: '60000',
};

describe('initializeEnvironmentVariables', () => {
    beforeEach(() => {
        for (const [key, value] of Object.entries(ALL_ENV_VARS)) {
            vi.stubEnv(key, value);
        }
        // Suppress console.info messages during tests
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    test('returns { auth: true, analytics: true } when all env vars are set', async () => {
        const result = await initializeEnvironmentVariables();
        expect(result).toEqual({ auth: true, analytics: true });
    });

    test('returns { auth: false, analytics: false } with only core env vars', async () => {
        vi.unstubAllEnvs();
        for (const [key, value] of Object.entries(CORE_ENV_VARS)) {
            vi.stubEnv(key, value);
        }
        const result = await initializeEnvironmentVariables();
        expect(result).toEqual({ auth: false, analytics: false });
    });

    test.each(['POSTGRES_URL', 'UPDATE_KEY', 'UPDATE_INTERVAL'])(
        'throws when core var %s is missing',
        async (envVar) => {
            vi.stubEnv(envVar, '');
            await expect(initializeEnvironmentVariables()).rejects.toThrow(
                `${envVar} is not set`,
            );
        },
    );

    test.each([
        'BETTER_AUTH_URL',
        'AUTH_DISCORD_ID',
        'AUTH_DISCORD_SECRET',
        'AUTH_GITHUB_ID',
        'AUTH_GITHUB_SECRET',
        'AUTH_GOOGLE_ID',
        'AUTH_GOOGLE_SECRET',
    ])(
        'throws when BETTER_AUTH_SECRET is set but %s is missing (partial auth config)',
        async (envVar) => {
            vi.stubEnv(envVar, '');
            await expect(initializeEnvironmentVariables()).rejects.toThrow(
                `${envVar} is not set`,
            );
        },
    );

    test('warns but does not throw when BETTER_AUTH_SECRET is missing', async () => {
        vi.stubEnv('BETTER_AUTH_SECRET', '');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await initializeEnvironmentVariables();
        expect(result.auth).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('BETTER_AUTH_SECRET'),
        );
        warnSpy.mockRestore();
    });

    test('warns but does not throw when analytics vars are missing', async () => {
        vi.stubEnv('UMAMI_SITE_ID', '');
        vi.stubEnv('SENTRY_DSN', '');
        vi.stubEnv('SENTRY_AUTH_TOKEN', '');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await initializeEnvironmentVariables();
        expect(result.analytics).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('UMAMI_SITE_ID'));
        warnSpy.mockRestore();
    });

    test('warns about degraded source maps when SENTRY_DSN is set but SENTRY_AUTH_TOKEN is missing', async () => {
        vi.stubEnv('SENTRY_AUTH_TOKEN', '');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result = await initializeEnvironmentVariables();
        expect(result.analytics).toBe(true); // SENTRY_DSN is still set
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('source maps'));
        warnSpy.mockRestore();
    });
});
