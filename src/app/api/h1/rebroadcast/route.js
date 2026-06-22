import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { after } from 'next/server';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
//validators
import { isValidContentType } from '@/validators/isValidContentType.mjs';
import { isValidFormData } from '@/validators/isValidFormData.mjs';
//db
import {
    reconstructCampaignStatus,
    reconstructSnapshots,
} from '@/db/queries/rebroadcast.mjs';
import { updateSeason, SEASON_NOT_FOUND } from '@/update/season.mjs';
//auth
import { validateApiKey, API_KEY_ERROR } from '@/shared/utils/api/validateApiKey.mjs';
import { enforceRateLimit } from '@/shared/utils/api/rateLimit.mjs';
//track
import { umamiTrackEvent } from '@/shared/utils/umami.mjs';

export async function POST(request) {
    const start = performance.now();
    let check = null;
    let formValues = null;

    const { data: keyData, code: keyCode } = await validateApiKey(request);
    if (keyCode === API_KEY_ERROR.DB_ERROR) {
        return errorResponse(503, start, 'database unreachable');
    }
    if (keyCode === API_KEY_ERROR.DISABLED) {
        return errorResponse(403, start, 'Forbidden');
    }
    if (keyCode) {
        return errorResponse(401, start, 'Unauthorized');
    }

    // Rebroadcast is limited per API key (not per IP) — it's the HD1-API drop-in.
    // keyData is non-null here (every error code returned above).
    const { error: limitError, headers: rlHeaders } = await enforceRateLimit(
        'rebroadcast',
        /** @type {string} */ (keyData?.keyId),
        start,
    );
    if (limitError) return limitError;

    const contentType = request.headers.get('content-type') || '';
    check = isValidContentType.safeParse(contentType);
    if (!check.success) {
        return errorResponse(400, start, 'Invalid Content Type');
    }

    const { data: formData, error: formError } = await tryCatch(request.formData());
    if (formError) return errorResponse(400, start, 'Invalid request body');
    formValues = Object.fromEntries(formData.entries());

    if (typeof formValues.action !== 'string') {
        return errorResponse(400, start, 'No action set');
    }

    check = isValidFormData.safeParse(formValues);
    if (!check.success) {
        const code = check?.error?.issues[0]?.code || null;
        if (code === 'invalid_union') {
            return errorResponse(400, start, 'Invalid action');
        }
        if (code === 'invalid_type') {
            return errorResponse(400, start, 'Missing or invalid arguments');
        }
        return errorResponse(500, start, 'Unknown validation error');
    }
    if (formValues?.season) {
        formValues.season = Number(formValues.season);
    }

    after(async () => {
        const data = {
            action: formValues.action,
            ms: roundedPerformanceTime(start),
        };
        if (data.action === 'get_snapshots') {
            data.season = formValues.season;
        }
        await umamiTrackEvent(
            'API | Rebroadcast',
            '/api/h1/rebroadcast',
            'api-rebroadcast',
            data,
        );
    });

    let data = undefined;
    switch (formValues.action) {
        case 'get_campaign_status': {
            const { data: statusBody, error: statusError } = await tryCatch(
                reconstructCampaignStatus(),
            );
            if (statusError) {
                reportError(statusError, {
                    route: '/api/h1/rebroadcast',
                    stage: 'reconstruct-status',
                });
                return errorResponse(500, start, 'Internal server error');
            }
            data = statusBody;
            break;
        }
        case 'get_snapshots': {
            const { data: snapshotBody, error: snapshotError } = await tryCatch(
                reconstructSnapshots(formValues.season),
            );
            if (snapshotError) {
                reportError(snapshotError, {
                    route: '/api/h1/rebroadcast',
                    stage: 'reconstruct-snapshots',
                    season: formValues.season,
                });
                return errorResponse(500, start, 'Internal server error');
            }
            data = snapshotBody;

            // fetch from remote if the season isn't populated locally yet
            if (data === null) {
                const { error: seasonFetchError } = await tryCatch(
                    updateSeason(formValues.season),
                );
                if (seasonFetchError) {
                    if (seasonFetchError.cause === SEASON_NOT_FOUND) {
                        return errorResponse(404, start, seasonFetchError.message);
                    }
                    reportError(seasonFetchError, {
                        route: '/api/h1/rebroadcast',
                        stage: 'backfill-season',
                        season: formValues.season,
                    });
                    return errorResponse(500, start, 'Internal server error');
                }
                const { data: retryBody, error: retryError } = await tryCatch(
                    reconstructSnapshots(formValues.season),
                );
                if (retryError) {
                    reportError(retryError, {
                        route: '/api/h1/rebroadcast',
                        stage: 'reconstruct-snapshots-retry',
                        season: formValues.season,
                    });
                    return errorResponse(500, start, 'Internal server error');
                }
                data = retryBody;
            }
            break;
        }
        default:
            break;
    }

    if (data === undefined || data === null) {
        return errorResponse(404, start, 'Not found', { headers: rlHeaders });
    }
    return successResponse(200, start, data, { headers: rlHeaders });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
