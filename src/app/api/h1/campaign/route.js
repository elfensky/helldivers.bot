import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';

import { after } from 'next/server';
//validators
import { isValidNumber } from '@/validators/isValidNumber.mjs';
//db and fetch
import { getCampaignOrSeed } from '@/db/queries/getCampaignOrSeed.mjs';
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
    /** @type {number | null} */
    let season = null;

    if (request.nextUrl.searchParams.get('season')) {
        const check = isValidNumber.safeParse(request.nextUrl.searchParams.get('season'));
        if (!check.success)
            return errorResponse(400, start, check?.error?.issues[0]?.message);
        season = Number(request.nextUrl.searchParams.get('season'));
    }

    const result = await getCampaignOrSeed(season);
    if (!result.ok) {
        if (result.reason === 'not_found') {
            return errorResponse(404, start, result.message);
        }
        reportError(result.error, {
            route: '/api/h1/campaign',
            stage: result.stage,
            season,
        });
        return errorResponse(500, start, result.error?.message);
    }
    return successResponse(200, start, result.data);
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
