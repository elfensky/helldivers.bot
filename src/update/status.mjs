'use server';
import { tryCatch } from '@/lib/tryCatch.mjs'; //util
import { performance } from 'perf_hooks'; //util
import { performanceTime } from '@/utils/time'; //util
import { getCurrentSeason } from '@/utils/getCurrentSeason'; //util
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
    let check = null;

    //1. fetch
    const { data: fetchedData, error: fetchedError } = await tryCatch(fetchStatus());
    if (fetchedError) {
        throw new Error(fetchedError?.message || 'Failed to fetch status from the API', {
            cause: `/src/update/status.mjs | tryCatch(fetchStatus())`,
        });
    }

    //2. use zod to validate the response.
    if (!isValidStatus(fetchedData)) {
        throw new Error('Invalid status data', {
            cause: `/src/update/status.mjs | isValidStatus(fetchedData)`,
        });
    }

    const currentSeason = getCurrentSeason(fetchedData);

    //3. store in db -> /api/rebroadcast
    const { data: storedRebroadcastData, error: storedRebroadcastError } = await tryCatch(
        queryUpsertRebroadcastStatus(fetchedData),
    );
    if (storedRebroadcastError) {
        throw new Error(
            storedRebroadcastError?.message ||
                'Failed to store rebroadcast status in the database',
            {
                cause: `/src/update/status.mjs | queryUpsertRebroadcastStatus(fetchedData)`,
            },
        );
    }

    //4. store in db -> normalized & historic data
    try {
        //4.1 upsertSeason()
        const season = await queryUpsertSeason(currentSeason, false);
        //4.2 upsertCampaign()
        const campaigns = await queryUpsertCampaigns(fetchedData.campaign_status);
        //4.3 upsertDefendEvent()
        const defendEvent = await queryUpsertDefendEvent(fetchedData.defend_event);
        //4.4 upsertAttackEvent()
        const attackEvents = await queryUpsertAttackEvents(fetchedData.attack_events);
        //4.5 upsertStatistics()
        const statistics = await queryUpsertStatistics(fetchedData.statistics);

        //update last_updated time
        const season2 = await queryUpsertSeason(currentSeason, true);

        const response = {
            season: season,
            campaigns: campaigns,
            defendEvent: defendEvent,
            attackEvents: attackEvents,
            statistics: statistics,
        };

        return response;
    } catch (error) {
        throw error;
    }
}
