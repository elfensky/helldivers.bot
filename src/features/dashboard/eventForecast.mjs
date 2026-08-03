import { EVENT_STATUS } from '@/shared/enums/events.mjs';

const HOUR = 3600;

/**
 * Anti-flicker slack on the on-track/behind verdict. Measured by
 * scripts/analysis/14-event-verdict-margin.mjs on h1_event_progress replays
 * (S157+, 130 events / 2193 moments); replace with the script's recommendation
 * if it differs.
 *
 * Zero is not "unset" — it is the measured answer. Once `MIN_ELAPSED_FRACTION`
 * drops the noisy opening quarter, slack costs accuracy (91.6% at 0 falling to
 * 86.5% at 0.3) and buys no stability (flip p90 0.1 at 0, 1.0 everywhere else).
 * The earlier 0.2 was calibrated against a replay that measured won events
 * against their own early end_time — see the script's header.
 */
export const VERDICT_MARGIN = 0;

/**
 * Below this share of the event elapsed, the average-pace rate is still
 * dominated by the opening minutes and the verdict flips on noise: ~73%
 * accurate in the first quarter against ~92% past halfway and ~99.7% in the
 * final quarter (same replay). Cards render nothing until the event clears it.
 */
export const MIN_ELAPSED_FRACTION = 0.25;

/**
 * Outcome verdict for an ACTIVE event: at the average pace since the event
 * started, does the bar fill before the deadline?
 *
 * An event resolves one of exactly two ways, and they end at different times.
 * It **fails** when the timer runs out — 3,179 of 3,260 failed defends ran
 * exactly 150 minutes, 545 of 545 failed assaults exactly 48.0h — so a loss
 * lands on `end_time`, which the card already counts down to. It **wins**
 * early, the moment points fill: 1,681 of 1,833 won defends finished under the
 * timer, won assaults at a median 37h. So `etaHours` is only news when
 * `onTrack` — it is the win time, and it is sooner than the countdown.
 *
 * Median-only by design — the event-progress history (S157+) is too thin to
 * calibrate a range honestly (see the spec). Total function: every failure
 * path returns {mode:'hidden'}.
 *
 * @param {{status:string, start_time:number, end_time:number, points:number,
 *   points_max:number}|null} event
 * @param {number} nowSeconds unix seconds
 * @returns {{mode:'verdict', etaHours:number|null, remainingHours:number,
 *     onTrack:boolean, stalled:boolean}
 *   | {mode:'hidden', reason:'no-event'|'no-data'|'complete'|'expired'|'too-early'}}
 */
export function eventForecast(event, nowSeconds) {
    if (!event || event.status !== EVENT_STATUS.ACTIVE) {
        return { mode: 'hidden', reason: 'no-event' };
    }
    const remaining = Number(event.points_max) - Number(event.points);
    if (remaining <= 0) return { mode: 'hidden', reason: 'complete' };
    if (event.end_time <= nowSeconds) return { mode: 'hidden', reason: 'expired' };
    const elapsed = nowSeconds - event.start_time;
    if (elapsed <= 0) return { mode: 'hidden', reason: 'no-data' };

    // `end_time` is the deadline while the event is live, so this is the share
    // of the full timer that has run — the same clock the replay gated on.
    const duration = event.end_time - event.start_time;
    if (!(duration > 0)) return { mode: 'hidden', reason: 'no-data' };
    if (elapsed / duration < MIN_ELAPSED_FRACTION) {
        return { mode: 'hidden', reason: 'too-early' };
    }

    const remainingHours = (event.end_time - nowSeconds) / HOUR;
    const ratePerSecond = Number(event.points) / elapsed;
    if (!(ratePerSecond > 0)) {
        return {
            mode: 'verdict',
            etaHours: null,
            remainingHours,
            onTrack: false,
            stalled: true,
        };
    }
    const etaHours = remaining / ratePerSecond / HOUR;
    return {
        mode: 'verdict',
        etaHours,
        remainingHours,
        onTrack: etaHours <= remainingHours * (1 + VERDICT_MARGIN),
        stalled: false,
    };
}
