import crypto from 'node:crypto';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time';
import { errorResponse, successResponse } from '@/shared/utils/api/responses';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed';
import db from '@/db/db';
//update
import { updateStatus } from '@/update/status';
import { updateSeason } from '@/update/season';
import { notifyUpdate } from '@/update/notifyClient';
import { checkAndNotify } from '@/update/pushNotifier';

async function writeHeartbeat(start, isStartup, errorMsg = null) {
    const now = new Date();
    const { error } = await tryCatch(
        db.worker_heartbeat.upsert({
            where: { worker_type: 'cron_api_poller' },
            create: {
                worker_type: 'cron_api_poller',
                last_beat: now,
                poll_duration_ms: Math.round(performance.now() - start),
                last_error: errorMsg?.slice(0, 500) ?? null,
                started_at: now,
            },
            update: {
                last_beat: now,
                poll_duration_ms: Math.round(performance.now() - start),
                last_error: errorMsg?.slice(0, 500) ?? null,
                ...(isStartup && { started_at: now }),
            },
        }),
    );
    if (error) console.error('Heartbeat write failed:', error.message);
}

export async function GET(request) {
    //INITIALIZE
    const start = performance.now();
    const header = request.headers.get('authorization');
    const key = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!key) return errorResponse(401, start);
    const secret = process.env.UPDATE_KEY;
    const actual = crypto.createHash('sha256').update(key).digest();
    const expected = crypto.createHash('sha256').update(secret).digest();
    if (!crypto.timingSafeEqual(actual, expected)) return errorResponse(401, start);

    const isStartup = request.headers.get('x-worker-startup') === '1';

    //STATUS
    const { data: statusData, error: statusError } = await tryCatch(updateStatus());
    if (statusError) {
        console.error(statusError?.message, statusError?.cause);
        await writeHeartbeat(start, isStartup, statusError?.message);
        return errorResponse(500, start, statusError?.message);
    }
    const statusTime = roundedPerformanceTime(start);

    //SEASON
    const { data: seasonData, error: seasonError } = await tryCatch(
        updateSeason(statusData.season),
    );
    if (seasonError) {
        console.error(seasonError?.message, seasonError?.cause);
        await writeHeartbeat(start, isStartup, seasonError?.message);
        return errorResponse(500, start, seasonError?.message);
    }
    const seasonTime = roundedPerformanceTime(start);

    // Notify SSE clients that data has been updated
    await notifyUpdate();

    // Fire-and-forget: check for event transitions and send push notifications
    checkAndNotify().catch((err) =>
        console.error('Push notification error:', err.message),
    );

    //RESPONSE
    await writeHeartbeat(start, isStartup);
    return successResponse(200, start, {
        updated: {
            status: statusData,
            season: seasonData,
        },
        timing: {
            statusMs: statusTime,
            seasonMs: seasonTime,
        },
    });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
