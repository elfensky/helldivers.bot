import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { updateSeason, SEASON_NOT_FOUND } from '@/update/season.mjs';

/**
 * Read a season's campaign data, seeding it from the official HD1 API on a
 * miss (the shared read → miss → seed → re-read dance previously hand-written
 * in both /archives page.jsx and /api/h1/campaign route.js).
 *
 * Returns a discriminated result — never throws, never renders. Callers own
 * their own presentation of each branch (404 vs page copy, reportError vs
 * console.error).
 *
 * @param {number | null} [season] - Season number, or null for the latest.
 * @returns {Promise<
 *   | { ok: true, data: object | null }
 *   | { ok: false, reason: 'not_found', message: string }
 *   | { ok: false, reason: 'error', stage: 'get-campaign' | 'backfill-season' | 'get-campaign-retry', error: Error }
 * >} `ok` with `data: null` means the seed succeeded but the season is still
 *   empty — callers render their own empty state.
 */
export async function getCampaignOrSeed(season = null) {
    const { data, error } = await tryCatch(getCampaign(season));
    if (error) return { ok: false, reason: 'error', stage: 'get-campaign', error };
    if (data) return { ok: true, data };

    const { error: seedError } = await tryCatch(updateSeason(season));
    if (seedError) {
        if (seedError.cause === SEASON_NOT_FOUND) {
            return { ok: false, reason: 'not_found', message: seedError.message };
        }
        return { ok: false, reason: 'error', stage: 'backfill-season', error: seedError };
    }

    const { data: retried, error: retryError } = await tryCatch(getCampaign(season));
    if (retryError) {
        return {
            ok: false,
            reason: 'error',
            stage: 'get-campaign-retry',
            error: retryError,
        };
    }
    return { ok: true, data: retried };
}
