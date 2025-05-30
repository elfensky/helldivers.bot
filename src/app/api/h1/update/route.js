'use server';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime, elapsedSeconds } from '@/utils/time';
import { NextResponse, after } from 'next/server';
//update
import { updateStatus } from '@/update/status';
import { updateSeason } from '@/update/season';

export async function GET(request) {
    const key = process.env.UPDATE_API;
    if (request.nextUrl.searchParams.get('key') !== key) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    //STATUS
    const { data: statusData, error: statusError } = await tryCatch(updateStatus());
    if (statusError) {
        return NextResponse.json(statusError);
    }

    //SEASON
    const { data: seasonData, error: seasonError } = await tryCatch(
        updateSeason(statusData.season.query.season),
    );
    if (seasonError) {
        return NextResponse.json(seasonError);
    }

    //RESPONSE
    return NextResponse.json({ statusData, seasonData });
}

// Custom handler for all other methods
const methodNotAllowed = () => {
    return errorResponse(5);
};

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
