import { eventForecast } from '@/features/dashboard/eventForecast.mjs';
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';

// Every fail-resolved homeworld assault in history ran exactly 48.0h
// (544/544) and its counterattack train started within minutes of the
// timeout (scripts/analysis/14-counterattack-delta.mjs, #480). The
// counteroffensive is therefore a deterministic clock conditional only on
// the assault failing — which is a player-progress question, not a
// statistical one, and lives here, standalone from the free-wave band
// (waveForecast.mjs). See /docs/predict/defend, rules 7-8.
export const ASSAULT_TIMEOUT_SECONDS = 48 * 3600;

/**
 * Counteroffensive forecast: WHEN the counterattack lands if the active
 * assault fails (earliest assault start + 48h), qualified by the shipped
 * pace verdict on that assault (eventForecast — on track to fill the bar
 * before the timeout means the assault succeeds and no counterattack
 * comes). Pace projection wording only; the verdict-to-outcome link is
 * deliberately not quantified (n=7 progress-tracked assaults, #487).
 *
 * Hidden while a defend is running, mirroring the card's existing
 * behavior — and honestly so: a counterattack queued behind an occupied
 * defend slot fires late (measured in 14-counterattack-delta.mjs).
 *
 * Total function: every failure path returns { mode: 'hidden', reason }.
 *
 * @param {{events: object[]} | null} data live payload `data`
 * @param {number} nowSeconds unix seconds
 * @returns {{mode: 'clock', at: number, assaultStart: number,
 *   pace: 'on_track'|'behind'|'stalled'|null}
 *   | {mode: 'hidden', reason: 'no-data'|'no-assault'|'wave-active'}}
 */
export function counterattackForecast(data, nowSeconds) {
    if (!data || !Array.isArray(data.events)) {
        return { mode: 'hidden', reason: 'no-data' };
    }
    if (
        data.events.some(
            (e) => e.type === EVENT_TYPE.DEFEND && e.status === EVENT_STATUS.ACTIVE,
        )
    ) {
        return { mode: 'hidden', reason: 'wave-active' };
    }
    const active = data.events.filter(
        (e) => e.type === EVENT_TYPE.ATTACK && e.status === EVENT_STATUS.ACTIVE,
    );
    if (active.length === 0) return { mode: 'hidden', reason: 'no-assault' };

    // Several concurrent assaults: the earliest one resolves (and, on a
    // fail, counterattacks) first.
    const earliest = active.reduce((a, b) => (a.start_time <= b.start_time ? a : b));
    const verdict = eventForecast(earliest, nowSeconds);
    const pace =
        verdict.mode === 'verdict' ?
            verdict.stalled ? 'stalled'
            : verdict.onTrack ? 'on_track'
            : 'behind'
        :   null; // too early / no usable pace yet — clock still stands
    return {
        mode: 'clock',
        at: earliest.start_time + ASSAULT_TIMEOUT_SECONDS,
        assaultStart: earliest.start_time,
        pace,
    };
}
