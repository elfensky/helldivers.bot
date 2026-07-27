/**
 * 02-baseline.mjs — features-free renewal hazard, the yardstick every later
 * model must beat. Empirical residual life: given `e` hours elapsed, the wait
 * distribution is (gap - e) over training gaps longer than e.
 *
 * Run: node --env-file=.env.development scripts/analysis/02-baseline.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

/**
 * Empirical residual-life predictor.
 *
 * @param {number[]} gaps training start-to-start gaps, in hours
 * @returns {(elapsedHours: number) => {p25: number, p50: number, p75: number}}
 */
function makeResidualPredictor(gaps) {
    const sorted = [...gaps].sort((a, b) => a - b);
    const maxGap = sorted.at(-1) ?? 0;

    return function predict(elapsedHours) {
        const survivors = sorted
            .filter((g) => g > elapsedHours)
            .map((g) => g - elapsedHours);

        // Beyond every observed gap there is no empirical evidence left. Fall
        // back to the shortest observed gap — the least-surprising positive
        // wait — rather than pretending to know more.
        // ponytail: crude tail fallback; replace with a fitted tail only if the
        // backtest shows the beyond-max region drives the error.
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

// --- self-check on the pure predictor -------------------------------------
{
    // Gaps of 10, 20, 30, 40 hours.
    const gaps = [10, 20, 30, 40];
    const predict = makeResidualPredictor(gaps);

    // At elapsed 0, residual life is just the gap distribution.
    const at0 = predict(0);
    assert.equal(at0.p50, 25, `expected median 25, got ${at0.p50}`);

    // At elapsed 25, only gaps 30 and 40 survive -> residuals 5 and 15.
    const at25 = predict(25);
    assert.equal(at25.p50, 10, `expected median 10, got ${at25.p50}`);

    // Past the longest gap, the predictor must still return finite numbers.
    const at100 = predict(100);
    assert(Number.isFinite(at100.p50), 'predictor returned non-finite past max gap');
    assert(at100.p25 <= at100.p50 && at100.p50 <= at100.p75, 'quantiles out of order');
}

// --- run -------------------------------------------------------------------

// A defend "chains" if it starts within this many seconds of the previous
// one ending. Shared between the chain-vs-lull decomposition below and the
// sharpness-check marginal further down, so a momentFilter-restricted config
// (LULL ONLY) is compared against the same lull-length distribution its
// walk-forward moments are actually drawn from.
const CHAIN_SECONDS = 600;

const ds = await loadDataset();

/**
 * @param {object[]} trainEvents
 * @param {object} ctx
 */
function fitPredictor(trainEvents, ctx) {
    const predictResidual = makeResidualPredictor(ctx.trainGaps);
    return function predict(moment) {
        const elapsed = (moment.t - moment.lastEvent.start_time) / HOUR;
        return predictResidual(Math.max(0, elapsed));
    };
}

/**
 * Is a defend event active at time `t`? Used to isolate the lull estimand.
 *
 * @param {number} t
 * @param {object[]} seasonEvents
 * @returns {boolean}
 */
function inLull(t, seasonEvents) {
    return !seasonEvents.some((e) => e.start_time <= t && e.end_time > t);
}

const CONFIGS = [
    // Defends show no deterministic trigger in Phase 1 (campaign-state IQR
    // ratios all landed at "no rule"; only time-since-previous-event carried
    // signal), so they are the primary target of this time-only model.
    { label: 'defend, all enemies', type: 'defend', enemy: undefined },
    // 63% of defends chain back-to-back, so the pooled defend number is
    // dominated by "wait ~= 0" and a predictor scores well by always saying
    // zero. The decision-relevant question is when a LULL ends, so it gets its
    // own configuration restricted to moments with no defend active.
    {
        label: 'defend, LULL ONLY (no defend active)',
        type: 'defend',
        enemy: undefined,
        momentFilter: inLull,
    },
    // Attacks are retained as a documented negative control: Phase 1 found
    // they are mechanically triggered (925/925 target the enemy homeworld,
    // 83.6% fire at exactly 9/10 sectors captured), so a time-only model is
    // *expected* to do poorly here. Confirming that expectation is itself
    // evidence the Phase 1 conclusion is right.
    { label: 'attack, all enemies', type: 'attack', enemy: undefined },
    { label: 'attack, Bugs (0)', type: 'attack', enemy: 0 },
    { label: 'attack, Cyborgs (1)', type: 'attack', enemy: 1 },
    { label: 'attack, Illuminate (2)', type: 'attack', enemy: 2 },
];

console.log('\n=== Phase 2: renewal baseline (empirical residual life) ===\n');

const results = [];
for (const cfg of CONFIGS) {
    const summary = walkForward({
        events: ds.events,
        seasons: ds.seasons,
        type: cfg.type,
        enemy: cfg.enemy,
        fitPredictor,
        momentFilter: cfg.momentFilter ?? null,
    });
    results.push({ cfg, summary });

    console.log(cfg.label);
    console.log(
        `  moments=${summary.moments} (uncensored=${summary.uncensored} censored-scored=${summary.censoredScored} censored-unknown=${summary.censoredUnknown} warmup-skipped=${summary.warmupSkipped})`,
    );
    console.log(
        `  EFFECTIVE N=${summary.effectiveN} distinct target events — read every figure below against THIS, not against moments`,
    );
    console.log(
        `  calibration  p25=${summary.calibration.q25.toFixed(3)}/0.250 (n=${summary.calibrationN.q25})  p50=${summary.calibration.q50.toFixed(3)}/0.500 (n=${summary.calibrationN.q50})  p75=${summary.calibration.q75.toFixed(3)}/0.750 (n=${summary.calibrationN.q75})`,
    );
    console.log(
        `  sharpness    p25-p75 band median width = ${summary.sharpnessHours.toFixed(1)}h`,
    );
    console.log(
        `  skill        median |true-p50| = ${summary.medianAbsErrorHours.toFixed(1)}h  vs baseline ${summary.baselineMedianAbsErrorHours.toFixed(1)}h  => ratio ${summary.skillRatio.toFixed(3)} (95% CI ${summary.skillRatioCI[0].toFixed(3)}-${summary.skillRatioCI[1].toFixed(3)})\n`,
    );
}

// --- defend two-part estimand ---------------------------------------------

console.log('=== Defend: chain-vs-lull decomposition ===\n');
{
    const bySeason = new Map();
    for (const e of ds.events.filter((x) => x.type === 'defend')) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }
    let chains = 0;
    let total = 0;
    const lulls = [];
    for (const [, list] of bySeason) {
        for (let i = 1; i < list.length; i++) {
            const idle = list[i].start_time - list[i - 1].end_time;
            total++;
            if (idle <= CHAIN_SECONDS) chains++;
            else lulls.push(idle / HOUR);
        }
    }
    console.log(
        `P(chain within 10 min of a defend ending) = ${(chains / total).toFixed(3)}  (n=${total})`,
    );
    console.log(
        `Given NO chain, lull length hours: p25=${(quantileOf(lulls, 0.25) ?? 0).toFixed(1)}  p50=${(quantileOf(lulls, 0.5) ?? 0).toFixed(1)}  p75=${(quantileOf(lulls, 0.75) ?? 0).toFixed(1)}  (n=${lulls.length})\n`,
    );
}

// --- decision gate ---------------------------------------------------------

const CAL_TOLERANCE = 0.05;
const SHIP_SKILL = 0.6;
const DEAD_SKILL = 0.8;

console.log('=== Decision gate ===\n');
for (const { cfg, summary } of results) {
    const calOk =
        Math.abs(summary.calibration.q25 - 0.25) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q50 - 0.5) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q75 - 0.75) <= CAL_TOLERANCE;

    // The gate is read against the CI, not the point estimate. With effective N
    // in the hundreds, a point estimate of 0.59 with a CI spanning 0.45-0.78 is
    // not evidence of clearing a 0.6 bar.
    const [ciLo, ciHi] = summary.skillRatioCI;

    let verdict;
    if (calOk && ciHi <= SHIP_SKILL) {
        verdict = 'SHIP-WORTHY (pending the sharpness check below)';
    } else if (ciLo > DEAD_SKILL) {
        verdict = 'NOT USEFULLY PREDICTABLE';
    } else if (calOk && summary.skillRatio <= SHIP_SKILL) {
        verdict = 'PROMISING BUT UNDERPOWERED — point estimate passes, CI does not';
    } else {
        verdict = 'INCONCLUSIVE — try Phase 3 features';
    }

    console.log(
        `${cfg.label}: calibration ${calOk ? 'PASS' : 'FAIL'}, skill ${summary.skillRatio.toFixed(3)} [${ciLo.toFixed(3)}-${ciHi.toFixed(3)}], effN=${summary.effectiveN} => ${verdict}`,
    );
}

console.log(
    `\nSharpness check: compare each band width above against that configuration's own unconditional marginal IQR below (lull-length for a momentFilter config, gap otherwise). Ship-worthy requires the band to be NARROWER than that marginal — otherwise the model is only restating the marginal distribution.`,
);

// Unconditional marginal IQR per config, for that comparison. A
// momentFilter-restricted config (e.g. LULL ONLY) only ever evaluates
// moments with no event active, so its correct marginal is the lull-length
// distribution (idle time strictly greater than the chain threshold) — NOT
// the raw start-to-start gap. Comparing against the raw gap would silently
// print the pooled config's marginal for both rows, understating how wide
// the LULL ONLY band needs to beat.
console.log('\nUnconditional gap/lull-length IQR (hours) — marginal each config is');
console.log('actually evaluated against (lull-length for a momentFilter config, raw');
console.log('start-to-start gap otherwise):');
for (const cfg of CONFIGS) {
    const list = ds.events
        .filter(
            (e) =>
                e.type === cfg.type && (cfg.enemy === undefined || e.enemy === cfg.enemy),
        )
        .sort((a, b) => a.season - b.season || a.start_time - b.start_time);

    const values = [];
    for (let i = 1; i < list.length; i++) {
        if (list[i].season !== list[i - 1].season) continue;
        if (cfg.momentFilter) {
            const idleSeconds = list[i].start_time - list[i - 1].end_time;
            if (idleSeconds > CHAIN_SECONDS) values.push(idleSeconds / HOUR);
        } else {
            values.push((list[i].start_time - list[i - 1].start_time) / HOUR);
        }
    }
    const iqr = (quantileOf(values, 0.75) ?? 0) - (quantileOf(values, 0.25) ?? 0);
    const marginalKind = cfg.momentFilter ? 'lull-length' : 'gap';
    console.log(
        `  ${cfg.label}: ${iqr.toFixed(1)}h (${marginalKind}, n=${values.length})`,
    );
}
