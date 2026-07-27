/**
 * 04-train-baseline.mjs — the corrected-target renewal baseline for #472.
 *
 * v0.69.0 measured a defend-timing predictor against the wrong target: all
 * 4,928 defend-to-defend gaps, a bimodal distribution dominated by ~2.5h
 * mechanical chain gaps (a defend train continues iff the previous defend
 * FAILED — 96.9% vs 0.1%, see dataset.mjs), used to predict ~44h waits. This
 * script trains AND evaluates on the correct series instead: train-start-to
 * -train-start gaps (n=1,976 events / 1,816 gaps, CV 0.45 vs the pooled
 * series' CV 1.32).
 *
 * Method is identical to 02-baseline.mjs (empirical residual life through
 * `walkForward`) — see that file for the predictor rationale. Only the event
 * set changes. No harness change: `walkForward` filters
 * `events.filter(e => e.type === type && ...)`, so passing an
 * already-restricted array (train starts only) makes that filter a no-op.
 *
 * Run: node --env-file=.env.development scripts/analysis/04-train-baseline.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR, makeRng } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

// --- pure helpers ------------------------------------------------------------

/**
 * Empirical residual-life predictor. Identical to 02-baseline.mjs's function
 * of the same name — duplicated rather than imported because 02-baseline.mjs
 * is a script, not a library, and `lib/backtest.mjs` may not be modified to
 * add a new export surface for it.
 *
 * @param {number[]} gaps training start-to-start gaps, in hours
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
 * Build a season -> list-of-defends index, for active-interval lookups.
 *
 * @param {object[]} allDefends every defend event (not just train starts)
 * @returns {Map<number, object[]>}
 */
function buildActiveIndex(allDefends) {
    const index = new Map();
    for (const e of allDefends) {
        if (!index.has(e.season)) index.set(e.season, []);
        index.get(e.season).push(e);
    }
    return index;
}

/**
 * True when no defend event is active in `season` at time `t`. A train
 * cannot start while a defend is running — this is the moment filter that
 * keeps the walk-forward clock off physically-impossible ticks (inside the
 * chain of a just-started train, where no NEW train could begin).
 *
 * @param {Map<number, object[]>} activeIndex from buildActiveIndex
 * @param {number} season
 * @param {number} t unix seconds
 * @returns {boolean}
 */
function isNoDefendActive(activeIndex, season, t) {
    const list = activeIndex.get(season) ?? [];
    return !list.some((e) => e.start_time <= t && e.end_time > t);
}

/**
 * Concentration ratio. Zero denominator with a non-zero numerator is
 * Infinity (maximally un-concentrated) — the honest reading. Same
 * convention as 01-trigger-hunt.mjs's `ratio()`.
 *
 * @param {number} eventSpread
 * @param {number} controlSpread
 * @returns {number}
 */
function concentrationRatio(eventSpread, controlSpread) {
    if (eventSpread === 0) return 0;
    if (controlSpread === 0) return Infinity;
    return eventSpread / controlSpread;
}

/**
 * @param {number[]} values
 * @returns {{n: number, p25: number|null, p75: number|null, iqr: number, span: number}}
 */
function summarizeVar(values) {
    const p05 = quantileOf(values, 0.05);
    const p25 = quantileOf(values, 0.25);
    const p75 = quantileOf(values, 0.75);
    const p95 = quantileOf(values, 0.95);
    return {
        n: values.length,
        p25,
        p75,
        iqr: p25 !== null && p75 !== null ? p75 - p25 : 0,
        span: p05 !== null && p95 !== null ? p95 - p05 : 0,
    };
}

/**
 * The previous-train stats a HYPOTHETICAL train start would inherit at
 * instant `t`: the length/failures of the most recently COMPLETED train in
 * this season, i.e. whatever the next actual train start (whenever it
 * occurs) will carry as its own prevTrainLength/prevTrainFailures. Only
 * meaningful when `t` sits in a lull — callers must reject `t` where a
 * defend is active before calling this (a hypothetical new train can't start
 * while one is already running, same rule as `isNoDefendActive`).
 *
 * @param {object[]} seasonTrainStarts train-start events for ONE season,
 *   sorted ascending by start_time (each carries prevTrainLength/prevTrainFailures)
 * @param {number} t unix seconds
 * @returns {{length: number, failures: number}|null} null if there is no
 *   later train start in this season, or if that next train start is itself
 *   the season's first train (no preceding train exists yet)
 */
function prevTrainStatsAt(seasonTrainStarts, t) {
    const next = seasonTrainStarts.find((e) => e.start_time > t);
    if (!next || next.prevTrainLength === null) return null;
    return { length: next.prevTrainLength, failures: next.prevTrainFailures };
}

/**
 * Permutation p-value for "event values are more concentrated than
 * controls". Identical method to 01-trigger-hunt.mjs's `permutationP` —
 * duplicated locally rather than imported since 01-trigger-hunt.mjs is a
 * script, not a library.
 *
 * @param {number[]} eventVals
 * @param {number[]} controlVals
 * @param {() => number} rand
 * @param {number} permutations
 * @returns {number} p-value
 */
function permutationPValue(eventVals, controlVals, rand, permutations) {
    const observed = concentrationRatio(
        summarizeVar(eventVals).iqr,
        summarizeVar(controlVals).iqr,
    );
    if (!Number.isFinite(observed)) return 1;

    const pool = [...eventVals, ...controlVals];
    const nA = eventVals.length;
    let atLeastAsExtreme = 0;

    for (let p = 0; p < permutations; p++) {
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const permRatio = concentrationRatio(
            summarizeVar(shuffled.slice(0, nA)).iqr,
            summarizeVar(shuffled.slice(nA)).iqr,
        );
        if (Number.isFinite(permRatio) && permRatio <= observed) {
            atLeastAsExtreme++;
        }
    }
    // Add-one smoothing: a p-value of exactly 0 is never honest from a finite sample.
    return (atLeastAsExtreme + 1) / (permutations + 1);
}

// --- self-checks on the pure helpers (no DB) --------------------------------

{
    // makeResidualPredictor — same fixture as 02-baseline.mjs.
    const gaps = [10, 20, 30, 40];
    const predict = makeResidualPredictor(gaps);
    assert.equal(predict(0).p50, 25, 'expected median 25 at elapsed 0');
    assert.equal(predict(25).p50, 10, 'expected median 10 at elapsed 25');
    const at100 = predict(100);
    assert(Number.isFinite(at100.p50), 'predictor returned non-finite past max gap');
    assert(at100.p25 <= at100.p50 && at100.p50 <= at100.p75, 'quantiles out of order');
}

{
    // buildActiveIndex / isNoDefendActive
    const fakeDefends = [
        { season: 1, start_time: 100, end_time: 200 },
        { season: 1, start_time: 500, end_time: 600 },
        { season: 2, start_time: 1000, end_time: 1100 },
    ];
    const idx = buildActiveIndex(fakeDefends);
    assert.equal(
        isNoDefendActive(idx, 1, 150),
        false,
        'must be false while a defend is active',
    );
    assert.equal(
        isNoDefendActive(idx, 1, 300),
        true,
        'must be true in a gap between defends',
    );
    assert.equal(isNoDefendActive(idx, 1, 100), false, 'interval start is inclusive');
    assert.equal(isNoDefendActive(idx, 1, 200), true, 'interval end is exclusive');
    assert.equal(
        isNoDefendActive(idx, 3, 5000),
        true,
        'a season with no defends has nothing active',
    );
}

{
    // concentrationRatio / summarizeVar / prevTrainStatsAt
    assert.equal(concentrationRatio(0, 4), 0, 'zero numerator ratio');
    assert.equal(concentrationRatio(2, 0), Infinity, 'zero denominator ratio');

    const spread = summarizeVar([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(spread.n, 10);
    assert(spread.iqr > 0, 'iqr should be positive for a spread sample');
    const flat = summarizeVar([7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
    assert.equal(flat.iqr, 0, 'iqr of a constant sample is 0');

    const fakeTrainStarts = [
        { season: 1, start_time: 0, prevTrainLength: null, prevTrainFailures: null },
        { season: 1, start_time: 1000, prevTrainLength: 3, prevTrainFailures: 2 },
        { season: 1, start_time: 2000, prevTrainLength: 5, prevTrainFailures: 4 },
    ];
    assert.equal(
        prevTrainStatsAt(fakeTrainStarts, 500)?.length,
        3,
        "a lull before the 2nd train start should report the 1st train's stats",
    );
    assert.equal(
        prevTrainStatsAt(fakeTrainStarts, 1500)?.length,
        5,
        "a lull before the 3rd train start should report the 2nd train's stats",
    );
    assert.equal(
        prevTrainStatsAt(fakeTrainStarts, 2500),
        null,
        'past every train start there is no next train to report',
    );

    // permutationPValue: an obviously concentrated event sample against a
    // spread-out control sample must land a low p-value.
    const rng = makeRng(1);
    const p = permutationPValue(
        [5, 5, 5, 5, 5],
        [1, 10, 20, 30, 40, 50, 60, 70],
        rng,
        500,
    );
    assert(
        p < 0.2,
        `expected a low p-value for an obviously concentrated sample, got ${p}`,
    );
}

console.log('\n=== Phase 4: train-start baseline — pure self-checks OK ===');

// --- run (DB-dependent) -----------------------------------------------------

const ds = await loadDataset();

const allDefends = ds.events.filter((e) => e.type === 'defend');
const trainStarts = ds.events.filter((e) => e.type === 'defend' && e.isTrainStart);

// The restricted event set must be a proper, non-trivial subset of all
// defends — the same relationship dataset.mjs's own self-check pins, checked
// again here because this script's correctness depends on it directly (a
// regression upstream would otherwise silently feed walkForward the wrong
// series with no local signal).
assert(
    trainStarts.length > 0 && trainStarts.length < allDefends.length,
    `train starts (${trainStarts.length}) should be a proper subset of defends (${allDefends.length})`,
);
console.log(
    `train starts: ${trainStarts.length} of ${allDefends.length} defends (${((trainStarts.length / allDefends.length) * 100).toFixed(1)}%)`,
);

const activeIndex = buildActiveIndex(allDefends);

/**
 * momentFilter for walkForward: a train cannot start while a defend is
 * running. `walkForward` does not pass the season as a separate argument —
 * it is derived here from the moment's own `seasonEvents` (guaranteed
 * non-empty and single-season by the caller, see backtest.mjs).
 *
 * @param {number} t
 * @param {object[]} seasonEvents
 * @returns {boolean}
 */
function noDefendActive(t, seasonEvents) {
    const season = seasonEvents[0]?.season;
    return isNoDefendActive(activeIndex, season, t);
}

// --- train-start gap marginal (the correct sharpness comparator) -----------
//
// A prior review caught exactly this class of mistake: comparing a band
// against the wrong marginal silently flips a gate leg. The sharpness
// comparator here is the TRAIN-START gap IQR, not the pooled-defend gap IQR
// used in 02-baseline.mjs.
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
const trainStartGapP25 = quantileOf(trainStartGaps, 0.25) ?? 0;
const trainStartGapP50 = quantileOf(trainStartGaps, 0.5) ?? 0;
const trainStartGapP75 = quantileOf(trainStartGaps, 0.75) ?? 0;
const trainStartGapIQR = trainStartGapP75 - trainStartGapP25;

console.log(
    `train-start gap marginal: n=${trainStartGaps.length}  p25=${trainStartGapP25.toFixed(1)}h  p50=${trainStartGapP50.toFixed(1)}h  p75=${trainStartGapP75.toFixed(1)}h  IQR=${trainStartGapIQR.toFixed(1)}h`,
);

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

const CONFIGS = [
    // Unrestricted: the walk-forward clock also ticks through moments where a
    // just-started train is still chaining (a defend is active), which are
    // physically impossible instants for a NEW train to begin. Included for
    // comparison against the restricted config below, not as the
    // decision-relevant number.
    {
        label: 'train starts, all enemies (unrestricted moments)',
        type: 'defend',
        enemy: undefined,
    },
    // The decision-relevant config: moments restricted to lulls, matching the
    // physical constraint that a train cannot start while a defend is
    // running.
    {
        label: 'train starts, all enemies (NO DEFEND ACTIVE moment filter)',
        type: 'defend',
        enemy: undefined,
        momentFilter: noDefendActive,
    },
];

console.log('\n=== Phase 4: train-start baseline (empirical residual life) ===\n');

const results = [];
for (const cfg of CONFIGS) {
    const summary = walkForward({
        events: trainStarts,
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
        `  uncensored-only calibration (diagnostic, NOT the gate)  p25=${summary.calibrationUncensored.q25.toFixed(3)}/0.250 (n=${summary.calibrationUncensoredN.q25})  p50=${summary.calibrationUncensored.q50.toFixed(3)}/0.500 (n=${summary.calibrationUncensoredN.q50})  p75=${summary.calibrationUncensored.q75.toFixed(3)}/0.750 (n=${summary.calibrationUncensoredN.q75})`,
    );
    console.log(
        `  sharpness    p25-p75 band median width = ${summary.sharpnessHours.toFixed(1)}h  (train-start gap IQR marginal = ${trainStartGapIQR.toFixed(1)}h)`,
    );
    console.log(
        `  skill        median |true-p50| = ${summary.medianAbsErrorHours.toFixed(1)}h  vs baseline ${summary.baselineMedianAbsErrorHours.toFixed(1)}h  => ratio ${summary.skillRatio.toFixed(3)} (95% CI ${summary.skillRatioCI[0].toFixed(3)}-${summary.skillRatioCI[1].toFixed(3)})\n`,
    );
}

// --- explicit comparison against the v0.69.0 (mis-specified-target) numbers -

console.log('=== Comparison against v0.69.0 (mis-specified target) ===\n');
const V0_69_0 = [
    { label: 'defend, all enemies', skill: 0.628, ci: [0.605, 0.653] },
    { label: 'defend, LULL ONLY', skill: 0.77, ci: [0.746, 0.789] },
];
for (const old of V0_69_0) {
    console.log(
        `v0.69.0 ${old.label}: skill ${old.skill} CI [${old.ci[0]}, ${old.ci[1]}]`,
    );
}
for (const { cfg, summary } of results) {
    console.log(
        `04-train-baseline ${cfg.label}: skill ${summary.skillRatio.toFixed(3)} CI [${summary.skillRatioCI[0].toFixed(3)}, ${summary.skillRatioCI[1].toFixed(3)}]`,
    );
}

// --- decision gate -----------------------------------------------------------

const CAL_TOLERANCE = 0.05;
const SHIP_SKILL = 0.6;
const DEAD_SKILL = 0.8;

console.log('\n=== Decision gate ===\n');
for (const { cfg, summary } of results) {
    const calOk =
        Math.abs(summary.calibration.q25 - 0.25) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q50 - 0.5) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q75 - 0.75) <= CAL_TOLERANCE;

    // Read against the CI, not the point estimate — a point estimate that
    // clears 0.6 with a CI that doesn't is not evidence of shipping.
    const [ciLo, ciHi] = summary.skillRatioCI;
    const bandNarrowerThanMarginal = summary.sharpnessHours < trainStartGapIQR;

    let verdict;
    if (calOk && ciHi <= SHIP_SKILL && bandNarrowerThanMarginal) {
        verdict = 'SHIP-WORTHY';
    } else if (ciLo > DEAD_SKILL) {
        verdict = 'NOT USEFULLY PREDICTABLE';
    } else if (calOk && summary.skillRatio <= SHIP_SKILL) {
        verdict = 'PROMISING BUT UNDERPOWERED — point estimate passes, CI does not';
    } else {
        verdict = 'INCONCLUSIVE';
    }

    console.log(
        `${cfg.label}: calibration ${calOk ? 'PASS' : 'FAIL'}, skill ${summary.skillRatio.toFixed(3)} [${ciLo.toFixed(3)}-${ciHi.toFixed(3)}], sharpness ${summary.sharpnessHours.toFixed(1)}h vs marginal ${trainStartGapIQR.toFixed(1)}h (${bandNarrowerThanMarginal ? 'narrower' : 'NOT narrower'}), effN=${summary.effectiveN} => ${verdict}`,
    );
}

// --- previous-train feature concentration test ------------------------------
//
// Do prevTrainLength/prevTrainFailures differ at real train starts versus
// phase-matched controls? Same method as 01-trigger-hunt.mjs: IQR/span
// concentration ratio + permutation test with Bonferroni correction,
// phase-matched controls drawn from OTHER seasons at the same fractional
// point through the war, with a 3h exclusion window around real events. A
// control point is additionally rejected if it falls where a defend is
// active — a hypothetical new train cannot start there either.
const PREV_TRAIN_VARIABLES = ['prevTrainLength', 'prevTrainFailures'];
const RULE_IQR_RATIO = 0.25; // same threshold as 01-trigger-hunt.mjs
const RULE_SPAN_RATIO = 0.35;
const PREV_TRAIN_PERMUTATIONS = 2000;
const PREV_TRAIN_ALPHA = 0.05 / PREV_TRAIN_VARIABLES.length;

/**
 * @param {object} dataset the loaded dataset
 * @param {object[]} restrictedTrainStarts train-start events (already filtered)
 * @returns {boolean} true if either variable is RULE-LIKE
 */
function runPrevTrainConcentrationTest(dataset, restrictedTrainStarts) {
    console.log('\n=== Previous-train feature concentration test ===\n');

    const bySeasonTS = new Map();
    for (const e of restrictedTrainStarts) {
        if (!bySeasonTS.has(e.season)) bySeasonTS.set(e.season, []);
        bySeasonTS.get(e.season).push(e);
    }
    const bySeasonDefends = new Map();
    for (const e of allDefends) {
        if (!bySeasonDefends.has(e.season)) bySeasonDefends.set(e.season, []);
        bySeasonDefends.get(e.season).push(e);
    }

    const rng = makeRng(20260728);
    const CONTROLS_PER_EVENT = 5;
    const EXCLUSION_HOURS = 3;
    const candidateSeasons = [...dataset.seasons.values()].filter(
        (s) => s.spanSeconds > 0,
    );

    const atEvent = { prevTrainLength: [], prevTrainFailures: [] };
    const atControl = { prevTrainLength: [], prevTrainFailures: [] };

    // Season-first trains carry a null prevTrainLength on both sides — same
    // null-filtering convention as 01-trigger-hunt.mjs's stateAt() variables.
    const eventsWithPrevTrain = restrictedTrainStarts.filter(
        (e) => e.prevTrainLength !== null,
    );

    let controlsAttempted = 0;
    let controlsRejected = 0;

    for (const e of eventsWithPrevTrain) {
        atEvent.prevTrainLength.push(e.prevTrainLength);
        atEvent.prevTrainFailures.push(e.prevTrainFailures);

        const season = dataset.seasons.get(e.season);
        if (!season || season.spanSeconds <= 0) continue;
        const phase = (e.start_time - season.firstStart) / season.spanSeconds;

        for (let i = 0; i < CONTROLS_PER_EVENT; i++) {
            controlsAttempted++;
            const other = candidateSeasons[Math.floor(rng() * candidateSeasons.length)];
            if (!other || other.season === e.season) {
                controlsRejected++;
                continue;
            }
            const t = other.firstStart + phase * other.spanSeconds;

            const otherDefends = bySeasonDefends.get(other.season) ?? [];
            const tooClose = otherDefends.some(
                (d) => Math.abs(d.start_time - t) < EXCLUSION_HOURS * HOUR,
            );
            if (tooClose) {
                controlsRejected++;
                continue;
            }
            if (!isNoDefendActive(activeIndex, other.season, t)) {
                controlsRejected++;
                continue;
            }

            const otherTrainStarts = bySeasonTS.get(other.season) ?? [];
            const stats = prevTrainStatsAt(otherTrainStarts, t);
            if (!stats) {
                controlsRejected++;
                continue;
            }
            atControl.prevTrainLength.push(stats.length);
            atControl.prevTrainFailures.push(stats.failures);
        }
    }

    console.log(
        `train starts with a defined previous train=${eventsWithPrevTrain.length}  controls attempted=${controlsAttempted}  rejected=${controlsRejected}`,
    );
    console.log(
        `controls are PHASE-MATCHED from other seasons, restricted to lulls; ${PREV_TRAIN_PERMUTATIONS} permutations; Bonferroni alpha=${PREV_TRAIN_ALPHA.toFixed(4)} across ${PREV_TRAIN_VARIABLES.length} variables\n`,
    );

    const permRng = makeRng(31338);
    let anyRuleLike = false;
    for (const v of PREV_TRAIN_VARIABLES) {
        const A = summarizeVar(atEvent[v]);
        const C = summarizeVar(atControl[v]);
        const iqrRatio = concentrationRatio(A.iqr, C.iqr);
        const spanRatio = concentrationRatio(A.span, C.span);
        const pValue = permutationPValue(
            atEvent[v],
            atControl[v],
            permRng,
            PREV_TRAIN_PERMUTATIONS,
        );
        const effectLarge = iqrRatio <= RULE_IQR_RATIO && spanRatio <= RULE_SPAN_RATIO;
        const ruleLike = effectLarge && pValue < PREV_TRAIN_ALPHA;
        if (ruleLike) anyRuleLike = true;

        console.log(`${v}`);
        console.log(
            `  at train starts  n=${A.n}  p25=${A.p25?.toFixed(2)}  p75=${A.p75?.toFixed(2)}  IQR=${A.iqr.toFixed(2)}  span=${A.span.toFixed(2)}`,
        );
        console.log(
            `  at controls      n=${C.n}  p25=${C.p25?.toFixed(2)}  p75=${C.p75?.toFixed(2)}  IQR=${C.iqr.toFixed(2)}  span=${C.span.toFixed(2)}`,
        );
        console.log(
            `  concentration: IQR ratio=${iqrRatio.toFixed(3)} (<=${RULE_IQR_RATIO})  span ratio=${spanRatio.toFixed(3)} (<=${RULE_SPAN_RATIO})  effect=${effectLarge ? 'LARGE' : 'small'}`,
        );
        console.log(
            `  permutation p=${pValue.toFixed(4)} (significant if < ${PREV_TRAIN_ALPHA.toFixed(4)})  => ${ruleLike ? 'RULE-LIKE' : 'no signal'}\n`,
        );
    }

    console.log(
        anyRuleLike ?
            'VERDICT: previous-train features show a concentration signal — build a feature model.'
        :   'VERDICT: no concentration signal for prevTrainLength/prevTrainFailures — null result, do not fit a feature model to noise.',
    );

    return anyRuleLike;
}

const prevTrainSignal = runPrevTrainConcentrationTest(ds, trainStarts);

if (prevTrainSignal) {
    console.log(
        '\nSignal detected — a feature-conditioned predictor would be the next step. Not built in this run pending that decision.',
    );
} else {
    console.log(
        '\nNull result stands as reported above. No feature model was fit — fitting one to a null concentration test would be fitting noise, not signal.',
    );
}
