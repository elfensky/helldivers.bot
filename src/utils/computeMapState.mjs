import mapTemplate from '@/enums/map';
import { EVENT_TYPE, EVENT_STATUS, CAMPAIGN_STATUS } from '@/enums/events';
import { SECTOR_COUNT } from '@/enums/worlds.mjs';

/**
 * Compute map state from faction data and events at a point in time.
 * Returns a NEW map object — never mutates the template.
 *
 * Sectors 1-10 are determined by campaign score (points / points_max).
 * Region 11 (homeworld) is only affected by attack events.
 *
 * IMPORTANT: For live views, only pass events with status === 'active'.
 * Completed events (success/fail) are already reflected in campaign scores.
 * Passing completed defend events will incorrectly overwrite score-based
 * sector ownership. The timeline component handles its own time-based
 * event filtering and may pass completed events for historical accuracy.
 *
 * @param {Array} factionStates - Array of 3 objects: { enemy, points, points_taken, points_max, status }
 * @param {Array} events - Pre-filtered events (caller handles filtering — see note above)
 * @returns {Object} Deep clone of map template with computed state
 */
export function computeMapState(factionStates, events = []) {
    const map = JSON.parse(JSON.stringify(mapTemplate));

    // Process campaigns
    for (const campaign of factionStates) {
        const faction = campaign.enemy;
        const pointsMax = campaign.points_max > 0 ? campaign.points_max : 1;
        const points = campaign.points;
        const pointsPerSector = pointsMax / SECTOR_COUNT;
        const sectorsEarned = Math.trunc(points / pointsPerSector);
        const sectorsInProgress = sectorsEarned + 1;

        if (campaign.status === CAMPAIGN_STATUS.ACTIVE) {
            for (const regionKey of Object.keys(map[faction])) {
                const region = parseInt(regionKey);
                const totalPointsForSector = region * pointsPerSector;

                if (region === 11) {
                    // Homeworld — default to lost, overwritten by attack events below
                    map[faction][region].status = 'lost';
                    map[faction][region].percent = 0;
                } else if (region === sectorsInProgress) {
                    const remainingPoints =
                        points - (totalPointsForSector - pointsPerSector);
                    map[faction][region].status = 'in_progress';
                    map[faction][region].points = points;
                    map[faction][region].points_max = totalPointsForSector;
                    map[faction][region].points_sector = remainingPoints;
                    map[faction][region].points_sector_max = pointsPerSector;
                    map[faction][region].percent =
                        (remainingPoints / pointsPerSector) * 100;
                } else if (region <= sectorsEarned) {
                    map[faction][region].status = 'captured';
                    map[faction][region].points = totalPointsForSector;
                    map[faction][region].points_max = totalPointsForSector;
                    map[faction][region].points_sector = pointsPerSector;
                    map[faction][region].points_sector_max = pointsPerSector;
                    map[faction][region].percent = 100;
                } else {
                    map[faction][region].status = 'lost';
                    map[faction][region].points = points;
                    map[faction][region].points_max = totalPointsForSector;
                    map[faction][region].points_sector = 0;
                    map[faction][region].points_sector_max = pointsPerSector;
                    map[faction][region].percent = 0;
                }
            }
        } else if (campaign.status === CAMPAIGN_STATUS.DEFEATED) {
            for (const regionKey of Object.keys(map[faction])) {
                map[faction][regionKey].status = 'captured';
                map[faction][regionKey].percent = 100;
            }
        } else {
            // hidden or other — all lost
            for (const regionKey of Object.keys(map[faction])) {
                map[faction][regionKey].status = 'lost';
                map[faction][regionKey].percent = 0;
            }
        }
    }

    // Process defend events (sorted by end_time so most recent outcome wins)
    const defendEvents = events
        .filter((e) => e.type === EVENT_TYPE.DEFEND)
        .sort((a, b) => a.end_time - b.end_time);
    for (const event of defendEvents) {
        if (event.region === 0) {
            if (event.status === EVENT_STATUS.ACTIVE) {
                map[3][0].event = EVENT_STATUS.ACTIVE;
                map[3][0].status = EVENT_STATUS.ACTIVE;
            }
        } else if (event.region !== undefined && event.region !== null) {
            if (event.status === EVENT_STATUS.ACTIVE) {
                map[event.enemy][event.region].event = EVENT_STATUS.ACTIVE;
            } else if (event.status === EVENT_STATUS.FAIL) {
                // Failed defend: sector and all beyond it revert to lost
                for (let r = event.region; r <= 10; r++) {
                    if (map[event.enemy][r]) {
                        map[event.enemy][r].status = 'lost';
                        map[event.enemy][r].event = 'idle';
                        map[event.enemy][r].percent = 0;
                    }
                }
            } else {
                map[event.enemy][event.region].event = 'idle';
            }
        }
    }

    // Process attack events (sorted by end_time so most recent outcome wins)
    const attackEvents = events
        .filter((e) => e.type === EVENT_TYPE.ATTACK)
        .sort((a, b) => a.end_time - b.end_time);
    for (const event of attackEvents) {
        if (event.status === EVENT_STATUS.ACTIVE) {
            map[event.enemy][11].percent = (event.points / event.points_max) * 100;
            map[event.enemy][11].points = event.points;
            map[event.enemy][11].points_max = event.points_max;
            map[event.enemy][11].status = EVENT_STATUS.ACTIVE;
            map[event.enemy][11].event = EVENT_STATUS.ACTIVE;
        } else if (event.status === EVENT_STATUS.SUCCESS) {
            map[event.enemy][11].percent = (event.points / event.points_max) * 100;
            map[event.enemy][11].points = event.points;
            map[event.enemy][11].points_max = event.points_max;
            map[event.enemy][11].status = 'captured';
            map[event.enemy][11].event = 'idle';
        } else if (event.status === EVENT_STATUS.FAIL) {
            map[event.enemy][11].status = 'lost';
            map[event.enemy][11].event = 'idle';
        }
    }

    return map;
}
