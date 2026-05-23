// Playwright integration test for the Ministry Interference hijack overlay.
//
// NOTE: Playwright is not currently installed in this project. This spec
// documents the intended test shape and can be activated once
// @playwright/test is added as a devDependency and a playwright.config.mjs
// is added at the root.
//
// To activate:
//   npm install -D @playwright/test
//   npx playwright install --with-deps chromium
//   # add playwright.config.mjs with baseURL: 'http://localhost:3000'
//   # add "test:e2e": "playwright test" to package.json scripts
//
// The debug hook (window.__ministry_test__) is gated by NODE_ENV !== 'production'
// and is added by MinistryProvider via useEffect. It is tree-shaken out of
// production builds automatically by Next.js / esbuild dead-code elimination.

import { test, expect } from '@playwright/test';

test('hijack overlay appears and clears within ~3 seconds', async ({ page }) => {
    await page.goto('/archives');

    // Wait for the archives header to mount and register.
    const h1 = page.locator('h1', { hasText: 'Declassified Campaign Archives' });
    await expect(h1).toBeVisible();

    // Fire the hijack via debug hook.
    const fired = await page.evaluate(() =>
        window.__ministry_test__?.forceHijack(
            (t) => t === 'Declassified Campaign Archives',
        ),
    );
    expect(fired).toBe(true);

    // Mid-hijack: the h1 should contain an aria-hidden overlay.
    await expect(h1.locator('[aria-hidden="true"]')).toBeVisible();
    // And an sr-only truth sibling.
    await expect(h1.locator('.sr-only')).toHaveText('Declassified Campaign Archives');

    // After ~3s (CYCLE_MS = 2.6s + small buffer), the overlay is gone.
    await page.waitForTimeout(3200);
    await expect(h1.locator('[aria-hidden="true"]')).toHaveCount(0);
    await expect(h1).toHaveText('Declassified Campaign Archives');
});
