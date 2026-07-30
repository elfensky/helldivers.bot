/**
 * waveForecast — pure lookup from the live payload into the committed
 * next-wave model (waveModel.mjs, emitted by scripts/analysis/08).
 *
 * Total function: every failure path returns { mode: 'hidden', reason }
 * rather than throwing, so the dashboard degrades to exactly its old UI.
 */
import defaultModel from '@/features/dashboard/waveModel.mjs';
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';

const CHAIN_SECONDS = 600;
const SECTOR_COUNT = 10; // mirrors SECTOR_COUNT in scripts/analysis/lib/dataset.mjs (client code cannot import from scripts/)
export const IMMINENT_THRESHOLD = 0.51;

/**
 * Train-start derivation — the same rule as the #472 analysis
 * (scripts/analysis/lib/dataset.mjs): a defend starts a new train iff no
 * SAME-FACTION defend ended within CHAIN_SECONDS before it starts.
 *
 * @param {{enemy: number, start_time: number, end_time: number}[]} defends season defend events, any order
 * @returns {{enemy: number, start_time: number, end_time: number}[]} train
 *   starts, ascending by start_time
 */
export function deriveTrainStarts(defends) {
    const byEnemy = new Map();
    for (const d of [...defends].sort((a, b) => a.start_time - b.start_time)) {
        if (!byEnemy.has(d.enemy)) byEnemy.set(d.enemy, []);
        byEnemy.get(d.enemy).push(d);
    }
    const starts = [];
    for (const list of byEnemy.values()) {
        for (let i = 0; i < list.length; i++) {
            const prev = i > 0 ? list[i - 1] : null;
            if (prev === null || list[i].start_time - prev.end_time > CHAIN_SECONDS) {
                starts.push(list[i]);
            }
        }
    }
    return starts.sort((a, b) => a.start_time - b.start_time);
}

/**
 * @param {object} model candidate wave model
 * @returns {boolean} true when it has 168-row tables for all four states
 */
function isValidModel(model) {
    const states = model?.states;
    return ['NORMAL', 'SC9', 'SC10', 'ATTACK'].every(
        (s) => Array.isArray(states?.[s]) && states[s].length === 168,
    );
}

/**
 * The card's forecast for "now", from the live payload alone.
 *
 * @param {{events: object[], status: object[]} | null} data live payload `data`
 * @param {number} nowSeconds unix seconds
 * @param {object} [model] injectable for tests; defaults to the committed model
 * @returns {{mode: 'window', p25: number, p50: number, p75: number,
 *   p24: number, p48: number, state: string, imminent: boolean,
 *   runningLong: boolean, lastTrainStart: number}
 *   | {mode: 'hidden', reason: 'wave-active'|'no-train-yet'|'no-data'}}
 */
export function waveForecast(data, nowSeconds, model = defaultModel) {
    if (
        !data ||
        !Array.isArray(data.events) ||
        !Array.isArray(data.status) ||
        !model ||
        !isValidModel(model)
    ) {
        return { mode: 'hidden', reason: 'no-data' };
    }

    const defends = data.events.filter((e) => e.type === EVENT_TYPE.DEFEND);
    if (defends.some((e) => e.status === EVENT_STATUS.ACTIVE)) {
        return { mode: 'hidden', reason: 'wave-active' };
    }

    const starts = deriveTrainStarts(defends);
    const last = starts.at(-1);
    if (!last) return { mode: 'hidden', reason: 'no-train-yet' };

    const attackActive = data.events.some(
        (e) => e.type === EVENT_TYPE.ATTACK && e.status === EVENT_STATUS.ACTIVE,
    );
    const scs = data.status
        .filter((r) => r.points_max > 0)
        .map((r) => Math.trunc(r.points / (r.points_max / SECTOR_COUNT)));
    const maxSC = scs.length > 0 ? Math.max(...scs) : null;
    const state =
        attackActive ? 'ATTACK'
        : maxSC === 9 ? 'SC9'
        : maxSC === 10 ? 'SC10'
        : 'NORMAL';

    const elapsedHours = Math.max(0, (nowSeconds - last.start_time) / 3600);
    const bin = Math.min(167, Math.floor(elapsedHours));
    const row = model.states[state][bin];

    return {
        mode: 'window',
        p25: row.p25,
        p50: row.p50,
        p75: row.p75,
        p24: row.p24,
        p48: row.p48,
        state,
        imminent: row.p24 >= IMMINENT_THRESHOLD,
        runningLong: state === 'SC9',
        lastTrainStart: last.start_time,
    };
}
