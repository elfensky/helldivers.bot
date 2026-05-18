import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';

import { after } from 'next/server';
//validators
import { isValidNumber } from '@/validators/isValidNumber.mjs';
//db and fetch
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { updateSeason } from '@/update/season.mjs';
//track
import { umamiTrackEvent } from '@/shared/utils/umami.mjs';

export async function GET(request) {
    const start = performance.now();

    after(async () => {
        const data = {
            ms: roundedPerformanceTime(start),
        };
        await umamiTrackEvent('API | Campaign', '/api/h1/campaign', 'api-campaign', data);
    });
    let data = null;
    let season = null;

    if (request.nextUrl.searchParams.get('season')) {
        const check = isValidNumber.safeParse(request.nextUrl.searchParams.get('season'));
        if (!check.success)
            return errorResponse(400, start, check?.error?.issues[0]?.message);
        season = Number(request.nextUrl.searchParams.get('season'));
    }

    const { data: campaignData, error: campaignError } = await tryCatch(
        getCampaign(season),
    );
    if (campaignError) {
        reportError(campaignError, {
            route: '/api/h1/campaign',
            stage: 'get-campaign',
            season,
        });
        return errorResponse(500, start, campaignError?.message);
    }

    data = campaignData;

    if (!campaignData) {
        const { error: fetchError } = await tryCatch(updateSeason(season));
        if (fetchError) {
            if (fetchError.cause === 'SEASON_NOT_FOUND') {
                return errorResponse(404, start, fetchError.message);
            }
            reportError(fetchError, {
                route: '/api/h1/campaign',
                stage: 'backfill-season',
                season,
            });
            return errorResponse(500, start, fetchError?.message);
        }

        const { data: retriedCampaignData, error: retriedCampaignError } = await tryCatch(
            getCampaign(season),
        );
        if (retriedCampaignError) {
            reportError(retriedCampaignError, {
                route: '/api/h1/campaign',
                stage: 'get-campaign-retry',
                season,
            });
            return errorResponse(500, start, retriedCampaignError?.message);
        }

        data = retriedCampaignData;
    }
    return successResponse(200, start, data);
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
