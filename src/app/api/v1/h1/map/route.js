import { performance } from 'perf_hooks';
import { after } from 'next/server';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { requireApiKey } from '@/shared/utils/api/requireApiKey.mjs';
import { getCacheControl } from '@/config/server.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { computeMapState } from '@/shared/utils/game/computeMapState.mjs';
import { EVENT_STATUS } from '@/shared/enums/events.mjs';
import { umamiTrackEvent } from '@/shared/utils/umami.mjs';
import { parseMapQuery, projectMap, enemyIdFromSlug } from './mapProjection.mjs';

/**
 * GET /api/v1/h1/map — render-ready galaxy map geometry (per-faction fronts)
 * via computeMapState. Key-gated. `at=latest` only for now.
 *
 * @param {Request} request - The incoming request.
 */
export async function GET(request) {
    const start = performance.now();

    const { error: authError } = await requireApiKey(request, start);
    if (authError) return authError;

    const parsed = parseMapQuery(new URL(request.url).searchParams);
    if (!parsed.success) return errorResponse(400, start, parsed.message);
    const query = parsed.data;

    if (query.at !== 'latest') {
        return errorResponse(
            400,
            start,
            'at=<datetime> historical map is not yet supported; use at=latest',
        );
    }

    const seasonInput = query.season === 'current' ? null : query.season;
    const enemyId = query.enemy ? enemyIdFromSlug(query.enemy) : undefined;

    after(async () => {
        await umamiTrackEvent('API | v1 map', '/api/v1/h1/map', 'api-v1-map', {});
    });

    const { data, error } = await tryCatch(getCampaign(seasonInput));
    if (error) {
        reportError(error, { route: '/api/v1/h1/map', stage: 'get-campaign' });
        return errorResponse(500, start, 'Internal server error');
    }
    if (!data) return errorResponse(404, start, 'Season not found');

    // Replicate computeLiveMapState's active-only filter (we also need the event
    // list for the response, which the helper doesn't return). Keeps the filter
    // and the computeMapState call together per the documented invariant.
    const activeEvents =
        query.events === 'none' ?
            []
        :   (data.events ?? []).filter((e) => e.status === EVENT_STATUS.ACTIVE);
    const mapState = computeMapState(data.status ?? [], activeEvents);
    const bucket = (data.status ?? []).reduce(
        (max, r) => Math.max(max, r.bucket ?? 0),
        0,
    );

    return successResponse(
        200,
        start,
        projectMap(mapState, activeEvents, {
            season: data.season,
            bucket,
            eventsMode: query.events,
            enemyId,
        }),
        { headers: { 'Cache-Control': getCacheControl('latest') } },
    );
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
