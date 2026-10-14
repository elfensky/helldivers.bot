import { SITE_URL } from '@/config/site.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { reportError } from '@/shared/utils/observability.mjs';

// Production hostname used for Umami session hashing. Derived from the
// configured site origin. Inlined because sendUmamiEvent early-returns in
// non-production, so the dev/staging branches the old getHostname() switch
// carried were unreachable.
const UMAMI_HOSTNAME = new URL(SITE_URL).host;

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

/**
 * Fetch an Umami browser script for a same-origin route handler. Calls fetch
 * with the URL alone: nothing from the visitor's request (cookies included)
 * reaches the Umami host, which a Next.js rewrite would forward.
 *
 * @param {string} file - Upstream file name, script.js or recorder.js.
 * @returns {Promise<Response>}
 */
export async function proxyUmamiScript(file) {
    const host = process.env.UMAMI_SITE_URL;
    if (!host) return new Response('Not Found', { status: 404 });

    const { data: body, error } = await tryCatch(
        fetch(`https://${host}/${file}`).then((upstream) => {
            if (!upstream.ok)
                throw new Error(`Umami ${file} returned ${upstream.status}`);
            return upstream.text();
        }),
    );
    if (error) {
        reportError(error, {
            source: 'proxyUmamiScript',
            file,
            stage: 'fetch',
            level: 'warning',
        });
        return new Response('Bad Gateway', { status: 502 });
    }

    // Public cache is safe: no visitor header goes upstream. One hour lets an
    // Umami upgrade reach browsers within the hour. The JS content type is
    // required: the global nosniff header makes browsers refuse any other.
    return new Response(body, {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
