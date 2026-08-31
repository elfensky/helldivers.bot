/**
 * hydration-sweep.mjs — Playwright reproduction of React hydration mismatches
 * on `/` under a given visitor timezone.
 *
 * Loads the running dev server (or `TEST_SERVER_URL`) in a Chromium context
 * pinned to a chosen IANA timezone, collects every console/page error whose
 * text matches React's hydration error signatures (minified error codes 418,
 * 423, 425, and the words "hydrat"/"Hydration"), and prints each match in
 * full — including any component-stack diff React attaches as additional
 * console args, since that diff names the divergent value and is the primary
 * evidence for root-causing a mismatch (see STAB-01 / #496).
 *
 * No try/catch (CLAUDE.md hard rule, and deliberate here): a launch or
 * navigation failure should crash this script loudly rather than silently
 * report a clean sweep.
 *
 * Usage:
 *   node scripts/hydration-sweep.mjs [timezoneId]
 *
 * Env vars:
 *   TEST_SERVER_URL — overrides the default http://localhost:3000/
 *
 * Exit code: non-zero when any hydration-matching message was collected,
 * zero when none were.
 */

import { chromium } from 'playwright';

const timezoneId = process.argv[2] ?? 'Europe/Warsaw';
const url = process.env.TEST_SERVER_URL ?? 'http://localhost:3000/';

// Matches React's minified hydration error codes (418 "text content does not
// match", 423 "there was an error while hydrating", 425 "text content does
// not match server-rendered HTML") plus the plain-English words React also
// emits in dev builds.
const HYDRATION_PATTERN = /(?:error #(?:418|423|425)\b)|hydrat/i;

console.log(`hydration-sweep: timezoneId=${timezoneId} url=${url}`);

const browser = await chromium.launch();
const context = await browser.newContext({ timezoneId, locale: 'en-US' });
const page = await context.newPage();

/** @type {string[]} */
const matches = [];

page.on('console', async (msg) => {
    const text = msg.text();
    if (!HYDRATION_PATTERN.test(text)) return;

    const argValues = await Promise.all(
        msg.args().map(async (arg) => {
            const value = await arg.jsonValue().catch(() => undefined);
            return typeof value === 'string' ? value : JSON.stringify(value);
        }),
    );

    matches.push([`[console.${msg.type()}] ${text}`, ...argValues.slice(1)].join('\n'));
});

page.on('pageerror', (error) => {
    if (!HYDRATION_PATTERN.test(error.message)) return;
    matches.push(`[pageerror] ${error.message}\n${error.stack ?? ''}`);
});

await page.goto(url, { waitUntil: 'networkidle' });
// Give React a moment to finish hydrating and log any recoverable errors
// that surface asynchronously after the network-idle event.
await page.waitForTimeout(2000);

await browser.close();

if (matches.length === 0) {
    console.log('hydration-sweep: no hydration-matching console messages collected.');
    process.exit(0);
}

console.log(
    `hydration-sweep: collected ${matches.length} hydration-matching message(s):\n`,
);
for (const [i, match] of matches.entries()) {
    console.log(`--- match ${i + 1} ---`);
    console.log(match);
    console.log('');
}

process.exit(1);
