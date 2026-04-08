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

    await fetch(`https://${process.env.UMAMI_SITE_URL}/api/send`, {
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
                hostname: getHostname(),
                screen: '1x1',
                language: 'en',
                ...payload,
            },
        }),
    })
        .then((response) => response.text())
        .catch((error) => {
            console.error('Error:', error);
        });
}

/**
 * Track a server-side page view. Production-only; no-ops in dev/test.
 * @param {string} title - Page title
 * @param {string} url   - Page URL path
 */
export async function umamiTrackPage(title, url) {
    await sendUmamiEvent({ title, url });
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

/** Maps NODE_ENV to the site hostname for Umami's session hashing. */
function getHostname() {
    switch (process.env.NODE_ENV) {
        case 'development':
            return 'localhost';
        case 'staging':
            return 'staging.helldivers.bot';
        case 'production':
            return 'helldivers.bot';
        default:
            throw new Error('Unknown NODE_ENV');
    }
}
