/**
 * 18-outcome-composite.mjs — attempt 5: the outcome-conditioned compositional
 * model for the ATTACK state, through the pre-registered gate (#486).
 *
 * `15-counterattack-target.mjs` showed the corrected-target STATE-KM fails
 * calibration and sharpness, and the failure lives in the assault epochs: a
 * free wave must wait out (rest of assault) + (counterattack train) + (a
 * fresh draw), and the KM cell cannot see where in that pipeline the moment
 * sits. Every component is now measured (`17-assault-outcome.mjs`):
 *
 *   - P(fail | assault still running at elapsed e): 0.59 -> 0.97, stable
 *     across history halves — fit walk-forward as a survival ratio.
 *   - fail branch: counterattack at the 48h timeout (+minutes, #480), then a
 *     counterattack-specific train (p50 7.3h — much longer than normal
 *     trains, first-defend win rate 0.226 vs 0.467), then a FRESH
 *     end-anchored draw (after-counterattack gaps ~ after-normal gaps,
 *     KS 0.161).
 *   - success branch: assault ends at a duration drawn from the success
 *     distribution conditioned on > e, then the HELD clock releases — the
 *     after-success gap distribution has p50 = 0.0h (the gated fire spikes
 *     at release; KS 0.733 vs a fresh draw) — so the empirical after-success
 *     gap distribution is used as-is, spike included.
 *
 * PRE-DECLARED DESIGN — written before the first gate run, not tuned after:
 *   - COMPOSITE predicts exactly like the corrected-target STATE-KM at
 *     every non-ATTACK moment. At ATTACK moments it draws N=400 seeded
 *     Monte-Carlo futures from the mixture above (earliest active assault;
 *     all component distributions fit on seasons < test season) and reports
 *     their p25/p50/p75. If any component distribution has fewer than 30
 *     training samples, the moment falls back to the STATE-KM cell.
 *   - If no training success duration exceeds e (deep into the timeout),
 *     the success branch is dead: P_fail = 1.
 *   - The verdict conditioning from 17 § 2 (S157+, n=7 events) is NOT used —
 *     too thin to fit; declared out of scope for this model.
 *   - Gate (unchanged): calibration ±0.05 at p25/p50/p75, skill-ratio CI
 *     upper <= 0.6, band narrower than the corrected marginal (recomputed
 *     here). Additionally reported: the paired ATTACK-moment comparison vs
 *     STATE-KM (adoption rule for the ATTACK cell: season-bootstrap CI
 *     upper of the paired median-|err| ratio < 1).
 *
 * Run: node --env-file=.env.development scripts/analysis/18-outcome-composite.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, makeRng, HOUR, SECTOR_COUNT } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const KNN_K = 200;
const MIN_CELL = 30;
const STEP_HOURS = 3;
const ASSAULT_TIMEOUT_H = 48;
const MC_DRAWS = 400;
const MIN_COMPONENT_N = 30;
const BOOTSTRAP = 500;

// --- pure helpers (KM/kNN/residual duplicated from 07/15 per convention) -----

/**
 * Empirical residual-life predictor — same as 02/04/07/15.
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
 * K nearest samples by |elapsed| — same as 07/15.
 *
 * @param {{elapsed: number}[]} samples sorted by elapsed asc
 * @param {number} elapsed @param {number} k
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
 * Kaplan-Meier product-limit quantiles — same as 07/15.
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
 * Uniform draw from an empirical sample array.
 *
 * @param {number[]} xs non-empty
 * @param {() => number} rng
 * @returns {number}
 */
function drawFrom(xs, rng) {
    return xs[Math.floor(rng() * xs.length)];
}

/**
 * The ATTACK-moment Monte-Carlo mixture (see header). Pure so the fixture
 * below can pin it without a DB.
 *
 * @param {object} c fitted components:
 *   {failDur: number[], succDur: number[], ctTrainDur: number[],
 *    afterCt: number[], afterSuccess: number[]}
 * @param {number} elapsedH hours since the earliest active assault started
 * @param {() => number} rng seeded
 * @param {number} draws
 * @returns {{p25: number, p50: number, p75: number}}
 */
function compositeQuantiles(c, elapsedH, rng, draws) {
    const restOfTimeoutH = Math.max(0, ASSAULT_TIMEOUT_H - elapsedH);
    const succSurvivors = c.succDur.filter((d) => d > elapsedH);
    const failsAtRisk = c.failDur.filter((d) => d > elapsedH).length;
    const pFail =
        succSurvivors.length + failsAtRisk > 0 ?
            failsAtRisk / (succSurvivors.length + failsAtRisk)
        :   1;
    const samples = [];
    for (let i = 0; i < draws; i++) {
        if (succSurvivors.length === 0 || rng() < pFail) {
            samples.push(
                restOfTimeoutH + drawFrom(c.ctTrainDur, rng) + drawFrom(c.afterCt, rng),
            );
        } else {
            samples.push(
                drawFrom(succSurvivors, rng) - elapsedH + drawFrom(c.afterSuccess, rng),
            );
        }
    }
    return {
        p25: quantileOf(samples, 0.25),
        p50: quantileOf(samples, 0.5),
        p75: quantileOf(samples, 0.75),
    };
}

/**
 * Season-block bootstrap CI of the paired median-|err| ratio — same
 * machinery as 16.
 *
 * @param {{season: number, a: number, b: number}[]} pairs
 * @param {() => number} rng @param {number} draws
 * @returns {{ratio: number, ci: [number, number]}}
 */
function pairedMedianRatioCI(pairs, rng, draws) {
    const med = (xs) => quantileOf(xs, 0.5);
    const ratio = med(pairs.map((p) => p.a)) / med(pairs.map((p) => p.b));
    const seasonIds = [...new Set(pairs.map((p) => p.season))];
    const bySeason = new Map(
        seasonIds.map((s) => [s, pairs.filter((p) => p.season === s)]),
    );
    const ratios = [];
    for (let d = 0; d < draws; d++) {
        const sample = [];
        for (let i = 0; i < seasonIds.length; i++) {
            sample.push(...bySeason.get(seasonIds[Math.floor(rng() * seasonIds.length)]));
        }
        const ma = med(sample.map((p) => p.a));
        const mb = med(sample.map((p) => p.b));
        if (ma !== null && mb !== null && mb > 0) ratios.push(ma / mb);
    }
    ratios.sort((x, y) => x - y);
    return {
        ratio,
        ci: [quantileOf(ratios, 0.025) ?? ratio, quantileOf(ratios, 0.975) ?? ratio],
    };
}

// --- pure self-checks (no DB) ------------------------------------------------

{
    // compositeQuantiles in a fully deterministic world: assaults always fail
    // (no successes survive), counterattack trains take exactly 5h, the next
    // draw exactly 30h. At elapsed 40h the answer is exactly 8 + 5 + 30.
    const c = {
        failDur: [48, 48, 48],
        succDur: [],
        ctTrainDur: [5],
        afterCt: [30],
        afterSuccess: [0],
    };
    const q = compositeQuantiles(c, 40, makeRng(1), 100);
    assert.deepEqual(q, { p25: 43, p50: 43, p75: 43 });

    // All-success world with the release spike: assault ends at 30h, held
    // clock releases immediately -> at elapsed 20h the wait is exactly 10h.
    const cs = {
        failDur: [],
        succDur: [30, 30, 30],
        ctTrainDur: [5],
        afterCt: [30],
        afterSuccess: [0],
    };
    const qs = compositeQuantiles(cs, 20, makeRng(2), 100);
    assert.deepEqual(qs, { p25: 10, p50: 10, p75: 10 });

    // Mixture world: the p25/p75 must straddle the two branches.
    const cm = {
        failDur: [48, 48],
        succDur: [30, 30],
        ctTrainDur: [5],
        afterCt: [30],
        afterSuccess: [0],
    };
    const qm = compositeQuantiles(cm, 20, makeRng(3), 2000);
    assert(
        qm.p25 === 10 && qm.p75 === 63,
        `mixture straddles, got ${JSON.stringify(qm)}`,
    );

    // Determinism.
    assert.deepEqual(
        compositeQuantiles(cm, 20, makeRng(3), 2000),
        qm,
        'seeded MC must be deterministic',
    );
}

{
    // Paired ratio machinery: planted 2x gap detected (same fixture class as 16).
    const rng = makeRng(880002);
    const pairs = [];
    for (let s = 0; s < 20; s++) {
        for (let i = 0; i < 30; i++) {
            const b = 5 + rng() * 10;
            pairs.push({ season: s, a: b / 2, b });
        }
    }
    const r = pairedMedianRatioCI(pairs, makeRng(770002), 200);
    assert(Math.abs(r.ratio - 0.5) < 0.05 && r.ci[1] < 1, 'planted gap detected');
}

console.log('=== 18-outcome-composite: pure self-checks OK ===');

// --- data --------------------------------------------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const attacks = ds.events.filter((e) => e.type === 'attack');
const trainStarts = allDefends.filter((e) => e.isTrainStart);
const correctedStarts = trainStarts.filter((e) => !e.isCounterattack);
assert(
    trainStarts.length - correctedStarts.length > 400,
    'expected the counterattack labels from dataset.mjs',
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

// Trains with counterattack flags, per season (17's walk, duplicated).
const trainsBySeason = new Map();
for (const [season, list] of defendsBySeason) {
    const trains = [];
    for (const enemy of [0, 1, 2]) {
        for (const d of list.filter((e) => e.enemy === enemy)) {
            if (d.isTrainStart) {
                trains.push({
                    season,
                    enemy,
                    s: d.start_time,
                    e: d.end_time,
                    startEvent: d,
                });
            } else {
                trains.at(-1).e = d.end_time;
            }
        }
    }
    trains.sort((a, b) => a.s - b.s);
    trainsBySeason.set(season, trains);
}

// Per-season component observations, aggregated walk-forward at fit time.
const componentsBySeason = new Map();
for (const [season, trains] of trainsBySeason) {
    const comp = {
        failDur: [],
        succDur: [],
        ctTrainDur: [],
        afterCt: [],
        afterSuccess: [],
    };
    for (const a of attacksBySeason.get(season) ?? []) {
        const durH = (a.end_time - a.start_time) / HOUR;
        if (a.status === 'fail') comp.failDur.push(durH);
        if (a.status === 'success') {
            comp.succDur.push(durH);
            const next = trains.find(
                (tr) => tr.s >= a.end_time && !tr.startEvent.isCounterattack,
            );
            if (next) comp.afterSuccess.push((next.s - a.end_time) / HOUR);
        }
    }
    for (let i = 0; i < trains.length; i++) {
        if (!trains[i].startEvent.isCounterattack) continue;
        comp.ctTrainDur.push((trains[i].e - trains[i].s) / HOUR);
        const next = trains.slice(i + 1).find((tr) => !tr.startEvent.isCounterattack);
        if (next && next.s > trains[i].e) {
            comp.afterCt.push((next.s - trains[i].e) / HOUR);
        }
    }
    componentsBySeason.set(season, comp);
}

/**
 * Sectors captured — same formula as 01/06/07/15.
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
 * Observable state + earliest active assault at a moment.
 *
 * @param {number} season @param {number} t
 * @returns {{state: string, earliestAttackStart: number|null}}
 */
function stateDetailAt(season, t) {
    const active = (attacksBySeason.get(season) ?? []).filter(
        (a) => a.start_time <= t && a.end_time > t,
    );
    if (active.length > 0) {
        return {
            state: 'ATTACK',
            earliestAttackStart: Math.min(...active.map((a) => a.start_time)),
        };
    }
    const scs = [0, 1, 2]
        .map((en) => sectorsCapturedAt(season, en, t))
        .filter((v) => v !== null);
    const maxSC = scs.length > 0 ? Math.max(...scs) : null;
    return {
        state:
            maxSC === 9 ? 'SC9'
            : maxSC === 10 ? 'SC10'
            : 'NORMAL',
        earliestAttackStart: null,
    };
}

// Moment samples over the CORRECTED series — 15 replica.
const momentSamplesBySeason = new Map();
for (const [season, list] of defendsBySeason) {
    const span = ds.seasons.get(season);
    if (!span || span.spanSeconds === 0) continue;
    const starts = list.filter((e) => e.isTrainStart && !e.isCounterattack);
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
            state: stateDetailAt(season, t).state,
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
 * walkForward momentFilter — same as 07/15.
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
 * BASELINE — featureless residual life (04/15 replica).
 *
 * @param {object[]} trainEvents @param {object} ctx
 */
function fitBaseline(trainEvents, ctx) {
    const predictResidual = makeResidualPredictor(ctx.trainGaps);
    return (moment) =>
        predictResidual(Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR));
}

/**
 * Build the corrected-target STATE-KM predictor (15 replica). Factored out so
 * COMPOSITE can delegate its non-ATTACK (and fallback) moments to the exact
 * same predictions.
 *
 * @param {number} testSeason
 * @returns {(moment: object) => {p25: number, p50: number, p75: number}}
 */
function buildStateKMPredict(testSeason) {
    const byState = new Map();
    const pooled = [];
    for (const [season, samples] of momentSamplesBySeason) {
        if (season >= testSeason) continue;
        for (const s of samples) {
            assert(s.season < testSeason, 'state sample from a non-training season');
            if (!byState.has(s.state)) byState.set(s.state, []);
            byState.get(s.state).push(s);
            pooled.push(s);
        }
    }
    for (const arr of byState.values()) arr.sort((a, b) => a.elapsed - b.elapsed);
    pooled.sort((a, b) => a.elapsed - b.elapsed);
    return function predict(moment) {
        const state = stateDetailAt(moment.season, moment.t).state;
        const elapsed = Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR);
        const cell = byState.get(state) ?? [];
        const samples = cell.length >= MIN_CELL ? cell : pooled;
        assert(samples.length > 0, 'no training samples available');
        return kmQuantiles(nearestSamples(samples, elapsed, KNN_K));
    };
}

/** @param {object[]} trainEvents @param {object} ctx */
function fitStateKM(trainEvents, ctx) {
    return buildStateKMPredict(ctx.testSeason);
}

// Branch bookkeeping for the paired ATTACK-subset comparison.
const compositeBranch = new Map();

/**
 * COMPOSITE — STATE-KM everywhere except ATTACK moments, which get the
 * Monte-Carlo mixture (see header).
 *
 * @param {object[]} trainEvents @param {object} ctx
 */
function fitComposite(trainEvents, ctx) {
    const kmPredict = buildStateKMPredict(ctx.testSeason);
    const comp = {
        failDur: [],
        succDur: [],
        ctTrainDur: [],
        afterCt: [],
        afterSuccess: [],
    };
    for (const [season, c] of componentsBySeason) {
        if (season >= ctx.testSeason) continue;
        for (const key of Object.keys(comp)) comp[key].push(...c[key]);
    }
    const componentsOk = Object.values(comp).every((xs) => xs.length >= MIN_COMPONENT_N);
    const rng = makeRng(180001 + ctx.testSeason);
    return function predict(moment) {
        const detail = stateDetailAt(moment.season, moment.t);
        const key = `${moment.season}:${moment.t}`;
        if (detail.state !== 'ATTACK' || !componentsOk) {
            compositeBranch.set(key, detail.state === 'ATTACK' ? 'fallback' : 'km');
            return kmPredict(moment);
        }
        compositeBranch.set(key, 'ATTACK');
        const elapsedH = (moment.t - detail.earliestAttackStart) / HOUR;
        return compositeQuantiles(comp, elapsedH, rng, MC_DRAWS);
    };
}

// --- walk-forward + gate ------------------------------------------------------

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
    `\ncorrected marginal: n=${correctedGaps.length} IQR=${marginalIQR.toFixed(1)}h  ` +
        `targets=${correctedStarts.length} (of ${trainStarts.length} train starts)`,
);

const CAL_TOLERANCE = 0.05;
const SHIP_SKILL = 0.6;
const DEAD_SKILL = 0.8;
const CONFIGS = [
    { label: 'BASELINE (corrected)', fit: fitBaseline },
    { label: 'STATE-KM (corrected)', fit: fitStateKM },
    { label: 'COMPOSITE (outcome-conditioned ATTACK cell)', fit: fitComposite },
];

const runs = new Map();
console.log('\n=== corrected-target walk-forward ===\n');
for (const cfg of CONFIGS) {
    const summary = walkForward({
        events: correctedStarts,
        seasons: ds.seasons,
        type: 'defend',
        enemy: undefined,
        fitPredictor: cfg.fit,
        momentFilter: noDefendActive,
    });
    runs.set(cfg.label, summary);
    const calOk =
        Math.abs(summary.calibration.q25 - 0.25) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q50 - 0.5) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q75 - 0.75) <= CAL_TOLERANCE;
    const [ciLo, ciHi] = summary.skillRatioCI;
    const narrower = summary.sharpnessHours < marginalIQR;
    let verdict;
    if (calOk && ciHi <= SHIP_SKILL && narrower) verdict = 'SHIP-WORTHY';
    else if (ciLo > DEAD_SKILL) verdict = 'NOT USEFULLY PREDICTABLE';
    else if (calOk && summary.skillRatio <= SHIP_SKILL) {
        verdict = 'PROMISING BUT UNDERPOWERED';
    } else verdict = 'INCONCLUSIVE';
    console.log(cfg.label);
    console.log(
        `  calibration  p25=${summary.calibration.q25.toFixed(3)}  p50=${summary.calibration.q50.toFixed(3)}  p75=${summary.calibration.q75.toFixed(3)} (${calOk ? 'PASS' : 'FAIL'})`,
    );
    console.log(
        `  sharpness    ${summary.sharpnessHours.toFixed(1)}h vs marginal ${marginalIQR.toFixed(1)}h (${narrower ? 'narrower' : 'NOT narrower'})`,
    );
    console.log(
        `  skill        ${summary.medianAbsErrorHours.toFixed(1)}h vs ${summary.baselineMedianAbsErrorHours.toFixed(1)}h => ${summary.skillRatio.toFixed(3)} [${ciLo.toFixed(3)}-${ciHi.toFixed(3)}]  => ${verdict}\n`,
    );
}

// --- paired ATTACK-subset comparison (adoption rule) --------------------------

console.log('=== paired ATTACK-moment comparison: COMPOSITE vs STATE-KM ===');
{
    const km = runs.get('STATE-KM (corrected)');
    const co = runs.get('COMPOSITE (outcome-conditioned ATTACK cell)');
    const kmByKey = new Map(km.records.map((r) => [`${r.season}:${r.t}`, r]));
    const pairs = [];
    let censoredSkipped = 0;
    let fallbackCount = 0;
    for (const r of co.records) {
        const key = `${r.season}:${r.t}`;
        const branch = compositeBranch.get(key);
        if (branch === 'fallback') fallbackCount++;
        if (branch !== 'ATTACK') continue;
        const kmR = kmByKey.get(key);
        assert(kmR, `unpaired moment ${key}`);
        if (r.wait === null) {
            censoredSkipped++;
            continue;
        }
        assert.equal(kmR.wait, r.wait, 'paired moments must share the true wait');
        pairs.push({
            season: r.season,
            a: Math.abs(r.wait - r.q50),
            b: Math.abs(kmR.wait - kmR.q50),
        });
    }
    assert(
        pairs.length > 1000,
        `expected thousands of ATTACK pairs, got ${pairs.length}`,
    );
    const { ratio, ci } = pairedMedianRatioCI(pairs, makeRng(180731), BOOTSTRAP);
    const med = (xs) => quantileOf(xs, 0.5);
    console.log(
        `  paired uncensored n=${pairs.length} (censored skipped=${censoredSkipped}, early-season fallbacks=${fallbackCount}, seasons=${new Set(pairs.map((p) => p.season)).size})`,
    );
    console.log(
        `  median |err|: COMPOSITE ${med(pairs.map((p) => p.a)).toFixed(1)}h vs STATE-KM ${med(pairs.map((p) => p.b)).toFixed(1)}h  ` +
            `ratio=${ratio.toFixed(3)} (95% CI ${ci[0].toFixed(3)}-${ci[1].toFixed(3)})  ` +
            `win rate=${(pairs.filter((p) => p.a < p.b).length / pairs.length).toFixed(3)}`,
    );
    console.log(
        ci[1] < 1 ?
            '  ADOPT (pre-registered rule): the mechanistic ATTACK cell beats the KM cell.'
        :   '  DO NOT ADOPT: not better under the pre-registered rule.',
    );
}
