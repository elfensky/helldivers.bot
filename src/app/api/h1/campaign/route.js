import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
// import { performanceTime } from '@/utils/time';
import { errorResponse, successResponse } from '@/utils/responses';

import { NextResponse, after } from 'next/server';
//validators
import { isValidNumber } from '@/validators/isValidNumber';
//db and fetch
import { getCampaign } from '@/db/queries/getCampaign';
import { updateSeason } from '@/update/season';
//track
import { umamiTrackPage } from '@/utils/umami';

/**
 * @swagger
 * /api/h1/campaign:
 *   get:
 *     summary: Get campaign data for a specific season or the latest.
 *     description: |
 *       Returns campaign data for a given season if the `season` query parameter is provided and valid.
 *       If no season is provided, returns the latest campaign data.
 *       If data is not found locally, attempts to fetch and update from a remote source.
 *     parameters:
 *       - in: query
 *         name: season
 *         schema:
 *           type: integer
 *         required: false
 *         description: The season number to fetch campaign data for.
 *     responses:
 *       200:
 *         description: Campaign data found and returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ms:
 *                   type: number
 *                   description: Time taken to process the request (ms).
 *                 data:
 *                   type: object
 *                   description: The campaign data object.
 *       400:
 *         description: Invalid season parameter.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ms:
 *                   type: number
 *                 error:
 *                   type: string
 *       404:
 *         description: Campaign data not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ms:
 *                   type: number
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ms:
 *                   type: number
 *                 error:
 *                   type: string
 */
export async function GET(request) {
    after(async () => {
        await umamiTrackPage(`API | Campaign | ${season}`, '/api/h1/campaign');
    });

    //0. initialize
    const start = performance.now();
    let requestType = null; // latest, specific, multiple
    let data = null;
    let season = null;

    //1. validate query parameters (if any)
    if (request.nextUrl.searchParams.get('season')) {
        const check = isValidNumber.safeParse(request.nextUrl.searchParams.get('season'));
        if (!check.success)
            return errorResponse(400, start, check?.error?.issues[0]?.message); //invalid season
        season = Number(request.nextUrl.searchParams.get('season'));
    }

    //2. get data from db
    const { data: campaignData, error: campaignError } = await tryCatch(
        getCampaign(season),
    );
    if (campaignError) {
        return errorResponse(500, start, campaignError?.message);
    }

    data = campaignData;

    //3. if no data, attempt fetch remote data
    if (!campaignData) {
        //1. fetch remote data
        const { data: fetchData, error: fetchError } = await tryCatch(
            updateSeason(season),
        );
        //1.1 process error(s)
        if (fetchError) {
            if (fetchError?.issues) {
                if (
                    fetchError?.issues[0]?.code === 'invalid_type' &&
                    // fetchError?.issues[0]?.path[0] === 'introduction_order' &&
                    fetchError?.issues[0]?.received === 'null'
                ) {
                    let message = `Couldn't find campaign with season ${season}`;
                    return errorResponse(404, start, message);
                }
                return errorResponse(500, start, fetchError?.issues);
            } else {
                return errorResponse(500, start, fetchError);
            }
        }

        //2. fetch local data
        const { data: campaignData2, error: campaignError2 } = await tryCatch(
            getCampaign(season),
        );
        if (campaignError2) return errorResponse(500, start, campaignError2?.message);

        //3. set result to variable
        data = campaignData2;
    }
    //4. return response
    return successResponse(200, start, data);
}

const methodNotAllowed = () => {
    const start = performance.now();
    return errorResponse(405, start);
};

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
