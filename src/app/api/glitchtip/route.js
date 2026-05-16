import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';

function parseDsn(dsn) {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace('/', '');
    return `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;
}

export async function POST(request) {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        return new Response('Tunnel not configured', { status: 503 });
    }

    const body = await request.text();
    let ingestUrl;
    try {
        ingestUrl = parseDsn(dsn);
    } catch {
        return new Response('Invalid DSN configuration', { status: 500 });
    }

    const { data: response, error } = await tryCatch(
        fetch(ingestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body,
        }),
    );

    if (error) {
        return new Response('Tunnel error', { status: 502 });
    }

    return new Response(null, { status: response.status });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
