import { performance } from 'perf_hooks';
import { after } from 'next/server';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { requireApiKey } from '@/shared/utils/api/requireApiKey.mjs';
import { getClientIp } from '@/shared/utils/api/clientIp.mjs';
import { enforceRateLimit } from '@/shared/utils/api/rateLimit.mjs';
import { backfillAndRetry } from '@/shared/utils/api/backfillSeason.mjs';
import { getCacheControl } from '@/config/policy.mjs';
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

    const ip = getClientIp(request);
    const { error: limitError, headers: rlHeaders } = await enforceRateLimit(
        'public_read',
        ip,
        start,
    );
    if (limitError) return limitError;

    after(async () => {
        await umamiTrackEvent(
            'API | v1 season',
            '/api/v1/h1/season',
            'api-v1-season',
            {},
        );
    });

    const requested = parsed.data.seasons;
    let { data: result, error } = await tryCatch(getSeasons(requested));
    if (error) {
        reportError(error, { route: '/api/v1/h1/season', stage: 'get-seasons' });
        return errorResponse(500, start, 'Internal server error');
    }
    // Backfill only the single-explicit-season miss (a multi-season request with
    // some missing just omits them — request those individually to backfill).
    const onlySeason = requested.length === 1 ? requested[0] : null;
    if (result && result.rows.length === 0 && typeof onlySeason === 'number') {
        const r = await backfillAndRetry({
            season: onlySeason,
            ip,
            start,
            rerun: () => getSeasons(requested),
        });
        if (r.error) return r.error;
        result = r.result;
    }
    if (!result || result.rows.length === 0) {
        return errorResponse(404, start, 'Season not found');
    }

    // If the response includes the live season its metadata can still change
    // (last_updated); otherwise every row is a closed, immutable season.
    const includesCurrent = result.rows.some((r) => r.season === result.current);
    const cacheControl = getCacheControl(
        includesCurrent ? 'current-season' : 'closed-season',
    );

    return successResponse(200, start, projectSeasons(result.rows, result.current), {
        headers: { ...rlHeaders, 'Cache-Control': cacheControl },
    });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
