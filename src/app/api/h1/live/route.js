import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { computeLiveMapState } from '@/shared/utils/game/computeMapState.mjs';

export async function GET() {
    const start = performance.now();

    const { data, error } = await tryCatch(getCampaign());
    if (error || !data) {
        return errorResponse(500, start, error?.message ?? 'No campaign data');
    }

    const mapState = computeLiveMapState(data);

    return successResponse(
        200,
        start,
        { data, mapState, appVersion: process.env.NEXT_PUBLIC_APP_VERSION },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
