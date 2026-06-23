import { updateSeason, SEASON_NOT_FOUND } from '@/update/season.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { errorResponse } from './responses.mjs';
import { enforceRateLimit } from './rateLimit.mjs';

/**
 * Backfill a single missing historic season from the HD1 API. Mirrors the
 * on-demand fetch in `/api/h1/campaign` + `/api/h1/rebroadcast`.
 *
 * @param {number} season - The season number to fetch.
 * @returns {Promise<{ ok: true } | { ok: false, notFound: boolean, error: unknown }>}
 */
export async function backfillSeason(season) {
    const { error } = await tryCatch(updateSeason(season));
    if (error) {
        const notFound = error?.cause === SEASON_NOT_FOUND;
        if (!notFound) reportError(error, { stage: 'backfill-season', season });
        return { ok: false, notFound, error };
    }
    return { ok: true };
}

/**
 * Fallback for a /v1 read that resolved to no data: spend a `backfill_trigger`
 * token (keyed by IP), fetch the missing season, and re-run the query once. The
 * seed carries every season so this rarely fires — it's a safety net.
 *
 * `season === 'current'` is never backfilled: a missing current season is a
 * worker/DB problem, not an absent historic season, so it stays a 404.
 *
 * @template T
 * @param {object} p - Parameters.
 * @param {number | 'current'} p.season - The requested season param.
 * @param {string} p.ip - Caller IP (the backfill_trigger bucket).
 * @param {number} p.start - Request start time (for the response envelope).
 * @param {() => Promise<T>} p.rerun - Re-runs the season query (may resolve null/throw).
 * @returns {Promise<{ result: T | null, error: import('next/server').NextResponse | null }>}
 *   On success `result` is the re-fetched data; otherwise `error` is a ready
 *   404 / 500 / 429 response.
 */
export async function backfillAndRetry({ season, ip, start, rerun }) {
    if (season === 'current') {
        return { result: null, error: errorResponse(404, start, 'Season not found') };
    }

    const { error: limitError } = await enforceRateLimit('backfill_trigger', ip, start);
    if (limitError) return { result: null, error: limitError };

    const bf = await backfillSeason(season);
    if (!bf.ok) {
        return {
            result: null,
            error:
                bf.notFound ?
                    errorResponse(404, start, 'Season not found')
                :   errorResponse(500, start, 'Internal server error'),
        };
    }

    const { data: result, error } = await tryCatch(rerun());
    if (error) {
        reportError(error, { stage: 'backfill-retry', season });
        return {
            result: null,
            error: errorResponse(500, start, 'Internal server error'),
        };
    }
    if (result == null) {
        return { result: null, error: errorResponse(404, start, 'Season not found') };
    }
    return { result, error: null };
}
