/**
 * Compute per-event animation delay offsets so that simultaneous events
 * pulse out of phase with each other, while all UI elements for the
 * same event stay in lockstep.
 *
 * Returns a Map of `"enemy-region"` → negative delay in seconds.
 * Components apply this as `--pulse-delay` on animated elements.
 *
 * @param {Array} events - Live events array from the API
 * @param {number} [cycleDuration=1.5] - Animation cycle length in seconds
 * @returns {Map<string, number>}
 */
export function computePulseDelays(events, cycleDuration = 1.5) {
    const active = events?.filter((e) => e.status === 'active') ?? [];
    const delays = new Map();
    for (let i = 0; i < active.length; i++) {
        const key = `${active[i].enemy}-${active[i].region}`;
        delays.set(key, -((i * cycleDuration) / active.length));
    }
    return delays;
}
