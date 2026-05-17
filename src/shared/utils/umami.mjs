import { tryCatch } from '@/shared/utils/tryCatch.mjs';

// Production hostname used for Umami session hashing. Inlined because
// sendUmamiEvent early-returns in non-production, so the dev/staging
// branches the old getHostname() switch carried were unreachable.
const UMAMI_HOSTNAME = 'helldivers.bot';

/**
 * Server-side Umami event sender. Posts directly to the Umami instance
 * (server-to-server, not subject to ad blockers). Production-only.
 *
 * Client-side tracking uses the Umami tracker script (loaded in layout.jsx)
 * which posts through the same-origin proxy at /api/umami.
 *
 * @param {object} payload - Event payload (merged with defaults: website, hostname, screen, language)
 */
async function sendUmamiEvent(payload) {
    if (process.env.NODE_ENV !== 'production') return;

    const { error } = await tryCatch(
        fetch(`https://${process.env.UMAMI_SITE_URL}/api/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
            },
            body: JSON.stringify({
                type: 'event',
                payload: {
                    website: process.env.UMAMI_SITE_ID,
                    hostname: UMAMI_HOSTNAME,
                    screen: '1x1',
                    language: 'en',
                    ...payload,
                },
            }),
        }),
    );
    if (error) {
        console.error('[umami] sendUmamiEvent failed:', error?.message ?? error);
    }
}

/**
 * Track a named server-side event with optional custom data.
 * Production-only; no-ops in dev/test. Called from API routes via
 * Next.js `after()` so analytics never blocks the response.
 *
 * Event names use `category-action` format: `api-campaign`, `api-rebroadcast`, `api-sse-connect`.
 *
 * @param {string} title  - Page title for Umami context
 * @param {string} url    - Route path (e.g. '/api/h1/campaign')
 * @param {string} name   - Event name in category-action format
 * @param {object} [data] - Optional custom properties (e.g. { ms, season })
 */
export async function umamiTrackEvent(title, url, name, data = {}) {
    await sendUmamiEvent({ title, url, name, data });
}
