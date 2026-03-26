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
