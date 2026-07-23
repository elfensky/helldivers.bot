/**
 * The war calendar — single home for war-start-relative time math.
 *
 * Two counting conventions coexist ON PURPOSE and must not be merged:
 *  - `dayOf`      — 1-based, floored, clamped ≥ 1. For human-facing day labels
 *                   (narrative beats, event-log markers, baked timeseries days).
 *  - `dayFraction`— 0-based, fractional. For chart x-axes, where intra-day
 *                   samples must stay distinct and the axis time-proportional.
 * Both share the same anchor (`war_start`, or the earliest observed time via
 * `resolveWarStart`), so a caller mixing them is off by exactly one day —
 * always pick by name, never re-derive the formula locally.
 */

export const SECONDS_PER_DAY = 86400;

/**
 * Resolve the day-1 anchor: `warStart` when known, else the earliest observed
 * time. reduce, not `Math.min(...spread)` — a large array spread as call
 * arguments can throw RangeError.
 *
 * @param {number | null | undefined} warStart - Unix-seconds war start, if known.
 * @param {Array<number | null | undefined>} times - Observed unix-seconds times.
 * @returns {number} The anchor, or Infinity when nothing is observable.
 */
export function resolveWarStart(warStart, times) {
    if (warStart != null) return warStart;
    let min = Infinity;
    for (const t of times ?? []) {
        if (t != null) {
            min = Math.min(min, t);
        }
    }
    return min;
}

/**
 * 1-based floored war day, clamped to ≥ 1. Day 1 is the first day of the war.
 *
 * @param {number} time - Unix-seconds timestamp.
 * @param {number} warStart - Unix-seconds anchor for day 1.
 * @returns {number}
 */
export function dayOf(time, warStart) {
    const day = Math.floor((time - warStart) / SECONDS_PER_DAY) + 1;
    return day < 1 ? 1 : day;
}

/**
 * 0-based fractional days since war start. Not floored — intra-day samples
 * stay distinct so chart x-axes remain time-proportional.
 *
 * @param {number} time - Unix-seconds timestamp.
 * @param {number} warStart - Unix-seconds anchor for day 0.
 * @returns {number}
 */
export function dayFraction(time, warStart) {
    return (time - warStart) / SECONDS_PER_DAY;
}

/**
 * Whole-day rounded span of the war up to `lastTime` — the shared x-domain
 * max for the archives charts.
 *
 * @param {number} warStart - Unix-seconds anchor.
 * @param {number} lastTime - Unix-seconds last data point.
 * @returns {number}
 */
export function warDaySpan(warStart, lastTime) {
    return Math.round((lastTime - warStart) / SECONDS_PER_DAY);
}
