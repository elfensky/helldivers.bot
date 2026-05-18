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
 * X-Forwarded-For is forwarded so Umami can use the real client IP
 * for its cookieless session hash (IP + UA + hostname).
 */
export async function POST(request) {
    const body = await request.text();
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

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
