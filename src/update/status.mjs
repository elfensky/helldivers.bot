'use server';
import { tryCatch } from '@/utils/tryCatch.mjs';
import { performanceTime } from '@/utils/time';
import { getSeasonFromStatus } from '@/utils/getSeason';
import { fetchStatus } from '@/update/fetch.mjs';
import { isValidStatus } from '@/validators/isValidStatus';
import map from '@/enums/map';
//db
import { queryUpsertRebroadcastStatus } from '@/db/queries/rebroadcast';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertEvent } from '@/db/queries/upsertEvent';
import { queryUpsertLive } from '@/db/queries/upsertLive';
import { queryUpsertIntroductionOrder } from '@/db/queries/upsertIntroductionOrder';
import { queryUpsertPointsMax } from '@/db/queries/upsertPointsMax';
import { queryCreateLiveSnapshots } from '@/db/queries/createLiveSnapshots';
import { queryCreateEventSnapshot } from '@/db/queries/createEventSnapshots';
import {
    shouldTakeLiveSnapshot,
    recordLiveSnapshotTime,
    shouldTakeEventSnapshot,
    recordEventSnapshotTime,
} from '@/update/snapshotTimers';

function computeFactionMap(enemy, campaign, defendEvent, attackEvents, season) {
    const factionMap = JSON.parse(JSON.stringify(map[enemy]));

    const totalPoints = campaign.points_max > 0 ? campaign.points_max : 1;
    for (const regionKey of Object.keys(factionMap)) {
        const region = factionMap[regionKey];
        region.status = campaign.status;
        if (parseInt(regionKey) === 11) {
            region.points = campaign.points;
            region.points_max = campaign.points_max;
            region.percent = Math.round((campaign.points_taken / totalPoints) * 100);
        }
    }

    if (defendEvent && defendEvent.enemy === enemy && defendEvent.season === season) {
        const region = factionMap[defendEvent.region];
        if (region) {
            region.event = 'defend';
        }
    }

    if (attackEvents) {
        for (const event of attackEvents) {
            if (
                event.season === season &&
                event.enemy === enemy &&
                event.status === 'active'
            ) {
                if (factionMap[11]) {
                    factionMap[11].event = 'attack';
                }
            }
        }
    }

    return factionMap;
}

export async function updateStatus() {
    const start = performance.now();

    //1. fetch
    const { data: fetchedData, error: fetchedError } = await tryCatch(fetchStatus());
    if (fetchedError) {
        throw new Error(fetchedError?.message || 'Failed to fetch status from the API', {
            cause: 'update/status.mjs | tryCatch(fetchStatus())',
        });
    }

    //2. validate
    const check = isValidStatus(fetchedData);
    if (!check.success) {
        console.error(check.error);
        throw new Error(check?.error?.message || 'Invalid status data', {
            cause: 'update/status.mjs | isValidStatus(fetchedData)',
        });
    }

    //3. get season
    const season = getSeasonFromStatus(fetchedData);

    //4. store raw rebroadcast
    const { error: storedRebroadcastError } = await tryCatch(
        queryUpsertRebroadcastStatus(season, fetchedData),
    );
    if (storedRebroadcastError) {
        throw new Error(
            storedRebroadcastError?.message || 'Failed to store rebroadcast status',
            { cause: 'update/status.mjs | queryUpsertRebroadcastStatus()' },
        );
    }

    //5. upsert season
    const { error: newSeasonError } = await tryCatch(queryUpsertSeason(season, false));
    if (newSeasonError) {
        throw new Error(newSeasonError?.message || 'Failed to upsert season');
    }

    //6. upsert events
    // Defend event (guard for null — API omits when no defend active)
    if (fetchedData.defend_event) {
        const { error: defendError } = await tryCatch(
            queryUpsertEvent(season, 'defend', fetchedData.defend_event),
        );
        if (defendError) {
            throw new Error(defendError?.message || 'Failed to upsert defend event');
        }
    }

    // Attack events
    for (const event of fetchedData.attack_events) {
        const { error: attackError } = await tryCatch(
            queryUpsertEvent(season, 'attack', { ...event, region: 11 }),
        );
        if (attackError) {
            throw new Error(attackError?.message || 'Failed to upsert attack event');
        }
    }

    //6.5 capture event snapshots (10-min throttle)
    // Defend event snapshot
    if (fetchedData.defend_event && fetchedData.defend_event.season === season) {
        const de = fetchedData.defend_event;
        // Snapshot if active OR if terminal (captures the final state)
        if (de.status === 'active' || de.status === 'success' || de.status === 'fail') {
            const { data: shouldSnapshot, error: timerError } = await tryCatch(
                shouldTakeEventSnapshot('defend', de.event_id, fetchedData.time),
            );
            if (timerError) {
                console.error('Event snapshot timer error:', timerError.message);
            } else if (shouldSnapshot) {
                const { error: snapError } = await tryCatch(
                    queryCreateEventSnapshot(season, 'defend', de, fetchedData.time),
                );
                if (snapError) {
                    console.error('Defend event snapshot error:', snapError.message);
                } else {
                    recordEventSnapshotTime('defend', de.event_id, fetchedData.time);
                }
            }
        }
    }

    // Attack event snapshots
    for (const event of fetchedData.attack_events) {
        if (event.season !== season) continue;
        if (
            event.status === 'active' ||
            event.status === 'success' ||
            event.status === 'fail'
        ) {
            const { data: shouldSnapshot, error: timerError } = await tryCatch(
                shouldTakeEventSnapshot('attack', event.event_id, fetchedData.time),
            );
            if (timerError) {
                console.error('Event snapshot timer error:', timerError.message);
            } else if (shouldSnapshot) {
                const { error: snapError } = await tryCatch(
                    queryCreateEventSnapshot(
                        season,
                        'attack',
                        { ...event, region: 11 },
                        fetchedData.time,
                    ),
                );
                if (snapError) {
                    console.error('Attack event snapshot error:', snapError.message);
                } else {
                    recordEventSnapshotTime('attack', event.event_id, fetchedData.time);
                }
            }
        }
    }

    //7. derive introduction_order and points_max from campaign_status
    const introOrder = fetchedData.campaign_status.map((c) => c.introduction_order);
    const pointsMax = fetchedData.campaign_status.map((c) => c.points_max);

    const { error: introError } = await tryCatch(
        queryUpsertIntroductionOrder(season, introOrder),
    );
    if (introError) {
        throw new Error(introError?.message || 'Failed to upsert introduction_order');
    }

    const { error: pointsError } = await tryCatch(
        queryUpsertPointsMax(season, pointsMax),
    );
    if (pointsError) {
        throw new Error(pointsError?.message || 'Failed to upsert points_max');
    }

    //8. upsert h1_live (one row per faction)
    for (let enemy = 0; enemy < 3; enemy++) {
        const campaign = fetchedData.campaign_status[enemy];
        const stats = fetchedData.statistics[enemy];
        const factionMap = computeFactionMap(
            enemy,
            campaign,
            fetchedData.defend_event,
            fetchedData.attack_events,
            season,
        );

        const { error: liveError } = await tryCatch(
            queryUpsertLive(season, enemy, campaign, stats, factionMap),
        );
        if (liveError) {
            throw new Error(liveError?.message || 'Failed to upsert h1_live');
        }
    }

    //8.5 capture live statistic snapshots (15-min throttle)
    const { data: shouldSnapshot, error: liveTimerError } = await tryCatch(
        shouldTakeLiveSnapshot(season, fetchedData.time),
    );
    if (liveTimerError) {
        console.error('Live snapshot timer error:', liveTimerError.message);
    } else if (shouldSnapshot) {
        const { error: liveSnapError } = await tryCatch(
            queryCreateLiveSnapshots(season, fetchedData.time, fetchedData.statistics),
        );
        if (liveSnapError) {
            console.error('Live snapshot error:', liveSnapError.message);
        } else {
            recordLiveSnapshotTime(fetchedData.time);
        }
    }

    //9. confirm season update
    const { data: confirmSeason, error: confirmSeasonError } = await tryCatch(
        queryUpsertSeason(season, true),
    );
    if (confirmSeasonError) {
        throw new Error(confirmSeasonError?.message || 'Failed to update last_updated');
    }

    return {
        ms: performanceTime(start),
        season: season,
        confirmSeason,
    };
}
