import { SECTOR_COUNT, HOMEWORLD_REGION } from '@/shared/enums/worlds.mjs';

/**
 * Count captured regions for a single faction from a computeMapState slice.
 *
 * Iterates regions 1..11 (sectors 1-10 + homeworld) and buckets each one by
 * status. Used by the 11-segment Campaign Bar on EventCard/DefeatedCard for
 * the "N/11" chip and for aria-valuenow.
 *
 * @param {Object} factionMap - mapState[factionIndex]: { [region]: { status, percent } }
 * @returns {{ captured: number, inProgressRegion: number | null, total: number }}
 */
export function countCapturedRegions(factionMap) {
    if (!factionMap) return { captured: 0, inProgressRegion: null, total: 11 };

    let captured = 0;
    let inProgressRegion = null;

    for (let region = 1; region <= SECTOR_COUNT; region++) {
        const status = factionMap[region]?.status;
        if (status === 'captured') captured++;
        else if (status === 'in_progress') inProgressRegion = region;
    }

    const homeworld = factionMap[HOMEWORLD_REGION]?.status;
    if (homeworld === 'captured') captured++;
    else if (homeworld === 'active') inProgressRegion = HOMEWORLD_REGION;

    return { captured, inProgressRegion, total: SECTOR_COUNT + 1 };
}
