import { EVENT_STATUS } from '@/shared/enums/events.mjs';

const HOUR = 3600;

/**
 * Anti-flicker slack on the on-track/behind verdict. Measured by
 * scripts/analysis/14-event-verdict-margin.mjs on h1_event_progress replays
 * (S157+, 125 events / 2551 moments); replace with the script's recommendation if it differs.
 */
export const VERDICT_MARGIN = 0.2;

/**
 * Completion verdict for an ACTIVE event: at the average pace since the event
 * started, does the bar fill before the deadline? Median-only by design — the
 * event-progress history (S157+) is too thin to calibrate a range honestly
 * (see the spec). Total function: every failure path returns {mode:'hidden'}.
 *
 * @param {{status:string, start_time:number, end_time:number, points:number,
 *   points_max:number}|null} event
 * @param {number} nowSeconds unix seconds
 * @returns {{mode:'verdict', etaHours:number|null, onTrack:boolean, stalled:boolean}
 *   | {mode:'hidden', reason:'no-event'|'no-data'|'complete'|'expired'}}
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

    const ratePerSecond = Number(event.points) / elapsed;
    if (!(ratePerSecond > 0)) {
        return { mode: 'verdict', etaHours: null, onTrack: false, stalled: true };
    }
    const etaHours = remaining / ratePerSecond / HOUR;
    const remainingHours = (event.end_time - nowSeconds) / HOUR;
    return {
        mode: 'verdict',
        etaHours,
        onTrack: etaHours <= remainingHours * (1 + VERDICT_MARGIN),
        stalled: false,
    };
}
