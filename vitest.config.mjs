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
            // Do NOT re-add "server-rendered, covered by e2e/smoke" excludes.
            // That claim is unsatisfiable: vitest.smoke.config.mjs has no
            // coverage block and drives a separate server process over HTTP,
            // so no smoke test can ever produce a coverage record. Nothing in
            // this repo measures Next.js pages and layouts; excluding them
            // only inflated the ratio (their covered-statement count is zero
            // either way, so the numerator never changed — just the divisor).
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
