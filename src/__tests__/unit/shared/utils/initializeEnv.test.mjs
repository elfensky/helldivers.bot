import { vi } from 'vitest';
import { initializeEnvironmentVariables } from '@/shared/utils/initialize.env.mjs';

const ALL_REQUIRED_ENV_VARS = {
    POSTGRES_URL: 'postgresql://localhost:5432/test',
    UPDATE_KEY: 'test-update-key',
    UPDATE_INTERVAL: '60000',
    UMAMI_SITE_ID: 'test-umami-id',
    SENTRY_AUTH_TOKEN: 'test-sentry-token',
    AUTH_SECRET: 'test-auth-secret',
    AUTH_TRUST_HOST: 'true',
    AUTH_DISCORD_ID: 'test-discord-id',
    AUTH_DISCORD_SECRET: 'test-discord-secret',
    AUTH_GITHUB_ID: 'test-github-id',
    AUTH_GITHUB_SECRET: 'test-github-secret',
    EMAIL_SERVER_USER: 'test@example.com',
    EMAIL_SERVER_PASSWORD: 'test-password',
    EMAIL_SERVER_HOST: 'smtp.example.com',
    EMAIL_SERVER_PORT: '587',
    EMAIL_FROM: 'noreply@example.com',
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
        'AUTH_SECRET',
        'AUTH_TRUST_HOST',
        'AUTH_DISCORD_ID',
        'AUTH_DISCORD_SECRET',
        'AUTH_GITHUB_ID',
        'AUTH_GITHUB_SECRET',
        'EMAIL_SERVER_USER',
        'EMAIL_SERVER_PASSWORD',
        'EMAIL_SERVER_HOST',
        'EMAIL_SERVER_PORT',
        'EMAIL_FROM',
    ])('throws when %s is missing', async (envVar) => {
        vi.stubEnv(envVar, '');
        await expect(initializeEnvironmentVariables()).rejects.toThrow(
            `${envVar} is not set`,
        );
    });
});
