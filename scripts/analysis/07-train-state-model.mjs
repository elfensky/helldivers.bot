/**
 * 07-train-state-model.mjs — state-conditional train-start predictors for
 * #472, judged by the pre-registered gate.
 *
 * 06-train-covariates.mjs established, with within-season and phase-
 * stratified permutation placebos, that three OBSERVABLE covariates shift
 * the train-start lull: maxSC==9 at lull start (+20.3h, the homeworld-
 * assault window), an active attack (-11.5h at lull start, but LONGER
 * remaining waits at moment level — the state persists through long lulls),
 * and prevRegion==10 (+10.1h, a proxy for the same assault window). This
 * script asks the only question that matters for shipping: do those
 * covariates, used causally at each walk-forward moment, beat the corrected
 * baseline (04-train-baseline.mjs: skill 0.753, CI [0.732, 0.773]) — and do
 * they clear the gate?
 *
 * PRE-DECLARED DESIGN — written before the first gate run, not tuned after:
 *   - State at moment t (precedence order): ATTACK (any faction's attack
 *     active) > SC9 (max sectors captured across factions == 9) > SC10
 *     (== 10) > NORMAL (anything else, including unknown status).
 *   - STATE model: within the current state, k-nearest-neighbours on
 *     elapsed-since-last-train-start over training-season lull moments
 *     (3h clock, uncensored only), K=200, quantiles of neighbour waits.
 *     Cells under 30 samples fall back to the all-states pool.
 *   - SEASON-SCALE model: empirical residual life over training gaps
 *     multiplied by an online in-season pace factor with M=3 pseudo-gap
 *     shrinkage toward 1.
 *   - STATE x SCALE: the STATE model's quantiles multiplied by the
 *     SEASON-SCALE factor.
 *   - Gate (pre-registered, unchanged): calibration within ±0.05 at all
 *     three quartiles, skill-ratio CI UPPER BOUND <= 0.6, p25-p75 band
 *     narrower than the train-start gap IQR marginal. CI lower bound > 0.8
 *     means not usefully predictable.
 *
 * Known bias, accepted and documented: the plain STATE fit drops right-
 * censored training moments (their wait is unknown), which biases fitted
 * waits SHORT in states that often run into season end (ATTACK especially).
 * The evaluation harness scores censored moments properly, so this bias can
 * only hurt the model's measured skill, not flatter it. The first gate run
 * confirmed the predicted direction: STATE failed calibration with all three
 * rates LOW (0.188/0.442/0.722). The single declared v2 fix — added after
 * that run, with the v1 configurations kept in the output — is the standard
 * estimator for exactly this defect: Kaplan-Meier product-limit quantiles
 * over the kNN neighbourhood, with censored training moments included as
 * right-censored observations. No other change: same states, same K, same
 * MIN_CELL, same clock. Whatever the KM configurations score is the answer.
 *
 * Test-season data used at predict time is restricted to what is observable
 * at the moment: status buckets at or before t (statusAt), attacks that have
 * STARTED at or before t (an attack's activity at t is known in real time),
 * and train starts at or before t (lastEvent). Training-season data is
 * restricted to seasons strictly before the test season, asserted at fit.
 *
 * Run: node --env-file=.env.development scripts/analysis/07-train-state-model.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR, SECTOR_COUNT } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const KNN_K = 200;
const MIN_CELL = 30;
const SCALE_PSEUDO_GAPS = 3;
const STEP_HOURS = 3;

// --- pure helpers ------------------------------------------------------------

/**
 * State label from its two ingredients. Precedence: an active attack beats
 * the sector count (the assault IS the event the sector count anticipates),
 * and unknown status (null maxSC) is NORMAL.
 *
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
 * Empirical residual-life predictor — same function as 02/04, duplicated
 * because those are scripts, not libraries, and lib/backtest.mjs may not
 * grow an export surface for it.
 *
 * @param {number[]} gaps training start-to-start gaps, hours
 * @returns {(elapsedHours: number) => {p25: number, p50: number, p75: number}}
 */
function makeResidualPredictor(gaps) {
    const sorted = [...gaps].sort((a, b) => a - b);
    return function predict(elapsedHours) {
        const survivors = sorted
            .filter((g) => g > elapsedHours)
            .map((g) => g - elapsedHours);
        if (survivors.length === 0) {
            const floor = sorted[0] ?? 1;
            return { p25: floor, p50: floor, p75: floor };
        }
        return {
            p25: quantileOf(survivors, 0.25),
            p50: quantileOf(survivors, 0.5),
            p75: quantileOf(survivors, 0.75),
        };
    };
}

/**
 * K-nearest-neighbours by elapsed over a sorted sample array.
 *
 * @param {{elapsed: number}[]} samples sorted by elapsed asc
 * @param {number} elapsed query point
 * @param {number} k
 * @returns {object[]} the k nearest samples (all, if fewer)
 */
function nearestSamples(samples, elapsed, k) {
    const n = samples.length;
    if (n === 0) return [];
    if (n <= k) return [...samples];

    // Binary search for the insertion point, then expand two pointers.
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
 * @param {{elapsed: number, wait: number}[]} samples sorted by elapsed asc
 * @param {number} elapsed
 * @param {number} k
 * @returns {number[]}
 */
function nearestWaits(samples, elapsed, k) {
    return nearestSamples(samples, elapsed, k).map((s) => s.wait);
}

/**
 * Quantile triple of an array of waits.
 *
 * @param {number[]} waits non-empty
 * @returns {{p25: number, p50: number, p75: number}}
 */
function waitQuantiles(waits) {
    assert(waits.length > 0, 'waitQuantiles requires samples');
    return {
        p25: quantileOf(waits, 0.25),
        p50: quantileOf(waits, 0.5),
        p75: quantileOf(waits, 0.75),
    };
}

/**
 * Kaplan-Meier product-limit quantiles over a mixed censored/uncensored
 * neighbourhood — the v2 censoring fix (see the header note).
 *
 * Samples with `wait !== null` are events; samples with `wait === null` are
 * right-censored at `censorAt`. The q-quantile is the smallest event time at
 * which the KM CDF (1 - S) reaches q. When censoring is so heavy the CDF
 * never reaches q, the largest event time is returned (a conservative,
 * declared fallback — with K=200 neighbourhoods this is rare).
 *
 * @param {{wait: number|null, censorAt?: number}[]} samples non-empty
 * @returns {{p25: number, p50: number, p75: number}}
 */
function kmQuantiles(samples) {
    assert(samples.length > 0, 'kmQuantiles requires samples');
    const points = samples
        .map((s) => ({
            time: s.wait !== null ? s.wait : s.censorAt,
            event: s.wait !== null,
        }))
        // Standard KM tie convention: events before censorings at equal time
        // (a censored-at-t observation is still at risk for an event at t).
        .sort((a, b) => a.time - b.time || (a.event ? 0 : 1) - (b.event ? 0 : 1));

    let atRisk = points.length;
    let survival = 1;
    let lastEventTime = null;
    const cdfSteps = []; // [time, cdf] at each event time
    for (const p of points) {
        if (p.event) {
            survival *= (atRisk - 1) / atRisk;
            cdfSteps.push([p.time, 1 - survival]);
            lastEventTime = p.time;
        }
        atRisk--;
    }
    assert(lastEventTime !== null, 'kmQuantiles requires at least one uncensored sample');

    /** @param {number} q @returns {number} */
    function quantile(q) {
        for (const [time, cdf] of cdfSteps) {
            if (cdf >= q) return time;
        }
        return lastEventTime;
    }
    return { p25: quantile(0.25), p50: quantile(0.5), p75: quantile(0.75) };
}

/**
 * Online in-season pace factor: the season's own median start-to-start gap,
 * shrunk toward the training-history median by M pseudo-gaps.
 *
 * @param {number[]} inSeasonGaps gaps observed so far this season, hours
 * @param {number} globalMedian training-history median gap, hours
 * @returns {number} multiplicative scale, 1 when nothing observed yet
 */
function seasonScale(inSeasonGaps, globalMedian) {
    const k = inSeasonGaps.length;
    if (k === 0 || !(globalMedian > 0)) return 1;
    const seasonMed = quantileOf(inSeasonGaps, 0.5);
    return (
        (k * seasonMed + SCALE_PSEUDO_GAPS * globalMedian) /
        ((k + SCALE_PSEUDO_GAPS) * globalMedian)
    );
}

// --- self-checks on the pure helpers (no DB) --------------------------------

{
    // classifyState precedence.
    assert.equal(classifyState(true, 9), 'ATTACK', 'attack beats SC9');
    assert.equal(classifyState(false, 9), 'SC9');
    assert.equal(classifyState(false, 10), 'SC10');
    assert.equal(classifyState(false, 8), 'NORMAL');
    assert.equal(classifyState(false, null), 'NORMAL', 'unknown status is NORMAL');
}

{
    // nearestWaits: nearest by |elapsed|, exact K, and the small-n path.
    const samples = [1, 2, 3, 10, 11, 12].map((e) => ({ elapsed: e, wait: e * 10 }));
    assert.deepEqual(
        [...nearestWaits(samples, 2, 3)].sort((a, b) => a - b),
        [10, 20, 30],
        'k nearest around elapsed=2 should be the low cluster',
    );
    assert.deepEqual(
        [...nearestWaits(samples, 11, 3)].sort((a, b) => a - b),
        [100, 110, 120],
        'k nearest around elapsed=11 should be the high cluster',
    );
    assert.equal(nearestWaits(samples, 5, 100).length, 6, 'small n returns all');
    assert.deepEqual(nearestWaits([], 5, 3), [], 'empty samples return empty');
}

{
    // A two-state synthetic world: the kNN separates states the pooled
    // residual predictor cannot. State A waits ~10h, state B waits ~50h.
    const a = [];
    const b = [];
    for (let i = 0; i < 100; i++) {
        a.push({ elapsed: i % 20, wait: 10 + (i % 5) });
        b.push({ elapsed: i % 20, wait: 50 + (i % 5) });
    }
    a.sort((x, y) => x.elapsed - y.elapsed);
    b.sort((x, y) => x.elapsed - y.elapsed);
    const qa = waitQuantiles(nearestWaits(a, 10, 50));
    const qb = waitQuantiles(nearestWaits(b, 10, 50));
    assert(qa.p50 < 20 && qb.p50 > 40, 'state-conditional medians must separate');
}

{
    // seasonScale shrinkage: no data -> 1; consistent 2x gaps approach 2.
    assert.equal(seasonScale([], 40), 1);
    const g = 40;
    const oneGap = seasonScale([2 * g], g);
    const sevenGaps = seasonScale(new Array(7).fill(2 * g), g);
    assert(Math.abs(oneGap - 1.25) < 1e-9, `k=1 shrinkage should be 1.25, got ${oneGap}`);
    assert(
        Math.abs(sevenGaps - 1.7) < 1e-9,
        `k=7 shrinkage should be 1.7, got ${sevenGaps}`,
    );
    assert(oneGap < sevenGaps, 'scale must move toward the season value with evidence');
}

{
    // Residual predictor fixture — same as 02/04.
    const predict = makeResidualPredictor([10, 20, 30, 40]);
    assert.equal(predict(0).p50, 25);
    assert.equal(predict(25).p50, 10);
}

{
    // kmQuantiles: with no censoring, the KM CDF steps 0.25/0.5/0.75/1.0.
    const plain = kmQuantiles([10, 20, 30, 40].map((w) => ({ wait: w })));
    assert.deepEqual(plain, { p25: 10, p50: 20, p75: 30 });

    // Censoring must pull quantiles UP relative to dropping censored rows:
    // events at 10 and 20, three moments censored at 15. Dropping the
    // censored rows gives p50=15 (interpolated); KM knows three more waits
    // exceeded 15, so mass shifts late: CDF is 0.2 at t=10 and reaches 1.0
    // only at t=20.
    const km = kmQuantiles([
        { wait: 10 },
        { wait: 20 },
        { wait: null, censorAt: 15 },
        { wait: null, censorAt: 15 },
        { wait: null, censorAt: 15 },
    ]);
    assert.deepEqual(km, { p25: 20, p50: 20, p75: 20 });
    assert(
        km.p50 > quantileOf([10, 20], 0.5),
        'KM must correct the censoring-drop downward bias',
    );

    // Heavy-censoring fallback: CDF never reaches p75 -> largest event time.
    const heavy = kmQuantiles([
        { wait: 10 },
        { wait: null, censorAt: 50 },
        { wait: null, censorAt: 50 },
        { wait: null, censorAt: 50 },
    ]);
    assert.equal(heavy.p75, 10, 'heavy censoring falls back to the largest event time');
}

console.log(
    '=== Phase 7: state-conditional train-start models — pure self-checks OK ===',
);

// --- run (DB-dependent) -----------------------------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const attacks = ds.events.filter((e) => e.type === 'attack');
const trainStarts = allDefends.filter((e) => e.type === 'defend' && e.isTrainStart);
assert(
    trainStarts.length > 0 && trainStarts.length < allDefends.length,
    'train starts should be a proper subset of defends',
);

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
 * Sectors captured for a faction at `t` — same formula as 01/06.
 *
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
 * Observable state at a moment: attack activity and max sectors captured,
 * both reconstructed from data available at `t`.
 *
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

// Per-season moment samples, computed ONCE and reused by every walk-forward
// fold that trains on that season. The 3h clock from span.firstStart mirrors
// walkForward's own stepping. Moments with no subsequent train start carry
// `wait: null` and a `censorAt` lower bound — the v1 fits drop them, the v2
// KM fits use them as right-censored observations.
const momentSamplesBySeason = new Map();
for (const [season, list] of defendsBySeason) {
    const span = ds.seasons.get(season);
    if (!span || span.spanSeconds === 0) continue;
    const starts = list.filter((e) => e.isTrainStart);
    if (starts.length < 2) continue;
    const samples = [];
    for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
        if (list.some((e) => e.start_time <= t && e.end_time > t)) continue;
        const last = starts.filter((e) => e.start_time <= t).at(-1);
        if (!last) continue;
        const next = starts.find((e) => e.start_time > t);
        const censorAt = (span.lastEnd - t) / HOUR;
        if (!next && censorAt <= 0) continue;
        samples.push({
            season,
            state: stateAt(season, t),
            elapsed: (t - last.start_time) / HOUR,
            wait: next ? (next.start_time - t) / HOUR : null,
            censorAt: next ? null : censorAt,
        });
    }
    momentSamplesBySeason.set(season, samples);
}
assert(momentSamplesBySeason.size > 100, 'expected moment samples for most seasons');
{
    const all = [...momentSamplesBySeason.values()].flat();
    const censored = all.filter((s) => s.wait === null);
    assert(censored.length > 0, 'expected some censored moment samples');
    assert(
        censored.length < all.length / 4,
        'censored samples should be a small minority',
    );
}

const activeBySeasonSorted = new Map(
    [...defendsBySeason.entries()].map(([s, list]) => [
        s,
        [...list].sort((a, b) => a.start_time - b.start_time),
    ]),
);

/**
 * walkForward momentFilter: a train cannot start while a defend is running.
 *
 * @param {number} t
 * @param {object[]} seasonEvents
 * @returns {boolean}
 */
function noDefendActive(t, seasonEvents) {
    const season = seasonEvents[0]?.season;
    const list = activeBySeasonSorted.get(season) ?? [];
    return !list.some((e) => e.start_time <= t && e.end_time > t);
}

// --- the four pre-declared fitPredictors ------------------------------------

/**
 * BASELINE — 04-train-baseline.mjs replica: empirical residual life over the
 * training start-to-start gaps, no features.
 *
 * @param {object[]} trainEvents
 * @param {object} ctx
 */
function fitBaseline(trainEvents, ctx) {
    const predictResidual = makeResidualPredictor(ctx.trainGaps);
    return (moment) =>
        predictResidual(Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR));
}

/**
 * Build the per-state (and pooled) sorted sample arrays for a test season,
 * from training seasons only. Shared by the STATE-family fits.
 *
 * @param {number} testSeason
 * @param {boolean} includeCensored v1 fits drop censored samples; v2 KM fits keep them
 * @returns {{byState: Map<string, object[]>, pooled: object[]}}
 */
function buildStateSamples(testSeason, includeCensored) {
    const byState = new Map();
    const pooled = [];
    for (const [season, samples] of momentSamplesBySeason) {
        if (season >= testSeason) continue;
        for (const s of samples) {
            // Leakage guard: every sample must come from a strictly earlier
            // season. The map key check above enforces it; this assert makes
            // a regression loud instead of silent.
            assert(s.season < testSeason, 'state sample from a non-training season');
            if (!includeCensored && s.wait === null) continue;
            if (!byState.has(s.state)) byState.set(s.state, []);
            byState.get(s.state).push(s);
            pooled.push(s);
        }
    }
    for (const arr of byState.values()) arr.sort((a, b) => a.elapsed - b.elapsed);
    pooled.sort((a, b) => a.elapsed - b.elapsed);
    return { byState, pooled };
}

/**
 * STATE — kNN on elapsed within the moment's observable state.
 *
 * @param {object[]} trainEvents
 * @param {object} ctx
 */
function fitState(trainEvents, ctx) {
    const { byState, pooled } = buildStateSamples(ctx.testSeason, false);
    return function predict(moment) {
        const state = stateAt(moment.season, moment.t);
        const elapsed = Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR);
        const cell = byState.get(state) ?? [];
        const samples = cell.length >= MIN_CELL ? cell : pooled;
        assert(samples.length > 0, 'no training samples available');
        return waitQuantiles(nearestWaits(samples, elapsed, KNN_K));
    };
}

/**
 * STATE-KM — identical to STATE except the neighbourhood includes right-
 * censored training moments and quantiles come from the Kaplan-Meier
 * product-limit estimator. The single declared v2 censoring fix.
 *
 * @param {object[]} trainEvents
 * @param {object} ctx
 */
function fitStateKM(trainEvents, ctx) {
    const { byState, pooled } = buildStateSamples(ctx.testSeason, true);
    return function predict(moment) {
        const state = stateAt(moment.season, moment.t);
        const elapsed = Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR);
        const cell = byState.get(state) ?? [];
        const samples = cell.length >= MIN_CELL ? cell : pooled;
        assert(samples.length > 0, 'no training samples available');
        return kmQuantiles(nearestSamples(samples, elapsed, KNN_K));
    };
}

/**
 * SEASON-SCALE — residual life over training gaps rescaled by the online
 * in-season pace factor. In-season gaps are accumulated from the successive
 * distinct `lastEvent`s the walk-forward clock reveals; a lull short enough
 * to fall entirely between two 3h clock ticks can merge two gaps into one,
 * which is rare (lull p05 = 14.2h) and accepted.
 *
 * @param {object[]} trainEvents
 * @param {object} ctx
 */
function fitSeasonScale(trainEvents, ctx) {
    const globalMedian = quantileOf(ctx.trainGaps, 0.5) ?? 0;
    const baseGaps = ctx.trainGaps;
    const inSeasonGaps = [];
    let lastSeen = null;
    let cachedScale = 1;
    let cachedPredict = makeResidualPredictor(baseGaps);
    return function predict(moment) {
        const s = moment.lastEvent.start_time;
        if (lastSeen === null) {
            lastSeen = s;
        } else if (s > lastSeen) {
            inSeasonGaps.push((s - lastSeen) / HOUR);
            lastSeen = s;
            const scale = seasonScale(inSeasonGaps, globalMedian);
            if (scale !== cachedScale) {
                cachedScale = scale;
                cachedPredict = makeResidualPredictor(baseGaps.map((g) => g * scale));
            }
        }
        return cachedPredict(Math.max(0, (moment.t - s) / HOUR));
    };
}

/**
 * STATE x SCALE — the STATE model's quantiles multiplied by the SEASON-SCALE
 * pace factor. A deliberately crude composition, declared up front.
 * `fitInner` selects the plain (v1) or KM (v2) state fit.
 *
 * @param {(trainEvents: object[], ctx: object) => (moment: object) => object} fitInner
 * @returns {(trainEvents: object[], ctx: object) => (moment: object) => object}
 */
function makeFitStateTimesScale(fitInner) {
    return function fitStateTimesScale(trainEvents, ctx) {
        const statePredict = fitInner(trainEvents, ctx);
        const globalMedian = quantileOf(ctx.trainGaps, 0.5) ?? 0;
        const inSeasonGaps = [];
        let lastSeen = null;
        return function predict(moment) {
            const s = moment.lastEvent.start_time;
            if (lastSeen === null) {
                lastSeen = s;
            } else if (s > lastSeen) {
                inSeasonGaps.push((s - lastSeen) / HOUR);
                lastSeen = s;
            }
            const scale = seasonScale(inSeasonGaps, globalMedian);
            const q = statePredict(moment);
            return { p25: q.p25 * scale, p50: q.p50 * scale, p75: q.p75 * scale };
        };
    };
}

// --- train-start gap marginal (sharpness comparator, as in 04) --------------

const trainStartGaps = [];
{
    const bySeason = new Map();
    for (const e of trainStarts) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }
    for (const [, list] of bySeason) {
        for (let i = 1; i < list.length; i++) {
            trainStartGaps.push((list[i].start_time - list[i - 1].start_time) / HOUR);
        }
    }
}
const marginalIQR =
    (quantileOf(trainStartGaps, 0.75) ?? 0) - (quantileOf(trainStartGaps, 0.25) ?? 0);
console.log(
    `\ntrain-start gap marginal: n=${trainStartGaps.length} IQR=${marginalIQR.toFixed(1)}h`,
);

// --- run all four configurations --------------------------------------------

const CONFIGS = [
    { label: 'BASELINE (04 replica)', fit: fitBaseline },
    { label: 'STATE (kNN by observable state)', fit: fitState },
    { label: 'SEASON-SCALE (online pace factor)', fit: fitSeasonScale },
    { label: 'STATE x SCALE', fit: makeFitStateTimesScale(fitState) },
    { label: 'STATE-KM (censoring-corrected)', fit: fitStateKM },
    { label: 'STATE-KM x SCALE', fit: makeFitStateTimesScale(fitStateKM) },
];

console.log('\n=== Phase 7: state-conditional models, walk-forward ===\n');

const results = [];
for (const cfg of CONFIGS) {
    const summary = walkForward({
        events: trainStarts,
        seasons: ds.seasons,
        type: 'defend',
        enemy: undefined,
        fitPredictor: cfg.fit,
        momentFilter: noDefendActive,
    });
    results.push({ cfg, summary });
    console.log(cfg.label);
    console.log(
        `  moments=${summary.moments} (uncensored=${summary.uncensored} censored-scored=${summary.censoredScored}) EFFECTIVE N=${summary.effectiveN}`,
    );
    console.log(
        `  calibration  p25=${summary.calibration.q25.toFixed(3)}/0.250  p50=${summary.calibration.q50.toFixed(3)}/0.500  p75=${summary.calibration.q75.toFixed(3)}/0.750`,
    );
    console.log(
        `  sharpness    band median width ${summary.sharpnessHours.toFixed(1)}h vs marginal IQR ${marginalIQR.toFixed(1)}h`,
    );
    console.log(
        `  skill        |true-p50| median ${summary.medianAbsErrorHours.toFixed(1)}h vs baseline ${summary.baselineMedianAbsErrorHours.toFixed(1)}h => ratio ${summary.skillRatio.toFixed(3)} (95% CI ${summary.skillRatioCI[0].toFixed(3)}-${summary.skillRatioCI[1].toFixed(3)})\n`,
    );
}

// --- decision gate (pre-registered, identical to 04) -------------------------

const CAL_TOLERANCE = 0.05;
const SHIP_SKILL = 0.6;
const DEAD_SKILL = 0.8;

console.log('=== Decision gate (pre-registered) ===\n');
for (const { cfg, summary } of results) {
    const calOk =
        Math.abs(summary.calibration.q25 - 0.25) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q50 - 0.5) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q75 - 0.75) <= CAL_TOLERANCE;
    const [ciLo, ciHi] = summary.skillRatioCI;
    const narrower = summary.sharpnessHours < marginalIQR;

    let verdict;
    if (calOk && ciHi <= SHIP_SKILL && narrower) {
        verdict = 'SHIP-WORTHY';
    } else if (ciLo > DEAD_SKILL) {
        verdict = 'NOT USEFULLY PREDICTABLE';
    } else if (calOk && summary.skillRatio <= SHIP_SKILL) {
        verdict = 'PROMISING BUT UNDERPOWERED — point estimate passes, CI does not';
    } else {
        verdict = 'INCONCLUSIVE';
    }
    console.log(
        `${cfg.label}: calibration ${calOk ? 'PASS' : 'FAIL'}, skill ${summary.skillRatio.toFixed(3)} [${ciLo.toFixed(3)}-${ciHi.toFixed(3)}], band ${summary.sharpnessHours.toFixed(1)}h vs ${marginalIQR.toFixed(1)}h (${narrower ? 'narrower' : 'NOT narrower'}) => ${verdict}`,
    );
}
