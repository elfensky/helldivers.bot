import { tryCatch } from '@/utils/tryCatch'; //util
import { performance } from 'perf_hooks'; //util
import { performanceTime } from '@/utils/time'; //util
import { getSeasonFromSnapshot } from '@/utils/getSeason'; //util
import { EVENT_TYPE } from '@/enums/events';
import { fetchSeason } from '@/update/fetch'; //fetch
import { isValidSeason } from '@/validators/isValidSeason'; //validators
//db
import { queryUpsertRebroadcastSeason } from '@/db/queries/rebroadcast';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertIntroductionOrder } from '@/db/queries/upsertIntroductionOrder';
import { queryUpsertPointsMax } from '@/db/queries/upsertPointsMax';
import { queryUpsertSnapshots } from '@/db/queries/upsertSnapshots';
import { queryUpsertEvent } from '@/db/queries/upsertEvent';

export async function updateSeason(season) {
    //0. initialize
    const start = performance.now();
    // let check = null;

    if (!season) throw new Error('season is missing');

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
    const check = isValidSeason(fetchedData);
    if (!check.success) {
        for (const issue of check?.error?.issues) {
            console.error('update/season.mjs | isValidSeason() | ', issue.message);
        }
        throw check.error;
    }

    //3. get season parameter from fetched data.
    const fetchedSeason = getSeasonFromSnapshot(fetchedData);
    if (season !== fetchedSeason) throw new Error('Invalid season');

    //4. store in db -> /api/rebroadcast
    const { error: storedRebroadcastError } = await tryCatch(
        queryUpsertRebroadcastSeason(season, fetchedData),
    );
    if (storedRebroadcastError) {
        throw new Error(
            storedRebroadcastError?.message ||
                'Failed to store rebroadcast SEASON in the database',
            {
                cause: `update/season.mjs | queryUpsertRebroadcastSeason(fetchedData)`,
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

    //5.2-5.4 in parallel, create or update normalized data
    const [
        { data: newIntroductionOrder, error: newIntroductionOrderError },
        { data: newPointsMax, error: newPointsMaxError },
        { data: newSnapshots, error: newSnapshotsError },
    ] = await Promise.all([
        tryCatch(queryUpsertIntroductionOrder(season, fetchedData.introduction_order)),
        tryCatch(queryUpsertPointsMax(season, fetchedData.points_max)),
        tryCatch(queryUpsertSnapshots(season, fetchedData.snapshots)),
    ]);

    if (newIntroductionOrderError) {
        throw new Error(
            newIntroductionOrderError?.message ||
                'Failed to store normalized snapshot (introductionOrder) in the database',
        );
    }
    if (newPointsMaxError) {
        throw new Error(
            newPointsMaxError?.message ||
                'Failed to store normalized snapshot (pointsMax) in the database',
        );
    }
    if (newSnapshotsError) {
        throw new Error(
            newSnapshotsError?.message ||
                'Failed to store normalized snapshot (snapshots) in the database',
        );
    }

    //5.5 Defend events
    for (const event of fetchedData.defend_events) {
        const { error: defendError } = await tryCatch(
            queryUpsertEvent(season, EVENT_TYPE.DEFEND, event),
        );
        if (defendError) {
            throw new Error(
                defendError?.message ||
                    'Failed to store normalized snapshot (defendEvent)',
            );
        }
    }

    //5.6 Attack events (set region to 11 for homeworld)
    for (const event of fetchedData.attack_events) {
        const { error: attackError } = await tryCatch(
            queryUpsertEvent(season, EVENT_TYPE.ATTACK, { ...event, region: 11 }),
        );
        if (attackError) {
            throw new Error(
                attackError?.message ||
                    'Failed to store normalized snapshot (attackEvent)',
            );
        }
    }

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

    return {
        ms: performanceTime(start),
        season: season,
        confirmSeason,
    };
}
