import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time.mjs';
import { errorResponse, successResponse } from '@/shared/utils/api/responses.mjs';
import { after } from 'next/server';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
//parsers
import { formDataToObject } from '@/shared/utils/formdata.mjs';
//validators
import { isValidContentType } from '@/validators/isValidContentType.mjs';
import { isValidFormData } from '@/validators/isValidFormData.mjs';
//db
import { updateSeason } from '@/update/season.mjs';
//auth
import { validateApiKey, API_KEY_ERROR } from '@/db/queries/validateApiKey.mjs';
//track
import { umamiTrackEvent } from '@/shared/utils/umami.mjs';
//enums
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import { groupStatusByBucket } from '@/shared/utils/bucketing.mjs';

export async function POST(request) {
    //0. initialize
    const start = performance.now();
    let check = null;
    let formValues = null;

    //0.5 validate API key
    const { error: keyError } = await validateApiKey(request);
    if (keyError === API_KEY_ERROR.DISABLED) {
        return errorResponse(403, start, 'Forbidden');
    }
    if (keyError) {
        return errorResponse(401, start, 'Unauthorized');
    }

    //1. test if valid POST request
    const contentType = request.headers.get('content-type') || '';
    check = isValidContentType.safeParse(contentType);
    if (!check.success) {
        return errorResponse(400, start, 'Invalid Content Type');
    }

    //2. get FormData and convert it to an object
    const { data: formData, error: formError } = await tryCatch(request.formData());
    if (formError) return errorResponse(400, start, 'Invalid request body');
    formValues = formDataToObject(formData);

    if (typeof formValues.action !== 'string') {
        return errorResponse(400, start, 'No action set');
    }

    //3. validate FormData object structure using Zod
    check = isValidFormData.safeParse(formValues);
    if (!check.success) {
        const code = check?.error?.issues[0]?.code || null;
        if (code === 'invalid_union') {
            return errorResponse(400, start, 'Invalid action');
        }
        if (code === 'invalid_type') {
            return errorResponse(400, start, 'Missing or invalid arguments');
        }
        return errorResponse(500, start, 'Unknown validation error');
    }
    if (formValues?.season) {
        formValues.season = Number(formValues.season);
    }

    after(async () => {
        const data = {
            action: formValues.action,
            ms: roundedPerformanceTime(start),
        };
        if (data.action === 'get_snapshots') {
            data.season = formValues.season;
        }
        await umamiTrackEvent(
            'API | Rebroadcast',
            '/api/h1/rebroadcast',
            'api-rebroadcast',
            data,
        );
    });

    //4. reconstruct the HD1 wire format from the normalized tables
    let data = undefined;
    switch (formValues.action) {
        case 'get_campaign_status': {
            const { data: statusBody, error: statusError } = await tryCatch(
                reconstructCampaignStatus(),
            );
            if (statusError) return errorResponse(500, start, 'Internal server error');
            data = statusBody;
            break;
        }
        case 'get_snapshots': {
            const { data: snapshotBody, error: snapshotError } = await tryCatch(
                reconstructSnapshots(formValues.season),
            );
            if (snapshotError) return errorResponse(500, start, 'Internal server error');
            data = snapshotBody;

            // fetch from remote if the season isn't populated locally yet
            if (data === null) {
                const { error: seasonFetchError } = await tryCatch(
                    updateSeason(formValues.season),
                );
                if (seasonFetchError) {
                    return errorResponse(500, start, 'Internal server error');
                }
                const { data: retryBody, error: retryError } = await tryCatch(
                    reconstructSnapshots(formValues.season),
                );
                if (retryError) return errorResponse(500, start, 'Internal server error');
                data = retryBody;
            }
            break;
        }
        default:
            break;
    }

    //5. validate data from DB
    if (data === undefined || data === null) {
        return errorResponse(404, start, 'Not found');
    }
    //6. return response
    return successResponse(200, start, data);
}

/**
 * Reconstruct the `get_campaign_status` wire format from the normalized
 * tables (h1_season + h1_status + h1_statistic + h1_event). Uses the latest
 * season with data. Returns null when no season has been populated yet.
 *
 * Partial loss of fidelity vs the legacy wire format: the 4 event-count
 * fields on each statistics[] entry (defend_events, successful_defend_events,
 * attack_events, successful_attack_events) are omitted — they are derivable
 * from h1_event with COUNT(*) WHERE type=... AND status=... AND season=X.
 */
async function reconstructCampaignStatus() {
    // Latest season that has been populated.
    const seasonRow = await db.h1_season.findFirst({
        where: { last_updated: { not: null } },
        orderBy: { season: 'desc' },
        select: {
            season: true,
            introduction_order: true,
            points_max: true,
            season_duration: true,
        },
    });
    if (!seasonRow) return null;

    const targetSeason = seasonRow.season;

    // Latest h1_status row per faction (via $queryRaw DISTINCT ON, like
    // getCampaign.mjs). Prisma can't express DISTINCT ON natively.
    const latestStatus = await db.$queryRaw`
        SELECT DISTINCT ON (enemy) *
        FROM h1_status
        WHERE season = ${targetSeason}
        ORDER BY enemy ASC, bucket DESC
    `;
    const latestStats = await db.$queryRaw`
        SELECT DISTINCT ON (enemy) *
        FROM h1_statistic
        WHERE season = ${targetSeason}
        ORDER BY enemy ASC, bucket DESC
    `;
    const activeEvents = await db.h1_event.findMany({
        where: { season: targetSeason, status: EVENT_STATUS.ACTIVE },
    });

    const statByEnemy = new Map(latestStats.map((r) => [r.enemy, r]));

    const latestTime = Math.max(
        0,
        ...latestStatus.map((r) => r.time),
        ...latestStats.map((r) => r.time),
    );

    return {
        time: latestTime,
        error_code: 0,
        campaign_status: latestStatus.map((r) => ({
            enemy: r.enemy,
            points: r.points,
            points_taken: r.points_taken,
            points_max: seasonRow.points_max?.[r.enemy] ?? 0,
            status: r.status,
            introduction_order: seasonRow.introduction_order?.[r.enemy] ?? 0,
        })),
        statistics: [0, 1, 2].map((enemy) => {
            const s = statByEnemy.get(enemy);
            return {
                enemy,
                season_duration: seasonRow.season_duration ?? 0,
                players: s?.players ?? 0,
                total_unique_players: s?.total_unique_players ?? 0,
                missions: s?.missions ?? 0,
                successful_missions: s?.successful_missions ?? 0,
                total_mission_difficulty: s?.total_mission_difficulty ?? 0,
                completed_planets: s?.completed_planets ?? 0,
                // 4 fields intentionally omitted (derivable from h1_event):
                //   defend_events, successful_defend_events,
                //   attack_events, successful_attack_events
                kills: s?.kills != null ? Number(s.kills) : 0,
                deaths: s?.deaths != null ? Number(s.deaths) : 0,
                accidentals: s?.accidentals != null ? Number(s.accidentals) : 0,
                shots: s?.shots != null ? Number(s.shots) : 0,
                hits: s?.hits != null ? Number(s.hits) : 0,
            };
        }),
        defend_event: activeEvents.find((e) => e.type === EVENT_TYPE.DEFEND) ?? null,
        attack_events: activeEvents.filter((e) => e.type === EVENT_TYPE.ATTACK),
        introduction_order: seasonRow.introduction_order ?? [],
        points_max: seasonRow.points_max ?? [],
    };
}

/**
 * Reconstruct the `get_snapshots` wire format for a given season from the
 * normalized tables (h1_season + h1_status + h1_event). Returns null when
 * the season has no h1_season row yet (caller may then trigger an on-demand
 * updateSeason() fetch from the official API).
 *
 * Sparse buckets (missing one or more factions) are filtered out of the
 * snapshot array for consumer safety — matches getCampaign.mjs's behavior.
 */
async function reconstructSnapshots(season) {
    if (!season) return null;

    const seasonRow = await db.h1_season.findUnique({
        where: { season },
        select: {
            season: true,
            introduction_order: true,
            points_max: true,
        },
    });
    if (!seasonRow) return null;

    const allStatus = await db.h1_status.findMany({
        where: { season },
        orderBy: [{ bucket: 'asc' }, { enemy: 'asc' }],
    });
    const allEvents = await db.h1_event.findMany({
        where: { season },
    });

    const snapshots = groupStatusByBucket(allStatus).map(({ time, factions }) => ({
        season,
        time,
        data: JSON.stringify(factions),
    }));

    return {
        time: Math.floor(Date.now() / 1000),
        error_code: 0,
        introduction_order: seasonRow.introduction_order ?? [],
        points_max: seasonRow.points_max ?? [],
        snapshots,
        defend_events: allEvents.filter((e) => e.type === EVENT_TYPE.DEFEND),
        attack_events: allEvents.filter((e) => e.type === EVENT_TYPE.ATTACK),
    };
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
