'use server';
import { tryCatch } from '@/lib/tryCatch'; //util
import { performance } from 'perf_hooks'; //util
import { performanceTime } from '@/utils/time'; //util
import { getCurrentSeason } from '@/utils/getCurrentSeason'; //util
import { fetchSeason } from '@/update/fetch'; //fetch
import { isValidSeason } from '@/validators/isValidSeason'; //validators
//db
import { queryUpsertRebroadcastSeason } from '@/db/queries/rebroadcast';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertIntroductionOrder } from '@/db/queries/upsertIntroductionOrder';
import { queryUpsertPointsMax } from '@/db/queries/upsertPointsMax';
import { queryUpsertSnapshots } from '@/db/queries/upsertSnapshots';
import { queryUpsertDefendEvents } from '@/db/queries/upsertDefendEvents';
import { queryUpsertAttackEvents } from '@/db/queries/upsertAttackEvents';

export async function updateSeason(season) {
    //0. initialize
    const start = performance.now();
    let check = null;

    //1. fetch
    const { data: fetchedData, error: fetchedError } = await tryCatch(
        fetchSeason(season),
    );
    if (fetchedError) {
        throw new Error(fetchedError?.message || 'Failed to fetch status from the API', {
            cause: `/src/update/season.mjs | tryCatch(fetchSeason())`,
        });
    }

    //2. use zod to validate the response.
    check = isValidSeason(fetchedData);
    if (!check.success) {
        throw check.error;
    }

    //3. store in db -> /api/rebroadcast
    const { data: storedRebroadcastData, error: storedRebroadcastError } = await tryCatch(
        queryUpsertRebroadcastSeason(season, fetchedData),
    );
    if (storedRebroadcastError) {
        throw new Error(
            storedRebroadcastError?.message ||
                'Failed to store rebroadcast season in the database',
            {
                cause: `/src/update/season.mjs | queryUpsertRebroadcastSeason(fetchedData)`,
            },
        );
    }

    //4. store in db -> normalized & historic data
    try {
        //4.1 upserSeason()
        const newSeason = await queryUpsertSeason(season, false);
        //4.2 upsertIntroductionOrder()
        const newIntroductionOrder = await queryUpsertIntroductionOrder(
            season,
            fetchedData.introduction_order,
        );
        //4.3 upsertPointsMax()
        const newPointsMax = await queryUpsertPointsMax(season, fetchedData.points_max);
        //4.4 upsertSnapshots()
        const newSnapshots = await queryUpsertSnapshots(season, fetchedData.snapshots);
        //4.5 upsertDefendEvents()
        const newDefendEvents = await queryUpsertDefendEvents(fetchedData.defend_events);
        //4.6 upsertAttackEvents()
        const newAttackEvents = await queryUpsertAttackEvents(fetchedData.attack_events);

        //update last_updated time
        const last_updated = await queryUpsertSeason(season, true);

        const response = {
            season: newSeason,
            introductionOrder: newIntroductionOrder,
            pointsMax: newPointsMax,
            snapshots: newSnapshots,
            defendEvents: newDefendEvents,
            attackEvents: newAttackEvents,
            zzz: fetchedData,
        };

        return response;
    } catch (error) {
        console.error(error.message, {
            cause: '/src/update/season.mjs',
        });
        throw error;
    }
}
