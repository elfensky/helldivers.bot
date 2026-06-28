import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import {
    PHRASES,
    pickVariant,
    PHRASE_KEY,
} from '@/features/archives/narrativePhrasing.mjs';

/**
 * One "war by the numbers" beat from the season telemetry totals, anchored at
 * `lastTime` (the last event) so the orchestrator can order it just before the
 * closing outcome beat. Returns `null` for telemetry-less seasons.
 *
 * @param {{ kills:number, missions:number, accidentals:number } | null} telemetry season telemetry totals
 * @param {number} lastTime last event timestamp for anchoring
 * @param {number} day season day number
 * @param {number} season season number for phrase variant selection
 * @returns {{ time:number, day:number, kind:'numbers', text:string } | null} beat object or null if no telemetry
 */
export function buildNumbersBeat(telemetry, lastTime, day, season) {
    if (!telemetry) return null;
    const text = pickVariant(PHRASES.numbers, season, PHRASE_KEY.numbers)(
        formatNumber(telemetry.kills),
        formatNumber(telemetry.missions),
        formatNumber(telemetry.accidentals),
    );
    return { time: lastTime, day, kind: 'numbers', text };
}
