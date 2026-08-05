/**
 * 15-counterattack-target.mjs — the THIRD target correction: exclude
 * mechanically-scheduled counterattack trains from the defend forecasting
 * series and re-run the gate.
 *
 * `14-counterattack-delta.mjs` found the counterattack delay is MECHANICAL
 * under its pre-registered criterion: with the defend slot free, the
 * counterattack train starts within 2h of the failed assault's end for
 * 467/474 cases (p05-p95 = 0.0h — it fires the moment the 48h assault
 * timeout expires). Those train starts carry no scheduler randomness, so
 * keeping them in the forecasting series repeats attempt 1's mistake of
 * modelling a mechanic (then: chain follow-ups; now: counterattacks).
 *
 * PRE-DECLARED DESIGN — written before the first corrected-gate run:
 *   - COUNTERATTACK LABEL: a train start is a counterattack iff a
 *     fail-resolved assault of the SAME (season, enemy) ended within
 *     [start - 2h, start]. 2h is the analog of the attempt-2 chain window,
 *     read off 14's histogram BEFORE this script ran (467/474 slot-free
 *     deltas < 2h; the 43 double-queued cases fire wide — p50 36.8h — and
 *     are NOT immediate, so delayed queue releases KEEP their target status:
 *     their timing still carries scheduler randomness even though their
 *     faction does not). Observability: "fail" is knowable at the assault's
 *     end in real time — every fail-resolved assault in history ran exactly
 *     48.0h (a timeout), every success ended earlier — so the label is
 *     causal at the train's own start (handoff trap 2).
 *   - CONFIGS: featureless BASELINE and STATE-KM (the current best,
 *     `07-train-state-model.mjs`), both walked forward on the SAME corrected
 *     series (handoff trap 1: removing the 179-ish mechanical lulls changes
 *     model AND baseline). Same K=200, MIN_CELL=30, 3h clock, same state
 *     definition (ATTACK > SC9 > SC10 > NORMAL) — no other change.
 *   - SHARPNESS COMPARATOR: the corrected series' OWN start-to-start gap
 *     IQR, recomputed here — comparing against the old 22.4h marginal is
 *     the exact mistake a prior review caught (see 04's header).
 *   - GATE (unchanged): calibration within ±0.05 at p25/p50/p75, skill
 *     ratio CI UPPER bound <= 0.6, band narrower than the corrected
 *     marginal IQR. CI lower > 0.8 = not usefully predictable.
 *
 * Also refits the scheduler-shape gamma (13-scheduler-shape.mjs) on the
 * SPLIT lull populations: 13's fit pooled counterattack lulls (mechanical:
 * prev train end -> assault timeout) with free lulls, so the "free"
 * distribution was gamma MINUS a contaminating component. Three fits:
 * all lulls (13 replica), free-ending lulls only, and free-ending lulls
 * NET of assault-active time (14 found the defend hazard fully gated
 * during assaults — 0 non-counterattack starts in 24,651h of
 * assault-active lull exposure — so gated time arguably shouldn't count
 * against the clock).
 *
 * Run: node --env-file=.env.development scripts/analysis/15-counterattack-target.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR, SECTOR_COUNT } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const KNN_K = 200;
const MIN_CELL = 30;
const STEP_HOURS = 3;
const COUNTERATTACK_WINDOW_H = 2;

// --- pure helpers (duplicated from 07/13 per scripts-dir convention) ---------

/**
 * A train start is a counterattack iff a fail-resolved assault of the same
 * (season, enemy) ended within [start - windowH, start].
 *
 * @param {object} trainStart defend event with isTrainStart
 * @param {object[]} seasonFailedAttacks fail-resolved attacks of the season
 * @param {number} windowH
 * @returns {boolean}
 */
function isCounterattackStart(trainStart, seasonFailedAttacks, windowH) {
    return seasonFailedAttacks.some(
        (a) =>
            a.enemy === trainStart.enemy &&
            trainStart.start_time - a.end_time >= 0 &&
            trainStart.start_time - a.end_time <= windowH * HOUR,
    );
}

/**
 * State label — same precedence as 07.
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
 * Empirical residual-life predictor — same as 02/04/07.
 *
 * @param {number[]} gaps hours
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
 * K nearest samples by |elapsed| — same as 07.
 *
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
 * Kaplan-Meier product-limit quantiles — same as 07 (the v2 censoring fix).
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
        .sort((a, b) => a.time - b.time || (a.event ? 0 : 1) - (b.event ? 0 : 1));
    let atRisk = points.length;
    let survival = 1;
    let lastEventTime = null;
    const cdfSteps = [];
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
        for (const [time, cdf] of cdfSteps) if (cdf >= q) return time;
        return lastEventTime;
    }
    return { p25: quantile(0.25), p50: quantile(0.5), p75: quantile(0.75) };
}

/**
 * Natural log of the gamma function — same as 13 (Lanczos, g=7).
 *
 * @param {number} x positive real
 * @returns {number}
 */
function lnGamma(x) {
    const g = [
        676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
        12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
    x -= 1;
    let a = 0.99999999999980993;
    const t = x + 7.5;
    for (let i = 0; i < 8; i++) a += g[i] / (x + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Gamma CDF — same as 13.
 *
 * @param {number} x @param {number} k @param {number} theta
 * @returns {number}
 */
function gammaCdf(x, k, theta) {
    const z = x / theta;
    if (z <= 0) return 0;
    let sum = 1 / k;
    let term = sum;
    for (let n = 1; n < 500; n++) {
        term *= z / (k + n);
        sum += term;
        if (term < 1e-14) break;
    }
    return Math.min(1, sum * Math.exp(-z + k * Math.log(z) - lnGamma(k)));
}

/**
 * KS distance — same as 13.
 *
 * @param {number[]} sortedSample ascending
 * @param {(x: number) => number} cdf
 * @returns {number}
 */
function ksDistance(sortedSample, cdf) {
    let d = 0;
    const n = sortedSample.length;
    for (let i = 0; i < n; i++) {
        const c = cdf(sortedSample[i]);
        d = Math.max(d, Math.abs((i + 1) / n - c), Math.abs(i / n - c));
    }
    return d;
}

/**
 * Total length of the union of intervals clipped to [lo, hi) — same as 14.
 *
 * @param {{s: number, e: number}[]} intervals
 * @param {number} lo @param {number} hi
 * @returns {number} seconds
 */
function unionOverlapSeconds(intervals, lo, hi) {
    const clipped = intervals
        .map((iv) => ({ s: Math.max(iv.s, lo), e: Math.min(iv.e, hi) }))
        .filter((iv) => iv.e > iv.s)
        .sort((a, b) => a.s - b.s);
    let total = 0;
    let curS = null;
    let curE = null;
    for (const iv of clipped) {
        if (curE === null || iv.s > curE) {
            if (curE !== null) total += curE - curS;
            curS = iv.s;
            curE = iv.e;
        } else if (iv.e > curE) {
            curE = iv.e;
        }
    }
    if (curE !== null) total += curE - curS;
    return total;
}

/**
 * Method-of-moments gamma fit + KS, for the split-population refits.
 *
 * @param {number[]} hours
 * @returns {{n: number, mean: number, cv: number, k: number, theta: number,
 *   ks: number, p25: number, p50: number, p75: number}}
 */
function gammaFitOf(hours) {
    const n = hours.length;
    const mean = hours.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(hours.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const cv = sd / mean;
    const k = 1 / (cv * cv);
    const theta = mean * cv * cv;
    const sorted = [...hours].sort((a, b) => a - b);
    return {
        n,
        mean,
        cv,
        k,
        theta,
        ks: ksDistance(sorted, (x) => gammaCdf(x, k, theta)),
        p25: quantileOf(hours, 0.25),
        p50: quantileOf(hours, 0.5),
        p75: quantileOf(hours, 0.75),
    };
}

// --- pure self-checks (no DB) ------------------------------------------------

{
    // isCounterattackStart: same faction inside the window only.
    const ts = { season: 1, enemy: 0, start_time: 100 * HOUR };
    const atk = (enemy, endH) => ({ enemy, end_time: endH * HOUR });
    assert(isCounterattackStart(ts, [atk(0, 99)], 2), 'inside window');
    assert(isCounterattackStart(ts, [atk(0, 100)], 2), 'zero delta counts');
    assert(!isCounterattackStart(ts, [atk(0, 97)], 2), 'outside window');
    assert(!isCounterattackStart(ts, [atk(1, 99)], 2), 'other faction never');
    assert(!isCounterattackStart(ts, [atk(0, 101)], 2), 'assault ends after start');
}

{
    // kmQuantiles fixtures — same as 07.
    assert.deepEqual(kmQuantiles([10, 20, 30, 40].map((w) => ({ wait: w }))), {
        p25: 10,
        p50: 20,
        p75: 30,
    });
    assert.deepEqual(
        kmQuantiles([
            { wait: 10 },
            { wait: 20 },
            { wait: null, censorAt: 15 },
            { wait: null, censorAt: 15 },
            { wait: null, censorAt: 15 },
        ]),
        { p25: 20, p50: 20, p75: 20 },
    );
}

{
    // Gamma machinery fixtures — same identities as 13.
    assert(Math.abs(lnGamma(5) - Math.log(24)) < 1e-9, 'lnGamma(5)');
    assert(
        Math.abs(gammaCdf(10, 1, 10) - (1 - Math.exp(-1))) < 1e-6,
        'gammaCdf k=1 exponential',
    );
    assert(
        Math.abs(ksDistance([1, 2, 3], (x) => x / 4) - 0.25) < 1e-12,
        'ksDistance fixture',
    );
    assert.equal(
        unionOverlapSeconds(
            [
                { s: 0, e: 10 },
                { s: 5, e: 20 },
            ],
            0,
            100,
        ),
        20,
    );
}

{
    // Residual predictor fixture — same as 02/04/07.
    const predict = makeResidualPredictor([10, 20, 30, 40]);
    assert.equal(predict(0).p50, 25);
    assert.equal(predict(25).p50, 10);
}

console.log('=== 15-counterattack-target: pure self-checks OK ===');

// --- data and labelling -------------------------------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const attacks = ds.events.filter((e) => e.type === 'attack');
const trainStarts = allDefends.filter((e) => e.isTrainStart);

const failedBySeason = new Map();
for (const a of attacks) {
    if (a.status !== 'fail') continue;
    if (!failedBySeason.has(a.season)) failedBySeason.set(a.season, []);
    failedBySeason.get(a.season).push(a);
}

const counterStarts = new Set();
for (const e of trainStarts) {
    if (
        isCounterattackStart(
            e,
            failedBySeason.get(e.season) ?? [],
            COUNTERATTACK_WINDOW_H,
        )
    ) {
        counterStarts.add(e);
    }
}
const correctedStarts = trainStarts.filter((e) => !counterStarts.has(e));
console.log(
    `\ntrain starts: ${trainStarts.length} total, ${counterStarts.size} counterattacks ` +
        `(mechanical, excluded), ${correctedStarts.length} corrected targets`,
);
assert(
    counterStarts.size > 400 && counterStarts.size < 600,
    `expected ~490 counterattack labels (14 matched 467 slot-free + immediate queue fires), got ${counterStarts.size}`,
);

// --- corrected marginal (sharpness comparator) --------------------------------

const correctedGaps = [];
{
    const bySeason = new Map();
    for (const e of correctedStarts) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }
    for (const [, list] of bySeason) {
        for (let i = 1; i < list.length; i++) {
            correctedGaps.push((list[i].start_time - list[i - 1].start_time) / HOUR);
        }
    }
}
const marginalIQR =
    (quantileOf(correctedGaps, 0.75) ?? 0) - (quantileOf(correctedGaps, 0.25) ?? 0);
console.log(
    `corrected start-to-start marginal: n=${correctedGaps.length}  ` +
        `p25=${quantileOf(correctedGaps, 0.25).toFixed(1)}h  p50=${quantileOf(correctedGaps, 0.5).toFixed(1)}h  ` +
        `p75=${quantileOf(correctedGaps, 0.75).toFixed(1)}h  IQR=${marginalIQR.toFixed(1)}h`,
);

// --- state machinery (07 replica, corrected series) ---------------------------

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
 * Sectors captured — same formula as 01/06/07.
 *
 * @param {number} season @param {number} enemy @param {number} t
 * @returns {number|null}
 */
function sectorsCapturedAt(season, enemy, t) {
    const st = ds.statusAt(season, enemy, t);
    const max = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    return st && max > 0 ? Math.trunc(st.points / (max / SECTOR_COUNT)) : null;
}

/**
 * Observable state at a moment — same as 07.
 *
 * @param {number} season @param {number} t
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

// Per-season moment samples over the CORRECTED series: elapsed since the last
// corrected start, wait to the next corrected start. Moments during ANY
// defend (counterattack trains included) are skipped, as in 07.
const momentSamplesBySeason = new Map();
for (const [season, list] of defendsBySeason) {
    const span = ds.seasons.get(season);
    if (!span || span.spanSeconds === 0) continue;
    const starts = list.filter((e) => e.isTrainStart && !counterStarts.has(e));
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

const activeBySeasonSorted = new Map(
    [...defendsBySeason.entries()].map(([s, list]) => [
        s,
        [...list].sort((a, b) => a.start_time - b.start_time),
    ]),
);

/**
 * walkForward momentFilter — a train cannot start while a defend is running
 * (any defend, counterattack trains included). Same as 07.
 *
 * @param {number} t @param {object[]} seasonEvents
 * @returns {boolean}
 */
function noDefendActive(t, seasonEvents) {
    const season = seasonEvents[0]?.season;
    const list = activeBySeasonSorted.get(season) ?? [];
    return !list.some((e) => e.start_time <= t && e.end_time > t);
}

/**
 * BASELINE — featureless residual life over training gaps. Same as 04/07.
 *
 * @param {object[]} trainEvents @param {object} ctx
 */
function fitBaseline(trainEvents, ctx) {
    const predictResidual = makeResidualPredictor(ctx.trainGaps);
    return (moment) =>
        predictResidual(Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR));
}

/**
 * STATE-KM — kNN on elapsed within observable state, KM quantiles over the
 * censored-inclusive neighbourhood. Same as 07's best configuration.
 *
 * @param {object[]} trainEvents @param {object} ctx
 */
function fitStateKM(trainEvents, ctx) {
    const byState = new Map();
    const pooled = [];
    for (const [season, samples] of momentSamplesBySeason) {
        if (season >= ctx.testSeason) continue;
        for (const s of samples) {
            assert(s.season < ctx.testSeason, 'state sample from a non-training season');
            if (!byState.has(s.state)) byState.set(s.state, []);
            byState.get(s.state).push(s);
            pooled.push(s);
        }
    }
    for (const arr of byState.values()) arr.sort((a, b) => a.elapsed - b.elapsed);
    pooled.sort((a, b) => a.elapsed - b.elapsed);
    return function predict(moment) {
        const state = stateAt(moment.season, moment.t);
        const elapsed = Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR);
        const cell = byState.get(state) ?? [];
        const samples = cell.length >= MIN_CELL ? cell : pooled;
        assert(samples.length > 0, 'no training samples available');
        return kmQuantiles(nearestSamples(samples, elapsed, KNN_K));
    };
}

// --- corrected-target walk-forward + gate -------------------------------------

console.log(
    '\n=== corrected-target walk-forward (gate: pre-registered, unchanged) ===\n',
);
const CONFIGS = [
    { label: 'BASELINE (corrected target)', fit: fitBaseline },
    { label: 'STATE-KM (corrected target)', fit: fitStateKM },
];
const CAL_TOLERANCE = 0.05;
const SHIP_SKILL = 0.6;
const DEAD_SKILL = 0.8;

for (const cfg of CONFIGS) {
    const summary = walkForward({
        events: correctedStarts,
        seasons: ds.seasons,
        type: 'defend',
        enemy: undefined,
        fitPredictor: cfg.fit,
        momentFilter: noDefendActive,
    });
    console.log(cfg.label);
    console.log(
        `  moments=${summary.moments} (uncensored=${summary.uncensored} censored-scored=${summary.censoredScored}) EFFECTIVE N=${summary.effectiveN}`,
    );
    console.log(
        `  calibration  p25=${summary.calibration.q25.toFixed(3)}/0.250  p50=${summary.calibration.q50.toFixed(3)}/0.500  p75=${summary.calibration.q75.toFixed(3)}/0.750`,
    );
    console.log(
        `  sharpness    band median width ${summary.sharpnessHours.toFixed(1)}h vs corrected marginal IQR ${marginalIQR.toFixed(1)}h`,
    );
    console.log(
        `  skill        |true-p50| median ${summary.medianAbsErrorHours.toFixed(1)}h vs baseline ${summary.baselineMedianAbsErrorHours.toFixed(1)}h => ratio ${summary.skillRatio.toFixed(3)} (95% CI ${summary.skillRatioCI[0].toFixed(3)}-${summary.skillRatioCI[1].toFixed(3)})`,
    );

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
        `  GATE: calibration ${calOk ? 'PASS' : 'FAIL'}, skill CI [${ciLo.toFixed(3)}-${ciHi.toFixed(3)}], band ${narrower ? 'narrower' : 'NOT narrower'} => ${verdict}\n`,
    );
}

// --- scheduler-shape refit on the split populations ---------------------------

console.log('=== scheduler-shape refit (gamma, split populations) ===\n');
{
    // Lull records over ALL trains (13's walk), each labelled by whether the
    // ENDING train start is a counterattack, plus assault-active seconds
    // inside the lull (defend hazard is gated during assaults — 14).
    const trainsBySeason = new Map();
    for (const [season, list] of defendsBySeason) {
        const trains = [];
        for (const d of list) {
            if (d.isTrainStart) {
                trains.push({ s: d.start_time, e: d.end_time, startEvent: d });
            } else {
                trains.at(-1).e = d.end_time;
            }
        }
        trains.sort((a, b) => a.s - b.s);
        trainsBySeason.set(season, trains);
    }

    const all = [];
    const free = [];
    const freeNet = [];
    const counter = [];
    for (const [season, trains] of trainsBySeason) {
        const seasonAttacks = (attacksBySeason.get(season) ?? []).map((a) => ({
            s: a.start_time,
            e: a.end_time,
        }));
        for (let i = 1; i < trains.length; i++) {
            const lo = trains[i - 1].e;
            const hi = trains[i].s;
            if (hi <= lo) continue;
            const h = (hi - lo) / HOUR;
            all.push(h);
            if (counterStarts.has(trains[i].startEvent)) {
                counter.push(h);
            } else {
                free.push(h);
                freeNet.push(h - unionOverlapSeconds(seasonAttacks, lo, hi) / HOUR);
            }
        }
    }
    for (const [label, hours] of [
        ['all lulls (13 replica)     ', all],
        ['counterattack-ending lulls ', counter],
        ['free-ending lulls          ', free],
        ['free-ending, NET of assault', freeNet.filter((h) => h > 0)],
    ]) {
        const f = gammaFitOf(hours);
        console.log(
            `  ${label}: n=${f.n}  p25=${f.p25.toFixed(1)}h  p50=${f.p50.toFixed(1)}h  p75=${f.p75.toFixed(1)}h  ` +
                `CV=${f.cv.toFixed(3)}  gamma(k=${f.k.toFixed(1)}, theta=${f.theta.toFixed(1)}h)  KS=${f.ks.toFixed(3)}`,
        );
    }
    assert(counter.length > 400, 'expected the counterattack lull population');
}
