import { z } from 'zod';
import { performance } from 'perf_hooks';
import { tryCatch } from '@/shared/utils/tryCatch';
import { errorResponse, successResponse } from '@/shared/utils/api/responses';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed';
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

export async function POST(request) {
    const start = performance.now();

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
        return errorResponse(500, start, 'Failed to save subscription');
    }

    return successResponse(201, start, { subscribed: true });
}

export async function DELETE(request) {
    const start = performance.now();

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
            return errorResponse(500, start, 'Failed to remove subscription');
        }
    }

    return successResponse(200, start, { unsubscribed: true });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
