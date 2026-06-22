import { performance } from 'perf_hooks';
import { after } from 'next/server';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { requireApiKey } from '@/shared/utils/api/requireApiKey.mjs';
import { getCacheControl } from '@/config/server.mjs';
import { computeEtag, notModified } from '@/shared/utils/api/etag.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { getStatusHistory } from '@/db/queries/getStatusHistory.mjs';
import { umamiTrackEvent } from '@/shared/utils/umami.mjs';
import {
    parseStatusQuery,
    projectLatest,
    projectHistory,
    enemyIdFromSlug,
    decodeCursor,
} from './statusProjection.mjs';

/**
 * GET /api/v1/h1/status — human-readable current campaign status (mode=latest)
 * or paginated history (mode=history). Key-gated; reuses the same projection
 * the dashboard consumes via getCampaign.
 *
 * @param {Request} request - The incoming request.
 */
export async function GET(request) {
    const start = performance.now();

    const { error: authError } = await requireApiKey(request, start);
    if (authError) return authError;

    const parsed = parseStatusQuery(new URL(request.url).searchParams);
    if (!parsed.success) return errorResponse(400, start, parsed.message);
    const query = parsed.data;

    const seasonInput = query.season === 'current' ? null : query.season;
    const enemyId = query.enemy ? enemyIdFromSlug(query.enemy) : undefined;

    after(async () => {
        await umamiTrackEvent('API | v1 status', '/api/v1/h1/status', 'api-v1-status', {
            mode: query.mode,
        });
    });

    if (query.mode === 'latest') {
        const { data: campaign, error } = await tryCatch(getCampaign(seasonInput));
        if (error) {
            reportError(error, { route: '/api/v1/h1/status', stage: 'get-campaign' });
            return errorResponse(500, start, 'Internal server error');
        }
        if (!campaign) return errorResponse(404, start, 'Season not found');
        return successResponse(
            200,
            start,
            projectLatest(campaign.status, campaign.season, query.limit, enemyId),
            { headers: { 'Cache-Control': getCacheControl('latest') } },
        );
    }

    // mode=history
    let cursorPos = null;
    if (query.cursor) {
        cursorPos = decodeCursor(query.cursor);
        if (!cursorPos) return errorResponse(400, start, 'Invalid cursor');
    }
    const fromUnix = query.from ? Math.floor(query.from.getTime() / 1000) : null;
    const toUnix = query.to ? Math.floor(query.to.getTime() / 1000) : null;

    const { data: history, error } = await tryCatch(
        getStatusHistory(seasonInput, {
            enemyId,
            fromUnix,
            toUnix,
            limit: query.limit,
            cursorPos,
            order: query.order,
        }),
    );
    if (error) {
        reportError(error, { route: '/api/v1/h1/status', stage: 'get-status-history' });
        return errorResponse(500, start, 'Internal server error');
    }
    if (!history) return errorResponse(404, start, 'Season not found');

    // Closed seasons are immutable → long TTL + ETag for 304s. `current` is the
    // keyword for live freshness; an explicit current-season number is cached as
    // closed (ponytail: param-based tier, no extra current-season query).
    const cacheControl = getCacheControl(
        query.season === 'current' ? 'current-season' : 'closed-season',
    );
    const data = projectHistory(
        history.rows,
        history.pointsMaxByEnemy,
        history.playersByKey,
        history.season,
        query.limit,
    );
    const etag = computeEtag(data);
    if (request.headers.get('if-none-match') === etag) {
        return notModified(etag, cacheControl);
    }
    return successResponse(200, start, data, {
        headers: { 'Cache-Control': cacheControl, ETag: etag },
    });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
