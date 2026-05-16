import map from '@/shared/enums/map.mjs';
import { EVENT_TYPE } from '@/shared/enums/events.mjs';

/**
 * Resolve a human-readable region label from an event.
 *
 * Super Earth defend events use region=0 with the attacker as `enemy`. They
 * must resolve to map[3][0] regardless of enemy, and return the capital
 * ("Super Earth") rather than the system name ("Sol System") because the
 * former is what players recognize from the game.
 */
export function getEventRegionLabel(event) {
    if (event?.type === EVENT_TYPE.DEFEND && event?.region === 0) {
        return map[3][0].capital;
    }
    return map[event?.enemy]?.[event?.region]?.region ?? 'Unknown Region';
}
