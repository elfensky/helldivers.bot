import { vi } from 'vitest';
import { initializeEnvironmentVariables } from '@/shared/utils/initialize.env.mjs';

const ALL_REQUIRED_ENV_VARS = {
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
};

describe('initializeEnvironmentVariables', () => {
    beforeEach(() => {
        for (const [key, value] of Object.entries(ALL_REQUIRED_ENV_VARS)) {
            vi.stubEnv(key, value);
        }
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test('passes when all env vars are set', async () => {
        const result = await initializeEnvironmentVariables();
        expect(result).toBe(true);
    });

    test.each([
        'POSTGRES_URL',
        'UPDATE_KEY',
        'UPDATE_INTERVAL',
        'UMAMI_SITE_ID',
        'SENTRY_AUTH_TOKEN',
        'SENTRY_DSN',
        'BETTER_AUTH_SECRET',
        'BETTER_AUTH_URL',
        'AUTH_DISCORD_ID',
        'AUTH_DISCORD_SECRET',
        'AUTH_GITHUB_ID',
        'AUTH_GITHUB_SECRET',
    ])('throws when %s is missing', async (envVar) => {
        vi.stubEnv(envVar, '');
        await expect(initializeEnvironmentVariables()).rejects.toThrow(
            `${envVar} is not set`,
        );
    });
});
