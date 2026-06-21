import { performance } from 'perf_hooks';
import { after } from 'next/server';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { requireApiKey } from '@/shared/utils/api/requireApiKey.mjs';
import { getSeasons } from '@/db/queries/getSeasons.mjs';
import { umamiTrackEvent } from '@/shared/utils/umami.mjs';
import { parseSeasonQuery, projectSeasons } from './seasonProjection.mjs';

/**
 * GET /api/v1/h1/season — season metadata (introduction order, points_max,
 * duration). Returns an array; supports multiple `?season=` params. Key-gated.
 *
 * @param {Request} request - The incoming request.
 */
export async function GET(request) {
    const start = performance.now();

    const { error: authError } = await requireApiKey(request, start);
    if (authError) return authError;

    const parsed = parseSeasonQuery(new URL(request.url).searchParams);
    if (!parsed.success) return errorResponse(400, start, parsed.message);

    after(async () => {
        await umamiTrackEvent(
            'API | v1 season',
            '/api/v1/h1/season',
            'api-v1-season',
            {},
        );
    });

    const { data: result, error } = await tryCatch(getSeasons(parsed.data.seasons));
    if (error) {
        reportError(error, { route: '/api/v1/h1/season', stage: 'get-seasons' });
        return errorResponse(500, start, 'Internal server error');
    }
    if (!result || result.rows.length === 0) {
        return errorResponse(404, start, 'Season not found');
    }

    return successResponse(200, start, projectSeasons(result.rows, result.current));
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
