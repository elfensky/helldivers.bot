import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';

const DSN = process.env.SENTRY_DSN;

function parseDsn() {
    const url = new URL(DSN);
    const publicKey = url.username;
    const projectId = url.pathname.replace('/', '');
    const ingestUrl = `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;
    return ingestUrl;
}

export async function POST(request) {
    if (!DSN) {
        return new Response('Tunnel not configured', { status: 503 });
    }

    const body = await request.text();
    const { data: ingestUrl, error: dsnError } = await tryCatch(
        Promise.resolve().then(() => parseDsn()),
    );
    if (dsnError) {
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
