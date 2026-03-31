import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/utils/time';
import { errorResponse, successResponse } from '@/utils/responses';
import { after } from 'next/server';
//parsers
import { formDataToObject } from '@/utils/formdata';
//validators
import { isValidContentType } from '@/validators/isValidContentType';
import { isValidFormData } from '@/validators/isValidFormData';
//db
import {
    queryGetRebroadcastStatus,
    queryGetRebroadcastSeason,
} from '@/db/queries/rebroadcast';
import { updateSeason } from '@/update/season';
//auth
import { validateApiKey } from '@/db/queries/validateApiKey';
//track
import { umamiTrackEvent } from '@/utils/umami';

export async function POST(request) {
    //0. initialize
    const start = performance.now();
    let check = null;
    let formValues = null;

    //0.5 validate API key
    const { error: keyError } = await validateApiKey(request);
    if (keyError === 'disabled') {
        return errorResponse(403, start, 'Forbidden');
    }
    if (keyError) {
        return errorResponse(401, start, 'Unauthorized');
    }

    //1. test if valid POST request
    const contentType = request.headers.get('content-type') || '';
    check = isValidContentType.safeParse(contentType);
    if (!check.success) {
        return errorResponse(400, start, 'Invalid Content Type');
    }

    //2. get FormData and convert it to an object
    const formData = await request.formData();
    formValues = formDataToObject(formData);

    after(async () => {
        const data = {
            action: formValues.action,
            ms: roundedPerformanceTime(start),
        };
        if (data?.action === 'get_snapshots') {
            data.season = formValues.season;
        }
        await umamiTrackEvent(
            'API | Rebroadcast',
            '/api/h1/rebroadcast',
            'rebroadcast',
            data,
        );
    });
    if (typeof formValues.action !== 'string') {
        return errorResponse(400, start, 'No action set');
    }

    //3. validate FormData object structure using Zod
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

    //4. attempt to get data from db
    let data = undefined;
    switch (formValues.action) {
        case 'get_campaign_status': {
            const { data: statusResult, error: statusError } = await tryCatch(
                queryGetRebroadcastStatus(),
            );
            if (statusError) return errorResponse(404, start, 'Not found');
            data = statusResult?.query?.json;
            break;
        }
        case 'get_snapshots': {
            const { data: seasonResult, error: seasonError } = await tryCatch(
                queryGetRebroadcastSeason(formValues.season),
            );
            if (seasonError) return errorResponse(404, start, 'Not found');
            data = seasonResult?.query?.json;

            // fetch from remote if not available locally
            if (data === undefined || data === null) {
                const { error: seasonFetchError } = await tryCatch(
                    updateSeason(formValues.season),
                );
                if (seasonFetchError) {
                    return errorResponse(404, start, 'Not found');
                }
                const { data: retryResult, error: retryError } = await tryCatch(
                    queryGetRebroadcastSeason(formValues.season),
                );
                if (retryError) return errorResponse(404, start, 'Not found');
                data = retryResult?.query?.json;
            }
            break;
        }
        default:
            break;
    }

    //5. validate data from DB
    if (data === undefined || data === null) {
        return errorResponse(404, start, 'Not found');
    }
    //6. return response
    return successResponse(200, start, data);
}

// Custom handler for all other methods
const methodNotAllowed = () => {
    const start = performance.now();
    return errorResponse(405, start);
};

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
