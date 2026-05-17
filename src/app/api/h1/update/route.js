import crypto from 'node:crypto';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import db from '@/db/db';
//update
import { updateStatus } from '@/update/status.mjs';
import { updateSeason } from '@/update/season.mjs';
import { checkAndNotify } from '@/update/pushNotifier.mjs';
import { computeBucket } from '@/shared/utils/bucketing.mjs';

// Custom header set on the very first poll of a worker session so the
// handler can run a one-time startup pass (e.g. backfill missing seasons).
// Mirror of WORKER_STARTUP_HEADER in public/workers/cronLogic.js — the test
// in src/__tests__/unit/workers/cron.test.mjs asserts the two stay aligned.
// HTTP header names are case-insensitive; we read it lowercase here to
// match what `request.headers.get(...)` normalises to.
export const WORKER_STARTUP_HEADER = 'x-worker-startup';

// Tracks the season observed on the previous worker poll so we can detect
// a season transition and run one final updateSeason() pass on the outgoing
// season. HD1 writes a final "closing" snapshot to the old season a few
// minutes after the transition point — without this detection, the worker
// moves on to the new season before that closing frame is published and it
// never lands in h1_status. Resets to null on worker restart; the only
// impact of a restart during the tiny transition window is that the closing
// snapshot for that single transition is missed, which the admin can recover
// via the /archives refresh button.
let lastSeasonObserved = null;

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

    const isStartup = request.headers.get(WORKER_STARTUP_HEADER) === '1';

    //STATUS
    const { data: statusData, error: statusError } = await tryCatch(updateStatus());
    if (statusError) {
        console.error(statusError?.message, statusError?.cause);
        reportError(statusError, { route: '/api/h1/update', stage: 'status' });
        await writeHeartbeat(start, isStartup, statusError?.message);
        return errorResponse(500, start, statusError?.message);
    }
    const statusTime = roundedPerformanceTime(start);

    //SEASON TRANSITION CLOSING PASS
    // If the current poll's season is higher than the one observed on the
    // previous poll, we've just crossed a transition boundary. Run
    // updateSeason() once on the outgoing season to capture the closing
    // snapshot HD1 writes a few minutes after the transition. Non-fatal on
    // error — the current season's update is more critical, and the admin
    // can always recover missing snapshots via the /archives refresh button.
    if (lastSeasonObserved !== null && lastSeasonObserved < statusData.season) {
        console.info(
            `Season transition detected: ${lastSeasonObserved} → ${statusData.season}. Running closing pass on outgoing season.`,
        );
        const { error: closingError } = await tryCatch(updateSeason(lastSeasonObserved));
        if (closingError) {
            console.error(
                `Closing pass for season ${lastSeasonObserved} failed:`,
                closingError.message,
            );
            reportError(closingError, {
                route: '/api/h1/update',
                stage: 'season-closing',
                outgoingSeason: lastSeasonObserved,
                level: 'warning',
            });
        }
    }
    lastSeasonObserved = statusData.season;

    //SEASON
    // Protect the bucket updateStatus() just wrote — stale snapshots from
    // get_snapshots must not overwrite the fresher get_campaign_status data.
    const protectedBucket = computeBucket(statusData.time);
    const { data: seasonData, error: seasonError } = await tryCatch(
        updateSeason(statusData.season, { protectedBucket }),
    );
    if (seasonError) {
        console.error(seasonError?.message, seasonError?.cause);
        reportError(seasonError, {
            route: '/api/h1/update',
            stage: 'season',
            season: statusData.season,
        });
        await writeHeartbeat(start, isStartup, seasonError?.message);
        return errorResponse(500, start, seasonError?.message);
    }
    const seasonTime = roundedPerformanceTime(start);

    // Log any non-fatal warnings the orchestrators collected (upsertEventProgress
    // and per-snapshot status upserts). They're also returned in the response
    // body so clients can surface them, but logging here gives operators
    // visibility without parsing the JSON envelope.
    for (const warning of [
        ...(statusData?.warnings ?? []),
        ...(seasonData?.warnings ?? []),
    ]) {
        console.warn('[update] warning:', warning.stage, warning.message);
    }

    // Fire-and-forget: check for event transitions and send push notifications
    checkAndNotify().catch((err) => {
        console.error('Push notification error:', err.message);
        reportError(err, { route: '/api/h1/update', stage: 'push-notify' });
    });

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
