import { z } from 'zod';
import { performance } from 'perf_hooks';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { getClientIp } from '@/shared/utils/api/clientIp.mjs';
import { enforceRateLimit } from '@/shared/utils/api/rateLimit.mjs';
import db from '@/db/db';

const subscriptionSchema = z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
        p256dh: z
            .string()
            .regex(/^[A-Za-z0-9+/=_-]+$/)
            .max(256),
        auth: z
            .string()
            .regex(/^[A-Za-z0-9+/=_-]+$/)
            .max(256),
    }),
});

// Trust-boundary guards. This endpoint is only ever called by browser
// PushManager.subscribe()/.unsubscribe() — both go through the same-origin
// fetch, so the Origin header is the app itself. Full session binding
// would require adding push_subscription.user_id (separate migration).
//
// Rate limiting is the shared Postgres-backed limiter (`push` group), which
// survives restarts and multiple Node processes — unlike the previous
// in-memory Map.
function isSameOriginRequest(request) {
    const origin = request.headers.get('origin');
    if (!origin) return false;
    const host = request.headers.get('host');
    if (!host) return false;
    // Allow http (dev) and https (prod) variants of the same host.
    return origin === `https://${host}` || origin === `http://${host}`;
}

export async function POST(request) {
    const start = performance.now();

    if (!isSameOriginRequest(request)) {
        return errorResponse(403, start, 'Forbidden');
    }
    const { error: limitError } = await enforceRateLimit(
        'push',
        getClientIp(request),
        start,
    );
    if (limitError) return limitError;

    const { data: body, error: parseError } = await tryCatch(request.json());
    if (parseError) return errorResponse(400, start, 'Invalid JSON');

    const result = subscriptionSchema.safeParse(body);
    if (!result.success) return errorResponse(400, start, result.error.message);

    const { endpoint, keys } = result.data;

    const { error: dbError } = await tryCatch(
        db.push_subscription.upsert({
            where: { endpoint },
            create: {
                endpoint,
                keys_p256dh: keys.p256dh,
                keys_auth: keys.auth,
            },
            update: {
                keys_p256dh: keys.p256dh,
                keys_auth: keys.auth,
            },
        }),
    );

    if (dbError) {
        console.error('Push subscription upsert error:', dbError.message);
        reportError(dbError, {
            route: '/api/notifications/subscribe',
            method: 'POST',
            stage: 'upsert',
        });
        return errorResponse(500, start, 'Failed to save subscription');
    }

    return successResponse(201, start, { subscribed: true });
}

export async function DELETE(request) {
    const start = performance.now();

    if (!isSameOriginRequest(request)) {
        return errorResponse(403, start, 'Forbidden');
    }
    const { error: limitError } = await enforceRateLimit(
        'push',
        getClientIp(request),
        start,
    );
    if (limitError) return limitError;

    const { data: body, error: parseError } = await tryCatch(request.json());
    if (parseError) return errorResponse(400, start, 'Invalid JSON');

    const endpoint = body?.endpoint;
    if (!endpoint || typeof endpoint !== 'string') {
        return errorResponse(400, start, 'Missing endpoint');
    }

    const { error: dbError } = await tryCatch(
        db.push_subscription.delete({ where: { endpoint } }),
    );

    if (dbError) {
        // Ignore "not found" errors — already unsubscribed
        if (!dbError.message?.includes('Record to delete does not exist')) {
            console.error('Push subscription delete error:', dbError.message);
            reportError(dbError, {
                route: '/api/notifications/subscribe',
                method: 'DELETE',
                stage: 'delete',
            });
            return errorResponse(500, start, 'Failed to remove subscription');
        }
    }

    return successResponse(200, start, { unsubscribed: true });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
