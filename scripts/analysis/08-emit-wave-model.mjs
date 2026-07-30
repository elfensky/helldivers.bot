/**
 * 08-emit-wave-model.mjs — emits the committed lookup table behind the
 * dashboard's next-wave card (src/features/dashboard/waveModel.mjs).
 *
 * Fits the attempt-3 STATE-KM estimator (07-train-state-model.mjs) on the
 * FULL history — the walk-forward gate already measured its honest skill
 * (0.648 [0.622, 0.674], calibration PASS); fitting the shipped artifact on
 * all data afterwards is standard practice. For each observable state
 * (ATTACK > SC9 > SC10 > NORMAL) x 1h elapsed bin (0..167h), the emitted row
 * is the Kaplan-Meier p25/p50/p75 of the K=200 nearest training moments by
 * elapsed, plus the KM CDF read at 24h and 48h (the card's surety numbers).
 *
 * The script REFUSES to emit unless:
 *  - every row has finite, monotone quantiles and p24 <= p48 in [0, 1];
 *  - the predicted within-24h probabilities are RELIABLE against history:
 *    bucketed into deciles, |mean(predicted) - mean(observed)| <= 0.10 per
 *    decile (n >= 100) and <= 0.05 overall (in-sample reliability; the
 *    quartile calibration underneath was walk-forward-verified in 07).
 *
 * Run from the repo root:
 *   node --env-file=.env.development scripts/analysis/08-emit-wave-model.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadDataset, HOUR, SECTOR_COUNT } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

const KNN_K = 200;
const MIN_CELL = 30;
const STEP_HOURS = 3;
const BIN_HOURS = 1;
const BINS = 168;
const STATES = ['NORMAL', 'SC9', 'SC10', 'ATTACK'];
const OUT_PATH = path.join(process.cwd(), 'src/features/dashboard/waveModel.mjs');

// --- pure helpers (duplicated from 07-train-state-model.mjs) -----------------

/**
 * @param {boolean} attackActive
 * @param {number|null} maxSC
 * @returns {'ATTACK'|'SC9'|'SC10'|'NORMAL'}
 */
function classifyState(attackActive, maxSC) {
    if (attackActive) return 'ATTACK';
    if (maxSC === 9) return 'SC9';
    if (maxSC === 10) return 'SC10';
    return 'NORMAL';
}

/**
 * @param {{elapsed: number}[]} samples sorted by elapsed asc
 * @param {number} elapsed
 * @param {number} k
 * @returns {object[]}
 */
function nearestSamples(samples, elapsed, k) {
    const n = samples.length;
    if (n === 0) return [];
    if (n <= k) return [...samples];
    let lo = 0;
    let hi = n;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].elapsed < elapsed) lo = mid + 1;
        else hi = mid;
    }
    let left = lo - 1;
    let right = lo;
    const picked = [];
    while (picked.length < k) {
        const dLeft = left >= 0 ? elapsed - samples[left].elapsed : Infinity;
        const dRight = right < n ? samples[right].elapsed - elapsed : Infinity;
        if (dLeft <= dRight) {
            picked.push(samples[left]);
            left--;
        } else {
            picked.push(samples[right]);
            right++;
        }
    }
    return picked;
}

/**
 * Kaplan-Meier CDF steps for a mixed censored/uncensored neighbourhood.
 *
 * @param {{wait: number|null, censorAt?: number|null}[]} samples non-empty
 * @returns {[number, number][]} ascending [eventTime, cdf] steps
 */
function kmCdfSteps(samples) {
    assert(samples.length > 0, 'kmCdfSteps requires samples');
    const points = samples
        .map((s) => ({
            time: s.wait !== null ? s.wait : s.censorAt,
            event: s.wait !== null,
        }))
        .sort((a, b) => a.time - b.time || (a.event ? 0 : 1) - (b.event ? 0 : 1));
    let atRisk = points.length;
    let survival = 1;
    const steps = [];
    for (const p of points) {
        if (p.event) {
            survival *= (atRisk - 1) / atRisk;
            steps.push([p.time, 1 - survival]);
        }
        atRisk--;
    }
    assert(steps.length > 0, 'kmCdfSteps requires at least one uncensored sample');
    return steps;
}

/**
 * @param {[number, number][]} steps from kmCdfSteps
 * @param {number} q in (0, 1)
 * @returns {number} smallest event time with cdf >= q, else the largest event time
 */
function kmQuantile(steps, q) {
    for (const [time, cdf] of steps) {
        if (cdf >= q) return time;
    }
    return steps[steps.length - 1][0];
}

/**
 * @param {[number, number][]} steps from kmCdfSteps
 * @param {number} horizon hours
 * @returns {number} KM CDF at the horizon (0 when no step is <= horizon)
 */
function kmCdfAt(steps, horizon) {
    let cdf = 0;
    for (const [time, c] of steps) {
        if (time <= horizon) cdf = c;
        else break;
    }
    return cdf;
}

// --- self-checks on the pure helpers (no DB) --------------------------------

{
    assert.equal(classifyState(true, 9), 'ATTACK');
    assert.equal(classifyState(false, 9), 'SC9');
    assert.equal(classifyState(false, null), 'NORMAL');

    // KM fixture: events 10 & 20, three censored at 15 -> cdf 0.2@10, 1.0@20.
    const steps = kmCdfSteps([
        { wait: 10 },
        { wait: 20 },
        { wait: null, censorAt: 15 },
        { wait: null, censorAt: 15 },
        { wait: null, censorAt: 15 },
    ]);
    assert.deepEqual(steps, [
        [10, 0.19999999999999996],
        [20, 1],
    ]);
    assert.equal(kmQuantile(steps, 0.5), 20);
    assert.equal(kmCdfAt(steps, 24), 1);
    assert.equal(kmCdfAt(steps, 12), 0.19999999999999996);
    assert.equal(kmCdfAt(steps, 5), 0);

    const knn = nearestSamples(
        [1, 2, 3, 10, 11, 12].map((e) => ({ elapsed: e })),
        2,
        3,
    );
    assert.deepEqual(
        knn.map((s) => s.elapsed).sort((a, b) => a - b),
        [1, 2, 3],
    );
}

console.log('=== 08-emit-wave-model: pure self-checks OK ===');

// --- build moment samples from the FULL history ------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const attacks = ds.events.filter((e) => e.type === 'attack');
const trainStartCount = allDefends.filter((e) => e.isTrainStart).length;

const defendsBySeason = new Map();
for (const e of allDefends) {
    if (!defendsBySeason.has(e.season)) defendsBySeason.set(e.season, []);
    defendsBySeason.get(e.season).push(e);
}
const attacksBySeason = new Map();
for (const a of attacks) {
    if (!attacksBySeason.has(a.season)) attacksBySeason.set(a.season, []);
    attacksBySeason.get(a.season).push(a);
}

/**
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @returns {number|null}
 */
function sectorsCapturedAt(season, enemy, t) {
    const st = ds.statusAt(season, enemy, t);
    const max = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    return st && max > 0 ? Math.trunc(st.points / (max / SECTOR_COUNT)) : null;
}

/**
 * @param {number} season
 * @param {number} t unix seconds
 * @returns {'ATTACK'|'SC9'|'SC10'|'NORMAL'}
 */
function stateAt(season, t) {
    const attackActive = (attacksBySeason.get(season) ?? []).some(
        (a) => a.start_time <= t && a.end_time > t,
    );
    const scs = [0, 1, 2]
        .map((en) => sectorsCapturedAt(season, en, t))
        .filter((v) => v !== null);
    return classifyState(attackActive, scs.length > 0 ? Math.max(...scs) : null);
}

// 3h-clock lull moments, censored included — same builder as 07.
const byState = new Map(STATES.map((s) => [s, []]));
const pooled = [];
for (const [season, list] of defendsBySeason) {
    const span = ds.seasons.get(season);
    if (!span || span.spanSeconds === 0) continue;
    const starts = list.filter((e) => e.isTrainStart);
    if (starts.length < 2) continue;
    for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
        if (list.some((e) => e.start_time <= t && e.end_time > t)) continue;
        const last = starts.filter((e) => e.start_time <= t).at(-1);
        if (!last) continue;
        const next = starts.find((e) => e.start_time > t);
        const censorAt = (span.lastEnd - t) / HOUR;
        if (!next && censorAt <= 0) continue;
        const sample = {
            state: stateAt(season, t),
            elapsed: (t - last.start_time) / HOUR,
            wait: next ? (next.start_time - t) / HOUR : null,
            censorAt: next ? null : censorAt,
        };
        byState.get(sample.state).push(sample);
        pooled.push(sample);
    }
}
for (const arr of byState.values()) arr.sort((a, b) => a.elapsed - b.elapsed);
pooled.sort((a, b) => a.elapsed - b.elapsed);
assert(pooled.length > 10000, `expected >10k moment samples, got ${pooled.length}`);

// --- fit the table -----------------------------------------------------------

/** @param {number} x @param {number} places @returns {number} */
function round(x, places) {
    const f = 10 ** places;
    return Math.round(x * f) / f;
}

/**
 * @param {'NORMAL'|'SC9'|'SC10'|'ATTACK'} state
 * @param {number} elapsed hours
 * @returns {{p25: number, p50: number, p75: number, p24: number, p48: number}}
 */
function fitRow(state, elapsed) {
    const cell = byState.get(state) ?? [];
    const samples = cell.length >= MIN_CELL ? cell : pooled;
    const steps = kmCdfSteps(nearestSamples(samples, elapsed, KNN_K));
    return {
        p25: round(kmQuantile(steps, 0.25), 1),
        p50: round(kmQuantile(steps, 0.5), 1),
        p75: round(kmQuantile(steps, 0.75), 1),
        p24: round(kmCdfAt(steps, 24), 3),
        p48: round(kmCdfAt(steps, 48), 3),
    };
}

const states = {};
for (const state of STATES) {
    const rows = [];
    for (let bin = 0; bin < BINS; bin++) {
        rows.push(fitRow(state, bin + 0.5));
    }
    states[state] = rows;
}

// --- emit-gate 1: structural checks ------------------------------------------

for (const state of STATES) {
    assert.equal(states[state].length, BINS, `${state}: wrong bin count`);
    for (const [i, r] of states[state].entries()) {
        assert(
            Number.isFinite(r.p25) && Number.isFinite(r.p50) && Number.isFinite(r.p75),
            `${state}[${i}]: non-finite quantile`,
        );
        assert(
            r.p25 <= r.p50 && r.p50 <= r.p75,
            `${state}[${i}]: quantiles not monotone`,
        );
        assert(
            r.p24 >= 0 && r.p24 <= 1 && r.p48 >= 0 && r.p48 <= 1 && r.p24 <= r.p48,
            `${state}[${i}]: bad probabilities`,
        );
    }
}
console.log('structural checks OK');

// --- emit-gate 2: within-24h reliability -------------------------------------
//
// Every historical lull moment with an answerable within-24h outcome gets the
// table's prediction for its (state, bin); deciles of predicted probability
// must match observed frequency. Censored moments with censorAt >= 24 are
// answerable "no"; censored earlier are unanswerable and skipped.
{
    const scored = [];
    for (const s of pooled) {
        let observed;
        if (s.wait !== null) observed = s.wait <= 24 ? 1 : 0;
        else if (s.censorAt >= 24) observed = 0;
        else continue;
        const bin = Math.min(BINS - 1, Math.max(0, Math.floor(s.elapsed / BIN_HOURS)));
        scored.push({ predicted: states[s.state][bin].p24, observed });
    }
    assert(scored.length > 10000, `too few reliability moments: ${scored.length}`);
    scored.sort((a, b) => a.predicted - b.predicted);

    const overallPred = scored.reduce((s, r) => s + r.predicted, 0) / scored.length;
    const overallObs = scored.reduce((s, r) => s + r.observed, 0) / scored.length;
    console.log(
        `reliability overall: predicted ${overallPred.toFixed(3)} vs observed ${overallObs.toFixed(3)}`,
    );
    assert(
        Math.abs(overallPred - overallObs) <= 0.05,
        `overall reliability gap ${Math.abs(overallPred - overallObs).toFixed(3)} > 0.05 — REFUSING to emit`,
    );

    const perDecile = Math.floor(scored.length / 10);
    for (let d = 0; d < 10; d++) {
        const bucket = scored.slice(d * perDecile, (d + 1) * perDecile);
        if (bucket.length < 100) continue;
        const mp = bucket.reduce((s, r) => s + r.predicted, 0) / bucket.length;
        const mo = bucket.reduce((s, r) => s + r.observed, 0) / bucket.length;
        console.log(
            `  decile ${d}: predicted ${mp.toFixed(3)} vs observed ${mo.toFixed(3)} (n=${bucket.length})`,
        );
        assert(
            Math.abs(mp - mo) <= 0.1,
            `decile ${d} reliability gap ${Math.abs(mp - mo).toFixed(3)} > 0.10 — REFUSING to emit`,
        );
    }
    console.log('reliability checks OK');
}

// --- emit -------------------------------------------------------------------

const model = {
    meta: {
        binHours: BIN_HOURS,
        bins: BINS,
        k: KNN_K,
        minCell: MIN_CELL,
        seasons: ds.seasons.size,
        trainStarts: trainStartCount,
    },
    states,
};
fs.writeFileSync(
    OUT_PATH,
    `// Generated by scripts/analysis/08-emit-wave-model.mjs — do not edit by hand.\n` +
        `// Regenerate: node --env-file=.env.development scripts/analysis/08-emit-wave-model.mjs\n` +
        `export default Object.freeze(${JSON.stringify(model)});\n`,
);
console.log(`emitted ${OUT_PATH} (${fs.statSync(OUT_PATH).size} bytes)`);
