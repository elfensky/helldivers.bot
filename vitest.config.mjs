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
                'src/enums/icons.js',
                'src/enums/worlds.js',
                'src/db/queries/initializeSeasons.mjs',
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
