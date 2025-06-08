'use server';
import { tryCatch } from '@/utils/tryCatch.mjs'; //util
import { performanceTime } from '@/utils/time'; //util
import { getSeasonFromStatus } from '@/utils/getSeason'; //util
import { fetchStatus } from '@/update/fetch.mjs'; //fetch
import { isValidStatus } from '@/validators/isValidStatus'; //validators
//db
import { queryUpsertRebroadcastStatus } from '@/db/queries/rebroadcast';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertCampaigns } from '@/db/queries/upsertCampaigns';
import { queryUpsertDefendEvent } from '@/db/queries/upsertDefendEvent';
import { queryUpsertAttackEvents } from '@/db/queries/upsertAttackEvents';
import { queryUpsertStatistics } from '@/db/queries/upsertStatistics';

export async function updateStatus() {
    //0. initialize
    const start = performance.now();
    // let check = null;

    //1. fetch
    const { data: fetchedData, error: fetchedError } = await tryCatch(fetchStatus());
    if (fetchedError) {
        throw new Error(fetchedError?.message || 'Failed to fetch status from the API', {
            cause: `/src/update/status.mjs | tryCatch(fetchStatus())`,
        });
    }

    //2. use zod to validate the response.
    const check = isValidStatus(fetchedData);
    if (!check.success) {
        throw new Error(check?.error?.message || 'Invalid status data', {
            cause: `/src/update/status.mjs | isValidStatus(fetchedData)`,
        });
    }

    //3. get season parameter from fetched data
    const season = getSeasonFromStatus(fetchedData);

    //4. store in db -> /api/rebroadcast
    const { data: storedRebroadcastData, error: storedRebroadcastError } = await tryCatch(
        queryUpsertRebroadcastStatus(season, fetchedData),
    );
    if (storedRebroadcastError) {
        throw new Error(
            storedRebroadcastError?.message ||
                'Failed to store rebroadcast STATUS in the database',
            {
                cause: `update/status.mjs | queryUpsertRebroadcastStatus(fetchedData)`,
            },
        );
    }

    //5. store in db -> normalized & historic data
    //5.1 create or update season in h1_season
    const { data: newSeason, error: newSeasonError } = await tryCatch(
        queryUpsertSeason(season, false),
    );
    if (newSeasonError) {
        throw new Error(
            newSeasonError?.message ||
                'Failed to store normalized status (season) in the database',
        );
    }

    //5.2-5.5 in parallel, create or update normalized data in h1_campaign, h1_defend_event, h1_attack_event, h1_statistics
    const [
        { data: newCampaigns, error: newCampaignsError }, //4.2 upsertCampaign()
        { data: newDefendEvent, error: newDefendEventError }, //4.3 upsertDefendEvent()
        { data: newAttackEvents, error: newAttackEventsError }, //4.4 upsertAttackEvent()
        { data: newStatistics, error: newStatisticsError }, //4.5 upsertStatistics()
    ] = await Promise.all([
        tryCatch(queryUpsertCampaigns(season, fetchedData.campaign_status)), //4.2 upsertCampaign()
        tryCatch(queryUpsertDefendEvent(season, fetchedData.defend_event)), //4.3 upsertDefendEvent()
        tryCatch(queryUpsertAttackEvents(season, fetchedData.attack_events)), //4.4 upsertAttackEvent()
        tryCatch(queryUpsertStatistics(season, fetchedData.statistics)), //4.5 upsertStatistics()
    ]);

    if (newCampaignsError)
        throw new Error(
            newCampaignsError?.message ||
                'Failed to store normalized status (campaigns) in the database',
        );
    if (newDefendEventError)
        throw new Error(
            newDefendEventError?.message ||
                'Failed to store normalized status (defendEvent) in the database',
        );
    if (newAttackEventsError)
        throw new Error(
            newAttackEventsError?.message ||
                'Failed to store normalized status (attackEvents) in the database',
        );
    if (newStatisticsError)
        throw new Error(
            newStatisticsError?.message ||
                'Failed to store normalized status (statistics) in the database',
        );

    // 6. confirm that the normalized data has succesfully been saved by updating the last_updated time in the season table
    const { data: confirmSeason, error: confirmSeasonError } = await tryCatch(
        queryUpsertSeason(season, true), //note the "true" parameter
    );
    if (confirmSeasonError) {
        throw new Error(
            confirmSeasonError?.message ||
                'Failed to update last_updated time in the database',
        );
    }

    //7. return response
    return {
        ms: performanceTime(start),
        season: season,
        confirmSeason,
        // newCampaigns,
        // newDefendEvent,
        // newAttackEvents,
        // newStatistics,
    };
}
