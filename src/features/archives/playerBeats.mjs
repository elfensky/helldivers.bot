import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { PHRASES, pickVariant } from '@/features/archives/narrativePhrasing.mjs';

const SURGE_FACTOR = 1.4; // a peak ≥ 1.4× baseline is a "rally"
const COLLAPSE_FACTOR = 0.6; // a trough ≤ 0.6× baseline is "the front grows quiet"

function median(nums) {
    if (nums.length === 0) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Player surge/collapse beats from the per-bucket player timeseries. The single
 * most extreme surge and the single most extreme collapse (past the opening
 * ramp) are emitted when they clear their thresholds — at most 2 beats.
 *
 * @param {Array<{ time:number, day:number, total:number }>} playerTimeseries - per-bucket player count samples
 * @param {number} season - phrasing seed
 * @returns {Array<{ time:number, day:number, kind:'surge'|'collapse', text:string }>}
 */
export function buildPlayerBeats(playerTimeseries, season) {
    const series = playerTimeseries ?? [];
    if (series.length < 2) return [];

    const baseline = median(series.map((p) => p.total));
    if (baseline <= 0) return [];

    const beats = [];

    // Surge: global max, anywhere.
    const peak = series.reduce((a, b) => (b.total > a.total ? b : a));
    if (peak.total >= SURGE_FACTOR * baseline) {
        beats.push({
            time: peak.time,
            day: peak.day,
            kind: 'surge',
            text: pickVariant(
                PHRASES.surge,
                season,
                peak.time | 0,
            )(formatNumber(peak.total)),
        });
    }

    // Collapse: global min, skipping the first (opening-ramp) bucket.
    const tail = series.slice(1);
    const trough = tail.reduce((a, b) => (b.total < a.total ? b : a));
    if (trough.total <= COLLAPSE_FACTOR * baseline) {
        beats.push({
            time: trough.time,
            day: trough.day,
            kind: 'collapse',
            text: pickVariant(
                PHRASES.collapse,
                season,
                trough.time | 0,
            )(formatNumber(trough.total)),
        });
    }

    return beats;
}
