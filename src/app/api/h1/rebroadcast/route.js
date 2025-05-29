import db from '@/db/db';
import { z } from 'zod/v4';
import { tryCatch } from '@/lib/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime, elapsedSeconds } from '@/utils/time';
import { NextResponse, after } from 'next/server';
//parsers
import { formDataToObject } from '@/utils/formdata';
//validators
import { isValidContentType } from '@/validators/isValidContentType';
import { isValidFormData } from '@/validators/isValidFormData';
//update
// import { updateStatus } from '@/lib/updateStatus.mjs';
// import { updateSeason } from '@/lib/updateSeason.mjs';
import {
    query_get_rebroadcast_status,
    query_get_rebroadcast_season,
} from '@/db/queries/rebroadcast';

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
    //schedule work after response is finished
    //read more at: https://nextjs.org/docs/app/api-reference/functions/after
    after(async () => {
        //7. log usage
        // console.log('after() ', performanceTime(start));

        //8. schedule update
        if (update) {
            if (formValues.action === 'get_campaign_status') {
                // const { data, error } = await tryCatch(updateStatus());
                //log update
                //trigger websocket update
            }
            if (formValues.action === 'get_snapshots') {
                // const { data, error } = await tryCatch(updateSeason(formValues.season));
                // if (data) {
                //     console.log('data1', data);
                // }
                // if (error) {
                //     console.log('error1', error.message);
                // }
                //log update
                //trigger websocket update
            }
        }
    });

    //0. initialize
    const start = performance.now();
    let check = null;
    let update = false;

    //1. test if valid POST request
    const contentType = request.headers.get('content-type') || '';
    check = isValidContentType.safeParse(contentType);
    if (!check.success) {
        return errorResponse(0);
    }

    //2. get FormData and convert it to an object. Test is "action" parameter is present.
    const formData = await request.formData();
    const formValues = formDataToObject(formData);
    if (typeof formValues.action !== 'string') {
        return errorResponse(1); //no action set
    }

    //3. validate FormData object structure using Zod
    check = isValidFormData.safeParse(formValues);
    if (!check.success) {
        // console.log('ERROR: ', check?.error);
        const code = check?.error?.issues[0]?.code || null;

        switch (code) {
            case 'invalid_union':
                return errorResponse(2);
                break;
            case 'invalid_type':
                return errorResponse(3);
                break;
            default:
                return errorResponse(null);
                break;
        }
    }
    if (formValues?.season) {
        formValues.season = Number(formValues.season); //cast to number, it is now safe to do so. Otherwise zod would've have thrown an error before this line.
    }

    //4. attempt to get data from db.
    let data = undefined;
    let elapsed = 0;
    switch (formValues.action) {
        case 'get_campaign_status':
            data = await query_get_rebroadcast_status();
            elapsed = elapsedSeconds(data?.data?.last_updated);
            if (elapsed > 10) {
                update = true;
            }
            data = data?.data?.json;
            break;
        case 'get_snapshots':
            data = await query_get_rebroadcast_season(formValues.season);
            elapsed = elapsedSeconds(data?.data?.last_updated);
            if (elapsed > 300) {
                update = true;
            }
            data = data?.data?.json;
            break;
        default:
            break;
    }

    //5. validate data from DB
    if (data === undefined || data === null) {
        update = true;
        return errorResponse(4);
    }

    //6. return response
    return NextResponse.json(data);
    // return NextResponse.json({data
    //     ms: performanceTime(start),
    //     time: Math.floor(Date.now() / 1000),
    //     data: data,
    // });
}

// generate the special rebroadcast error messages
function errorResponse(code) {
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
    return errorResponse(5);
};

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
