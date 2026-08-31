/**
 * generate-og-fallback.mjs — design-time generator for the static OG
 * crash-fallback card (STAB-02 / #503, D-07).
 *
 * Renders a 1200x630 PNG via Playwright chromium and writes it to
 * public/og-fallback.png. The route branch in src/app/opengraph-image.jsx
 * serves this committed file as raw bytes on a render failure — no
 * ImageResponse, no Satori, no sharp — so a failure in the live card's image
 * pipeline cannot also fail the fallback the same way. This script is the
 * source of truth for the PNG; re-run it whenever the brand treatment
 * changes and commit the regenerated file.
 *
 * Deliberately carries NO game state (no season number, no faction
 * percentages, no war status) — a crash fallback must never assert stale or
 * fabricated war data. Its composition (centered wordmark, no map) is also
 * deliberately different from the live card's 60/40 map/stats split, so the
 * two are distinguishable at a glance in a Discord/Slack unfurl.
 *
 * Fonts are referenced by name with a system fallback stack rather than
 * fetched — this script runs on a developer machine, and a webfont fetch
 * would make regeneration non-deterministic.
 *
 * Usage:
 *   node scripts/generate-og-fallback.mjs
 */

import { chromium } from 'playwright';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://helldivers.bot';
const HOST = new URL(SITE_URL).host;

// Same palette as the COLORS block in src/app/opengraph-image.jsx.
const COLORS = {
    bg: 'rgb(0, 9, 19)',
    yellow: 'rgba(255, 225, 0, 0.99)',
    textDim: 'rgba(255, 255, 255, 0.5)',
    textMuted: 'rgba(255, 255, 255, 0.4)',
};

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        border-radius: 0 !important;
    }
    html,
    body {
        width: 1200px;
        height: 630px;
        background: ${COLORS.bg};
        overflow: hidden;
    }
    body {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        font-family: 'Space Grotesk', 'Impact', sans-serif;
    }
    .wordmark {
        font-size: 84px;
        font-weight: 700;
        letter-spacing: 6px;
        color: ${COLORS.yellow};
    }
    .tagline {
        font-size: 26px;
        font-family: Inter, Arial, Helvetica, sans-serif;
        color: ${COLORS.textDim};
        letter-spacing: 1px;
    }
    .host {
        position: absolute;
        bottom: 32px;
        right: 40px;
        font-size: 18px;
        font-family: 'Space Mono', monospace;
        color: ${COLORS.textMuted};
        letter-spacing: 1px;
    }
</style>
</head>
<body>
    <span class="wordmark">HELLDIVERS BOT</span>
    <span class="tagline">Live Helldivers 1 galactic war dashboard</span>
    <span class="host">${HOST}</span>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
});
await page.setContent(html);
await page.screenshot({ path: 'public/og-fallback.png' });
await browser.close();

console.log('Wrote public/og-fallback.png');
