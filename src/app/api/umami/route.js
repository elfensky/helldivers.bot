import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { reportError } from '@/shared/utils/observability.mjs';

/**
 * Same-origin proxy for Umami analytics. The client-side tracker script
 * POSTs to /api/send (rewritten to /api/umami in next.config.mjs), and
 * this route forwards the request to the self-hosted Umami instance.
 *
 * This bypasses ad blockers because the browser only sees first-party
 * requests — no external domain in script-src or connect-src.
 *
 * The visitor's IP travels as `payload.ip` (see withVisitorIp), so Umami uses
 * it for its cookieless session hash and its location lookup.
 */
export async function POST(request) {
    const body = withVisitorIp(
        await request.text(),
        request.headers.get('cf-connecting-ip'),
    );
    const umamiUrl = `https://${process.env.UMAMI_SITE_URL}/api/send`;

    const headers = {
        'Content-Type': request.headers.get('content-type') || 'application/json',
        'User-Agent': request.headers.get('user-agent') || '',
    };

    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        headers['X-Forwarded-For'] = forwarded;
    }

    const { data: upstream, error } = await tryCatch(
        fetch(umamiUrl, { method: 'POST', headers, body }),
    );

    if (error) {
        reportError(error, { route: '/api/umami', stage: 'forward', level: 'warning' });
        return new Response('Bad Gateway', { status: 502 });
    }

    return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { 'Content-Type': 'text/plain' },
    });
}

/**
 * Puts the visitor's IP into the hit as `payload.ip`, replacing any value the
 * client sent. The fetch in POST reaches Umami through Cloudflare a second
 * time, and Cloudflare labels that hop with this server's IP and country.
 * Umami takes `payload.ip` before any header and then finds the location itself.
 *
 * @param {string} body - The tracker's request body.
 * @param {string | null} ip - The visitor's IP, from Cloudflare's `cf-connecting-ip`.
 * @returns {string} The body with `payload.ip` set, or `body` unchanged when there
 *   is no IP, the body is not JSON, or its `payload` is not a plain object.
 */
function withVisitorIp(body, ip) {
    if (!ip) return body;
    let hit;
    try {
        hit = JSON.parse(body);
    } catch {
        return body;
    }
    const payload = hit?.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return body;
    return JSON.stringify({ ...hit, payload: { ...payload, ip } });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
