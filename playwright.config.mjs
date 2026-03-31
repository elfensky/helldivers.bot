import { defineConfig } from '@playwright/test';

export default defineConfig({
    globalSetup: './src/__tests__/e2e/global-setup.mjs',
    testDir: './src/__tests__/e2e',
    outputDir: './playwright/test-results',
    timeout: 30_000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:3000',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
