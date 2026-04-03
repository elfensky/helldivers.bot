import { vi } from 'vitest';
import { initializeEnvironmentVariables } from '@/utils/initialize.env.mjs';

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

    test('throws when POSTGRES_URL is missing', async () => {
        vi.stubEnv('POSTGRES_URL', '');
        await expect(initializeEnvironmentVariables()).rejects.toThrow(
            'POSTGRES_URL is not set',
        );
    });

    test('throws when UPDATE_KEY is missing', async () => {
        vi.stubEnv('UPDATE_KEY', '');
        await expect(initializeEnvironmentVariables()).rejects.toThrow(
            'UPDATE_KEY is not set',
        );
    });

    test('throws when UMAMI_SITE_ID is missing', async () => {
        vi.stubEnv('UMAMI_SITE_ID', '');
        await expect(initializeEnvironmentVariables()).rejects.toThrow(
            'UMAMI_SITE_ID is not set',
        );
    });

    test('throws when AUTH_SECRET is missing', async () => {
        vi.stubEnv('AUTH_SECRET', '');
        await expect(initializeEnvironmentVariables()).rejects.toThrow(
            'AUTH_SECRET is not set',
        );
    });

    test('throws when EMAIL_FROM is missing', async () => {
        vi.stubEnv('EMAIL_FROM', '');
        await expect(initializeEnvironmentVariables()).rejects.toThrow(
            'EMAIL_FROM is not set',
        );
    });
});
