import { performance } from 'perf_hooks';
import { after } from 'next/server';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { requireApiKey } from '@/shared/utils/api/requireApiKey.mjs';
import { decodeCursor } from '@/shared/utils/api/cursor.mjs';
import { computeEtag, notModified } from '@/shared/utils/api/etag.mjs';
import { getClientIp } from '@/shared/utils/api/clientIp.mjs';
import { enforceRateLimit } from '@/shared/utils/api/rateLimit.mjs';
import { backfillAndRetry } from '@/shared/utils/api/backfillSeason.mjs';
import { config, getCacheControl } from '@/config/server.mjs';
import { getStats } from '@/db/queries/getStats.mjs';
import { umamiTrackEvent } from '@/shared/utils/umami.mjs';
import { parseStatsQuery, projectStats, enemyIdFromSlug } from './statsProjection.mjs';

/**
 * GET /api/v1/h1/stats — human-readable statistics timeseries for a season,
 * cursor-paginated. Key-gated.
 *
 * @param {Request} request - The incoming request.
 */
export async function GET(request) {
    const start = performance.now();

    const { error: authError } = await requireApiKey(request, start);
    if (authError) return authError;

    const parsed = parseStatsQuery(new URL(request.url).searchParams);
    if (!parsed.success) return errorResponse(400, start, parsed.message);
    const query = parsed.data;

    const ip = getClientIp(request);
    const { error: limitError, headers: rlHeaders } = await enforceRateLimit(
        'history_read',
        ip,
        start,
    );
    if (limitError) return limitError;

    const seasonInput = query.season === 'current' ? null : query.season;
    const enemyId = query.enemy ? enemyIdFromSlug(query.enemy) : undefined;

    let cursorPos = null;
    if (query.cursor) {
        cursorPos = decodeCursor(query.cursor);
        if (!cursorPos) return errorResponse(400, start, 'Invalid cursor');
    }
    const fromUnix = query.from ? Math.floor(query.from.getTime() / 1000) : null;
    const toUnix = query.to ? Math.floor(query.to.getTime() / 1000) : null;

    after(async () => {
        await umamiTrackEvent('API | v1 stats', '/api/v1/h1/stats', 'api-v1-stats', {});
    });

    const runStats = () =>
        getStats(seasonInput, {
            enemyId,
            fromUnix,
            toUnix,
            limit: query.limit,
            cursorPos,
            order: query.order,
        });

    let { data: result, error } = await tryCatch(runStats());
    if (error) {
        reportError(error, { route: '/api/v1/h1/stats', stage: 'get-stats' });
        return errorResponse(500, start, 'Internal server error');
    }
    if (!result) {
        const r = await backfillAndRetry({
            season: query.season,
            ip,
            start,
            rerun: runStats,
        });
        if (r.error) return r.error;
        result = r.result;
    }
    if (!result) return errorResponse(404, start, 'Season not found');

    // Closed-season stats are immutable → long TTL + ETag. See status route for
    // the `current` keyword vs explicit-number caveat.
    const cacheControl = getCacheControl(
        query.season === 'current' ? 'current-season' : 'closed-season',
    );
    const data = projectStats(result.rows, result.season, query.limit, config.bucketSize);
    const etag = computeEtag(data);
    if (request.headers.get('if-none-match') === etag) {
        return notModified(etag, cacheControl, rlHeaders);
    }
    return successResponse(200, start, data, {
        headers: { ...rlHeaders, 'Cache-Control': cacheControl, ETag: etag },
    });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
