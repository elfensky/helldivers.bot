import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/utils/time';
import { NextResponse, after } from 'next/server';
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
import { validateApiKey } from '@/db/queries/api';
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
        return rebroadcastErrorResponse(7);
    }
    if (keyError) {
        return rebroadcastErrorResponse(6);
    }

    //1. test if valid POST request
    const contentType = request.headers.get('content-type') || '';
    check = isValidContentType.safeParse(contentType);
    if (!check.success) {
        return rebroadcastErrorResponse(0);
    }

    //2. get FormData and convert it to an object. Test is "action" parameter is present.
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
        return rebroadcastErrorResponse(1); //no action set
    }

    //3. validate FormData object structure using Zod
    check = isValidFormData.safeParse(formValues);
    if (!check.success) {
        // console.error(
        //     check?.error?.issues[0]?.message,
        //     '| cause: /src/app/api/h1/rebroadcast/route.js | isValidFormData()',
        // );
        const code = check?.error?.issues[0]?.code || null;

        switch (code) {
            case 'invalid_union':
                return rebroadcastErrorResponse(2);
            case 'invalid_type':
                return rebroadcastErrorResponse(3);
            default:
                return rebroadcastErrorResponse(null);
        }
    }
    if (formValues?.season) {
        formValues.season = Number(formValues.season); //cast to number, it is now safe to do so. Otherwise zod would've have thrown an error before this line.
    }

    //4. attempt to get data from db.
    let data = undefined;
    // let elapsed = 0;
    switch (formValues.action) {
        case 'get_campaign_status': {
            const { data: statusResult, error: statusError } = await tryCatch(
                queryGetRebroadcastStatus(),
            );
            if (statusError) return rebroadcastErrorResponse(4);
            data = statusResult?.data?.json;
            break;
        }
        case 'get_snapshots': {
            const { data: seasonResult, error: seasonError } = await tryCatch(
                queryGetRebroadcastSeason(formValues.season),
            );
            if (seasonError) return rebroadcastErrorResponse(4);
            data = seasonResult?.data?.json;

            // fetch from remote if not available locally
            if (data === undefined || data === null) {
                const { data: seasonData, error: seasonFetchError } = await tryCatch(
                    updateSeason(formValues.season),
                );
                if (seasonFetchError) {
                    return rebroadcastErrorResponse(4);
                }
                const { data: retryResult, error: retryError } = await tryCatch(
                    queryGetRebroadcastSeason(formValues.season),
                );
                if (retryError) return rebroadcastErrorResponse(4);
                data = retryResult?.data?.json;
            }
            break;
        }
        default:
            break;
    }

    // //5. validate data from DB
    if (data === undefined || data === null) {
        return rebroadcastErrorResponse(4);
    }
    //6. return response
    return NextResponse.json(data);
}

// generate the special rebroadcast error messages
function rebroadcastErrorResponse(code) {
    let message = '';
    let status = 0;
    switch (code) {
        case 0:
            message = 'Invalid Content Type';
            status = 400;
            break;
        case 1:
            message = 'No action set';
            status = 400;
            break;
        case 2:
            message = 'Invalid action';
            status = 400;
            break;
        case 3:
            message = 'Missing or invalid arguments';
            status = 400;
            break;
        case 4:
            message = 'Not found';
            status = 404;
            break;
        case 5:
            message = 'Method not allowed';
            status = 405;
            break;
        case 6:
            message = 'Unauthorized';
            status = 401;
            break;
        case 7:
            message = 'Forbidden';
            status = 403;
            break;
        default:
            message = 'Unknown error';
            status = 500;
            break;
    }

    return NextResponse.json(
        {
            time: Math.floor(Date.now() / 1000),
            error_code: code,
            error_message: message,
        },
        { status },
    );
}

// Custom handler for all other methods
const methodNotAllowed = () => {
    return rebroadcastErrorResponse(5);
};

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
