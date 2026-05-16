import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time.mjs';
import { getSeasonFromSnapshot } from '@/shared/utils/getSeason.mjs';
import { EVENT_TYPE } from '@/shared/enums/events.mjs';
import { fetchSeason } from '@/update/fetch.mjs';
import { isValidSeason } from '@/validators/isValidSeason.mjs';
import { computeBucket } from '@/shared/utils/bucketing.mjs';
// db
import { queryUpsertSeason } from '@/db/queries/upsertSeason.mjs';
import { queryUpsertEvent } from '@/db/queries/upsertEvent.mjs';
import { queryUpsertStatus } from '@/db/queries/upsertStatus.mjs';

/**
 * @param {number} season
 * @param {{ protectedBucket?: number }} opts  When set, skip writing h1_status
 *   rows whose bucket >= this value. The worker poll passes this to prevent
 *   stale get_snapshots data from overwriting the live bucket that
 *   updateStatus() just wrote.
 */
export async function updateSeason(season, opts = {}) {
    const start = performance.now();
    if (!season) throw new Error('season is missing');

    // 1. Fetch from get_snapshots API
    const { data: fetchedData, error: fetchedError } = await tryCatch(
        fetchSeason(season),
    );
    if (fetchedError) {
        throw new Error(fetchedError?.message || 'Failed to fetch snapshots', {
            cause: `update/season.mjs | fetchSeason(${season})`,
        });
    }

    // 2. Validate
    const check = isValidSeason(fetchedData);
    if (!check.success) {
        for (const issue of check?.error?.issues ?? []) {
            console.error('update/season.mjs | isValidSeason() | ', issue.message);
        }
        throw new Error(check?.error?.message || 'Invalid season data', {
            cause: 'update/season.mjs | isValidSeason(fetchedData)',
        });
    }

    // 3. Verify season parameter matches fetched data.
    //    getSeasonFromSnapshot throws "No seasons found" when snapshots/events
    //    are all empty — that means the season doesn't exist on the HD1 API.
    let fetchedSeason;
    try {
        fetchedSeason = getSeasonFromSnapshot(fetchedData);
    } catch {
        throw new Error(`Season ${season} not found`, { cause: 'SEASON_NOT_FOUND' });
    }
    if (season !== fetchedSeason) throw new Error('Invalid season');

    // 4. Upsert season with inlined arrays
    const { error: seasonError } = await tryCatch(
        queryUpsertSeason(season, false, {
            introOrder: fetchedData.introduction_order,
            pointsMax: fetchedData.points_max,
        }),
    );
    if (seasonError) {
        throw new Error(seasonError?.message || 'Failed to upsert season');
    }

    // 5. For each historical snapshot frame, bucket-upsert into h1_status per faction.
    // The snapshot `data` field is a stringified JSON array indexed by enemy.
    // When protectedBucket is set, skip snapshots in or after the live bucket —
    // updateStatus() owns that window and has already written fresher data.
    const protectedBucket = opts.protectedBucket;
    for (const snap of fetchedData.snapshots) {
        if (protectedBucket !== undefined && computeBucket(snap.time) >= protectedBucket)
            continue;

        const parsed = typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data;
        if (!Array.isArray(parsed) || parsed.length !== 3) continue;

        for (let enemy = 0; enemy < 3; enemy++) {
            const faction = parsed[enemy];
            if (!faction) continue;

            const campaign = {
                points: faction.points,
                points_taken: faction.points_taken,
                status: faction.status,
            };
            const { error: statusError } = await tryCatch(
                queryUpsertStatus(season, enemy, snap.time, campaign),
            );
            if (statusError) {
                console.error(
                    `Status upsert failed for season=${season} enemy=${enemy} time=${snap.time}:`,
                    statusError.message,
                );
            }
        }
    }

    // 6. Upsert events (h1_event unchanged — same structure, different source)
    for (const event of fetchedData.defend_events) {
        const { error } = await tryCatch(
            queryUpsertEvent(season, EVENT_TYPE.DEFEND, event),
        );
        if (error) throw new Error(error?.message || 'defend event upsert failed');
    }
    for (const event of fetchedData.attack_events) {
        const { error } = await tryCatch(
            queryUpsertEvent(season, EVENT_TYPE.ATTACK, { ...event, region: 11 }),
        );
        if (error) throw new Error(error?.message || 'attack event upsert failed');
    }

    // 7. Confirm season (sets last_updated = now)
    const { data: confirmSeason, error: confirmError } = await tryCatch(
        queryUpsertSeason(season, true),
    );
    if (confirmError) {
        throw new Error(confirmError?.message || 'Failed to confirm season');
    }

    const time =
        fetchedData?.time ??
        fetchedData?.snapshots?.[fetchedData.snapshots.length - 1]?.time ??
        null;
    return { ms: performanceTime(start), season, time, confirmSeason };
}
