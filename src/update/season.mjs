import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';
import { getSeasonFromSnapshot } from '@/shared/utils/getSeason';
import { EVENT_TYPE } from '@/shared/enums/events';
import { fetchSeason } from '@/update/fetch';
import { isValidSeason } from '@/validators/isValidSeason';
// db
import { queryUpsertRebroadcastSeason } from '@/db/queries/rebroadcast';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertEvent } from '@/db/queries/upsertEvent';
import { queryUpsertStatus } from '@/db/queries/upsertStatus';

export async function updateSeason(season) {
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
        throw check.error;
    }

    // 3. Verify season parameter matches fetched data
    const fetchedSeason = getSeasonFromSnapshot(fetchedData);
    if (season !== fetchedSeason) throw new Error('Invalid season');

    // 4. Store raw rebroadcast cache (until cutover)
    const { error: storedRebError } = await tryCatch(
        queryUpsertRebroadcastSeason(season, fetchedData),
    );
    if (storedRebError) {
        throw new Error(
            storedRebError?.message || 'Failed to store rebroadcast snapshot',
            { cause: 'update/season.mjs | queryUpsertRebroadcastSeason()' },
        );
    }

    // 5. Upsert season with inlined arrays
    const { error: seasonError } = await tryCatch(
        queryUpsertSeason(season, false, {
            introOrder: fetchedData.introduction_order,
            pointsMax: fetchedData.points_max,
        }),
    );
    if (seasonError) {
        throw new Error(seasonError?.message || 'Failed to upsert season');
    }

    // 6. For each historical snapshot frame, bucket-upsert into h1_status per faction.
    // The snapshot `data` field is a stringified JSON array indexed by enemy.
    for (const snap of fetchedData.snapshots) {
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

    // 7. Upsert events (h1_event unchanged — same structure, different source)
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

    // 8. Confirm season (sets last_updated = now)
    const { data: confirmSeason, error: confirmError } = await tryCatch(
        queryUpsertSeason(season, true),
    );
    if (confirmError) {
        throw new Error(confirmError?.message || 'Failed to confirm season');
    }

    return { ms: performanceTime(start), season, confirmSeason };
}
