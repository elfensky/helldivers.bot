import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';

// Visual regression config — deliberately separate from vitest.config.mjs.
// These tests need a real browser and a Linux container (see
// src/__tests__/visual/README.md), so they must never run as part of
// `npm run test:unit`.
export default defineConfig({
    test: {
        globals: true,
        include: ['src/__tests__/visual/**/*.visual.{test,spec}.{js,jsx,mjs}'],
        setupFiles: ['./src/__tests__/visual/setup.mjs'],
        browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            expect: {
                toMatchScreenshot: {
                    comparatorName: 'pixelmatch',
                    // Tolerates antialiasing noise, still catches a moved or
                    // recoloured element.
                    comparatorOptions: { allowedMismatchedPixelRatio: 0.01 },
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
            '@test-utils': path.resolve(import.meta.dirname, './src/__tests__/utils'),
            // Vite is not a Next server: next/image emits /_next/image?url=…
            // sources nothing here can serve, and next/link needs router context.
            'next/image': path.resolve(
                import.meta.dirname,
                './src/__tests__/visual/stubs/nextImage.jsx',
            ),
            'next/link': path.resolve(
                import.meta.dirname,
                './src/__tests__/visual/stubs/nextLink.jsx',
            ),
        },
    },
});
