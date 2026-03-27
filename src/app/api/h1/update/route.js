import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/utils/time';
import { errorResponse, successResponse } from '@/utils/responses';
//update
import { updateStatus } from '@/update/status';
import { updateSeason } from '@/update/season';

export async function GET(request) {
    //INITIALIZE
    const start = performance.now();
    const header = request.headers.get('authorization');
    const key = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!key) return errorResponse(401, start);
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
