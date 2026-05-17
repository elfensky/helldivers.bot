import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performanceTime } from '@/shared/utils/time.mjs';
import { getSeasonFromStatus } from '@/shared/utils/getSeason.mjs';
import { fetchStatus } from '@/update/fetch.mjs';
import { EVENT_TYPE } from '@/shared/enums/events.mjs';
import { isValidStatus } from '@/validators/isValidStatus.mjs';
// db
import { upsertSeason } from '@/db/queries/upsertSeason.mjs';
import { upsertEvent } from '@/db/queries/upsertEvent.mjs';
import { upsertStatus } from '@/db/queries/upsertStatus.mjs';
import { upsertStatistic } from '@/db/queries/upsertStatistic.mjs';
import { upsertEventProgress } from '@/db/queries/upsertEventProgress.mjs';

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
    const check = isValidStatus.safeParse(fetchedData);
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
        upsertSeason(season, false, { introOrder, pointsMax, seasonDuration }),
    );
    if (seasonError) {
        throw new Error(seasonError?.message || 'Failed to upsert season');
    }

    // 5. Upsert events (h1_event unchanged)
    if (fetchedData.defend_event) {
        const { error: defendError } = await tryCatch(
            upsertEvent(season, EVENT_TYPE.DEFEND, fetchedData.defend_event),
        );
        if (defendError) {
            throw new Error(defendError?.message || 'Failed to upsert defend event');
        }
    }

    for (const event of fetchedData.attack_events) {
        const { error: attackError } = await tryCatch(
            upsertEvent(season, EVENT_TYPE.ATTACK, { ...event, region: 11 }),
        );
        if (attackError) {
            throw new Error(attackError?.message || 'Failed to upsert attack event');
        }
    }

    // 6. Bucket-upsert h1_status for all 3 factions (campaign progression timeseries)
    for (let enemy = 0; enemy < 3; enemy++) {
        const campaign = fetchedData.campaign_status[enemy];
        const { error: statusError } = await tryCatch(
            upsertStatus(season, enemy, fetchedData.time, campaign),
        );
        if (statusError) {
            throw new Error(statusError?.message || 'Failed to upsert h1_status');
        }
    }

    // 7. Bucket-upsert h1_statistic for all 3 factions (stats timeseries)
    for (let enemy = 0; enemy < 3; enemy++) {
        const stats = fetchedData.statistics[enemy];
        const { error: statError } = await tryCatch(
            upsertStatistic(season, enemy, fetchedData.time, stats),
        );
        if (statError) {
            throw new Error(statError?.message || 'Failed to upsert h1_statistic');
        }
    }

    // 8. Bucket-upsert h1_event_progress for active events (event progression).
    // upsertEventProgress applies its own cross-season guard, so we don't pre-filter here.
    if (fetchedData.defend_event) {
        const { error: defProgError } = await tryCatch(
            upsertEventProgress(
                season,
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
        const { error: atkProgError } = await tryCatch(
            upsertEventProgress(season, EVENT_TYPE.ATTACK, event, fetchedData.time),
        );
        if (atkProgError) {
            console.error('Attack event progress error:', atkProgError.message);
        }
    }

    // 9. Confirm season update (sets last_updated = now)
    const { data: confirmSeason, error: confirmError } = await tryCatch(
        upsertSeason(season, true),
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
