import mapTemplate from '@/enums/map';

/**
 * Compute map state from faction data and events at a point in time.
 * Returns a NEW map object — never mutates the template.
 *
 * @param {Array} factionStates - Array of 3 objects: { enemy, points, points_taken, points_max, status }
 * @param {Array} events - Pre-filtered events active at this point in time (caller handles timestamp filtering)
 * @returns {Object} Deep clone of map template with computed state
 */
export function computeMapState(factionStates, events = []) {
    const map = JSON.parse(JSON.stringify(mapTemplate));

    // Process campaigns
    for (const campaign of factionStates) {
        const faction = campaign.enemy;
        const sectorCount = 10;
        const pointsMax = campaign.points_max > 0 ? campaign.points_max : 1;
        const points = campaign.points;
        const pointsPerSector = pointsMax / sectorCount;
        const sectorsEarned = Math.trunc(points / pointsPerSector);
        const sectorsInProgress = sectorsEarned + 1;

        if (campaign.status === 'active') {
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
        } else if (campaign.status === 'defeated') {
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

    // Process defend events
    const defendEvents = events.filter((e) => e.type === 'defend');
    for (const event of defendEvents) {
        if (event.region === 0) {
            if (event.status === 'active') {
                map[3][0].event = 'active';
                map[3][0].status = 'active';
            }
        } else if (event.region !== undefined && event.region !== null) {
            map[event.enemy][event.region].event =
                event.status === 'active' ? 'active' : 'idle';
        }
    }

    // Process attack events
    const attackEvents = events.filter((e) => e.type === 'attack');
    for (const event of attackEvents) {
        if (event.status === 'active') {
            map[event.enemy][11].percent = (event.points / event.points_max) * 100;
            map[event.enemy][11].points = event.points;
            map[event.enemy][11].points_max = event.points_max;
            map[event.enemy][11].status = 'active';
            map[event.enemy][11].event = 'active';
        } else if (event.status === 'success') {
            map[event.enemy][11].percent = (event.points / event.points_max) * 100;
            map[event.enemy][11].points = event.points;
            map[event.enemy][11].points_max = event.points_max;
            map[event.enemy][11].status = 'captured';
            map[event.enemy][11].event = 'idle';
        }
    }

    return map;
}
