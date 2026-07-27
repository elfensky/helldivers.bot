import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        setupFiles: ['./vitest.setup.mjs'],
        include: ['src/__tests__/unit/**/*.{test,spec}.{js,jsx,mjs}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.{js,jsx,mjs}'],
            // Only two things are excluded: code we did not write, and the
            // tests themselves. Everything else under src/ counts, tested or
            // not — an untested file should read as 0%, not disappear.
            //
            // The old exclude list had three problems. (1) Four entries named
            // files that no longer exist (src/enums/icons.mjs, enums/worlds.mjs,
            // db/queries/initializeSeasons.mjs, app/dashboard/page.jsx) — dead
            // config. (2) Three entries hid code that unit tests DO cover:
            // measured on re-inclusion, src/db/db.js 10/10 statements,
            // src/app/docs/** 49/114, src/auth.js 1/1. (3) The rest were
            // excluded as "server-rendered, tested via e2e/smoke", which is
            // unsatisfiable — vitest.smoke.config.mjs has no coverage block and
            // drives a separate server process over HTTP, so no smoke test can
            // produce a coverage record. Those files really are at 0 covered
            // statements; excluding them shrank the divisor and inflated the
            // ratio. Do NOT re-add any of it.
            exclude: [
                // Prisma's generated client — machine-written, not ours.
                'src/generated/**',
                'src/**/*.{test,spec}.{js,jsx,mjs}',
                'src/__tests__/**',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
            '@test-utils': path.resolve(import.meta.dirname, './src/__tests__/utils'),
        },
    },
});
