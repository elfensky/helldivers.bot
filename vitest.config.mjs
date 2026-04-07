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
            exclude: [
                'src/generated/**',
                'src/**/*.{test,spec}.{js,jsx,mjs}',
                'src/__tests__/**',
                'src/enums/icons.mjs',
                'src/enums/worlds.mjs',
                'src/db/queries/initializeSeasons.mjs',
                'src/db/db.js',
                'src/shared/components/MermaidDiagram/**',
                // Next.js pages/layouts — server-rendered, tested via e2e/smoke
                'src/app/layout.jsx',
                'src/app/page.jsx',
                'src/app/opengraph-image.jsx',
                'src/app/global-error.jsx',
                'src/app/not-found.jsx',
                'src/app/archives/page.jsx',
                'src/app/dashboard/page.jsx',
                'src/app/docs/**',
                'src/instrumentation.js',
                'src/instrumentation-client.js',
                'src/auth.js',
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
