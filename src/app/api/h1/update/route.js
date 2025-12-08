'use server';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/utils/time';
import { errorResponse, successResponse } from '@/utils/responses';
import { after } from 'next/server';

//update
import { updateStatus } from '@/update/status';
import { updateSeason } from '@/update/season';
//track
import { umamiTrackEvent } from '@/utils/umami';

/**
 * @swagger
 * /api/h1/update:
 *   get:
 *     summary: Trigger current campaign status and snapshot updates
 *     description: >
 *       **Internal-use-only.**
 *       This endpoint is used by a node (web) worker to continiously trigger status and season updates for the current campaign.
 *       It is not intended for external user consumption.
 *       Requires a valid `key` query parameter matching the server's `UPDATE_KEY` environment variable.
 *     tags:
 *       - Internal
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Internal API key for authorization.
 *     responses:
 *       200:
 *         description: Update successful. Returns the updated status and season data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusData:
 *                   type: object
 *                   description: The updated status data.
 *                 seasonData:
 *                   type: object
 *                   description: The updated season data.
 *       401:
 *         description: Unauthorized. The provided key is missing or invalid.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *       405:
 *         description: Method Not Allowed. Only GET is supported.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Method Not Allowed
 */
export async function GET(request) {
    after(async () => {
        // const data = {
        //     status: statusTime,
        //     season: seasonTime,
        //     ms: roundedPerformanceTime(start),
        // };
        // await umamiTrackEvent('API | Update', '/api/h1/update', 'update', data);
    });

    //INITIALIZE
    const start = performance.now();
    const key = request.nextUrl.searchParams.get('key');
    if (!key) return errorResponse(400, start);
    const secret = process.env.UPDATE_KEY;
    if (key !== secret) return errorResponse(401, start);

    //STATUS
    const { data: statusData, error: statusError } = await tryCatch(updateStatus());
    if (statusError) {
        console.error(statusError?.message, statusError?.cause);
        return errorResponse(500, start, statusError?.message);
    }
    const statusTime = roundedPerformanceTime(start);

    //SEASON
    const { data: seasonData, error: seasonError } = await tryCatch(
        updateSeason(statusData.season),
    );
    if (seasonError) {
        console.error(seasonError?.message, seasonError?.cause);
        return errorResponse(500, start, seasonError?.message);
    }
    const seasonTime = roundedPerformanceTime(start);

    //RESPONSE
    return successResponse(200, start, {
        updated: {
            status: statusData,
            season: seasonData,
            // wait: wait,
        },
    });
}

// Custom handler for all other methods
const methodNotAllowed = () => {
    const start = performance.now();
    return errorResponse(405, start);
};

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
