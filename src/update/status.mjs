import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performanceTime } from '@/shared/utils/time';
import { getSeasonFromStatus } from '@/shared/utils/getSeason';
import { fetchStatus } from '@/update/fetch.mjs';
import { EVENT_TYPE } from '@/shared/enums/events.mjs';
import { isValidStatus } from '@/validators/isValidStatus';
// db
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertEvent } from '@/db/queries/upsertEvent';
import { queryUpsertStatus } from '@/db/queries/upsertStatus';
import { queryUpsertStatistic } from '@/db/queries/upsertStatistic';
import { queryUpsertEventProgress } from '@/db/queries/upsertEventProgress';

export async function updateStatus() {
    const start = performance.now();

    // 1. Fetch
    const { data: fetchedData, error: fetchedError } = await tryCatch(fetchStatus());
    if (fetchedError) {
        throw new Error(fetchedError?.message || 'Failed to fetch status from the API', {
            cause: 'update/status.mjs | tryCatch(fetchStatus())',
        });
    }

    // 2. Validate
    const check = isValidStatus(fetchedData);
    if (!check.success) {
        console.error(check.error);
        throw new Error(check?.error?.message || 'Invalid status data', {
            cause: 'update/status.mjs | isValidStatus(fetchedData)',
        });
    }

    // 3. Resolve season
    const season = getSeasonFromStatus(fetchedData);

    // 4. Upsert season metadata with inlined intro_order + points_max arrays + season_duration
    const introOrder = fetchedData.campaign_status.map((c) => c.introduction_order);
    const pointsMax = fetchedData.campaign_status.map((c) => c.points_max);
    const seasonDuration = fetchedData.statistics[0]?.season_duration ?? 0;
    const { error: seasonError } = await tryCatch(
        queryUpsertSeason(season, false, { introOrder, pointsMax, seasonDuration }),
    );
    if (seasonError) {
        throw new Error(seasonError?.message || 'Failed to upsert season');
    }

    // 5. Upsert events (h1_event unchanged)
    if (fetchedData.defend_event) {
        const { error: defendError } = await tryCatch(
            queryUpsertEvent(season, EVENT_TYPE.DEFEND, fetchedData.defend_event),
        );
        if (defendError) {
            throw new Error(defendError?.message || 'Failed to upsert defend event');
        }
    }

    for (const event of fetchedData.attack_events) {
        const { error: attackError } = await tryCatch(
            queryUpsertEvent(season, EVENT_TYPE.ATTACK, { ...event, region: 11 }),
        );
        if (attackError) {
            throw new Error(attackError?.message || 'Failed to upsert attack event');
        }
    }

    // 6. Bucket-upsert h1_status for all 3 factions (campaign progression timeseries)
    for (let enemy = 0; enemy < 3; enemy++) {
        const campaign = fetchedData.campaign_status[enemy];
        const { error: statusError } = await tryCatch(
            queryUpsertStatus(season, enemy, fetchedData.time, campaign),
        );
        if (statusError) {
            throw new Error(statusError?.message || 'Failed to upsert h1_status');
        }
    }

    // 7. Bucket-upsert h1_statistic for all 3 factions (stats timeseries)
    for (let enemy = 0; enemy < 3; enemy++) {
        const stats = fetchedData.statistics[enemy];
        const { error: statError } = await tryCatch(
            queryUpsertStatistic(season, enemy, fetchedData.time, stats),
        );
        if (statError) {
            throw new Error(statError?.message || 'Failed to upsert h1_statistic');
        }
    }

    // 8. Bucket-upsert h1_event_progress for active events (event progression)
    if (fetchedData.defend_event && fetchedData.defend_event.season === season) {
        const { error: defProgError } = await tryCatch(
            queryUpsertEventProgress(
                EVENT_TYPE.DEFEND,
                fetchedData.defend_event,
                fetchedData.time,
            ),
        );
        if (defProgError) {
            console.error('Defend event progress error:', defProgError.message);
        }
    }

    for (const event of fetchedData.attack_events) {
        if (event.season !== season) continue;
        const { error: atkProgError } = await tryCatch(
            queryUpsertEventProgress(EVENT_TYPE.ATTACK, event, fetchedData.time),
        );
        if (atkProgError) {
            console.error('Attack event progress error:', atkProgError.message);
        }
    }

    // 9. Confirm season update (sets last_updated = now)
    const { data: confirmSeason, error: confirmError } = await tryCatch(
        queryUpsertSeason(season, true),
    );
    if (confirmError) {
        throw new Error(confirmError?.message || 'Failed to update last_updated');
    }

    return {
        ms: performanceTime(start),
        season,
        time: fetchedData.time,
        confirmSeason,
    };
}
