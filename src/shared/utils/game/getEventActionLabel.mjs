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
export function getEventActionLabel(event) {
    if (event?.type === 'attack') {
        if (event.status === 'active') return 'Attacking';
        if (event.status === 'success') return 'Captured';
        if (event.status === 'fail') return 'Lost';
    }
    if (event?.type === 'defend') {
        if (event.status === 'active') return 'Defending';
        if (event.status === 'success') return 'Defended';
        if (event.status === 'fail') return 'Lost';
    }
    return '';
}
