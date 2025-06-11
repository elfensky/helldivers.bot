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
//track
import { umamiTrackEvent } from '@/utils/umami';

/**
 * @openapi
 * /api/h1/rebroadcast:
 *   post:
 *     summary: Perform a campaign status or snapshot action
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [get_campaign_status, get_snapshot]
 *                 description: The action to perform.
 *               season:
 *                 type: integer
 *                 minimum: 1
 *                 description: Required if action is get_snapshot.
 *             required:
 *               - action
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [get_campaign_status, get_snapshot]
 *                 description: The action to perform.
 *               season:
 *                 type: integer
 *                 minimum: 1
 *                 description: Required if action is get_snapshot.
 *             required:
 *               - action
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(request) {
    after(async () => {
        const data = {
            action: formValues.action,
            ms: roundedPerformanceTime(start),
        };
        if (data?.action === 'get_snapshots') {
            data.season = formValues.season;
        }
        await umamiTrackEvent('API | Rebroadcast', '/api/h1/update', 'rebroadcast', data);
    });

    //0. initialize
    const start = performance.now();
    let check = null;
    let update = false;
    // let elapsed = null;

    //1. test if valid POST request
    const contentType = request.headers.get('content-type') || '';
    check = isValidContentType.safeParse(contentType);
    if (!check.success) {
        return rebroadcastErrorResponse(0);
    }

    //2. get FormData and convert it to an object. Test is "action" parameter is present.
    const formData = await request.formData();
    const formValues = formDataToObject(formData);
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
                break;
            case 'invalid_type':
                return rebroadcastErrorResponse(3);
                break;
            default:
                return rebroadcastErrorResponse(null);
                break;
        }
    }
    if (formValues?.season) {
        formValues.season = Number(formValues.season); //cast to number, it is now safe to do so. Otherwise zod would've have thrown an error before this line.
    }

    //4. attempt to get data from db.
    let data = undefined;
    // let elapsed = 0;
    switch (formValues.action) {
        case 'get_campaign_status':
            data = await queryGetRebroadcastStatus();
            data = data?.data?.json;
            //this should theoretically never fail, as the application will fetch the current campaign status from the api on startup.
            //hence, unlike season, there is no need to live-update the status or check if it's empty
            break;
        case 'get_snapshots':
            data = await queryGetRebroadcastSeason(formValues.season);
            data = data?.data?.json;

            //fetch from remote if not available locally
            if (data === undefined || data === null) {
                const { data: seasonData, error: seasonError } = await tryCatch(
                    updateSeason(formValues.season),
                );
                if (seasonError) {
                    return rebroadcastErrorResponse(4);
                } else {
                    data = await queryGetRebroadcastSeason(formValues.season);
                    data = data?.data?.json;
                }
            }
            break;
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
