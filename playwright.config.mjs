import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:3000',
    },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
