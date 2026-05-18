/**
 * Map an event's type + status to a game-meaningful action verb.
 *
 * - attack/active  → "Attacking"   (we're trying to capture)
 * - attack/success → "Captured"    (we took the sector)
 * - attack/fail    → "Lost"        (we failed to capture)
 * - defend/active  → "Defending"   (we're holding off an attack)
 * - defend/success → "Defended"    (we held the sector)
 * - defend/fail    → "Lost"        (we lost the sector)
 *
 * Returns '' for unknown combinations so template rendering stays safe.
 */
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';

export function getEventActionLabel(event) {
    if (event?.type === EVENT_TYPE.ATTACK) {
        if (event.status === EVENT_STATUS.ACTIVE) return 'Attacking';
        if (event.status === EVENT_STATUS.SUCCESS) return 'Captured';
        if (event.status === EVENT_STATUS.FAIL) return 'Lost';
    }
    if (event?.type === EVENT_TYPE.DEFEND) {
        if (event.status === EVENT_STATUS.ACTIVE) return 'Defending';
        if (event.status === EVENT_STATUS.SUCCESS) return 'Defended';
        if (event.status === EVENT_STATUS.FAIL) return 'Lost';
    }
    return '';
}
