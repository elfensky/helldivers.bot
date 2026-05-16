import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time';
import { errorResponse, successResponse } from '@/shared/utils/api/responses';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed';

import { after } from 'next/server';
//validators
import { isValidNumber } from '@/validators/isValidNumber';
//db and fetch
import { getCampaign } from '@/db/queries/getCampaign';
import { updateSeason } from '@/update/season';
//track
import { umamiTrackEvent } from '@/shared/utils/umami';

export async function GET(request) {
    //0. initialize
    const start = performance.now();

    after(async () => {
        const data = {
            ms: roundedPerformanceTime(start),
        };
        await umamiTrackEvent('API | Campaign', '/api/h1/campaign', 'api-campaign', data);
    });
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
        const { error: fetchError } = await tryCatch(
            updateSeason(season),
        );
        if (fetchError) {
            if (fetchError.cause === 'SEASON_NOT_FOUND') {
                return errorResponse(404, start, fetchError.message);
            }
            return errorResponse(500, start, fetchError?.message);
        }

        //2. fetch local data
        const { data: retriedCampaignData, error: retriedCampaignError } = await tryCatch(
            getCampaign(season),
        );
        if (retriedCampaignError)
            return errorResponse(500, start, retriedCampaignError?.message);

        //3. set result to variable
        data = retriedCampaignData;
    }
    //4. return response
    return successResponse(200, start, data);
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
