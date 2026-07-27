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
import { loadDataset, HOUR } from './lib/dataset.mjs';
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
 * @param {number[]} values
 * @returns {{n: number, p25: number|null, p50: number|null, p75: number|null}}
 */
function quantileSummary(values) {
    return {
        n: values.length,
        p25: quantileOf(values, 0.25),
        p50: quantileOf(values, 0.5),
        p75: quantileOf(values, 0.75),
    };
}

/**
 * Pearson correlation coefficient. A constant input has zero variance, which
 * makes the coefficient mathematically undefined (0/0) — this returns 0 (the
 * documented "no linear relationship measurable" sentinel) rather than NaN,
 * so callers can print a number without a special case.
 *
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {number} in [-1, 1], or 0 when either input is constant
 */
function pearsonCorrelation(xs, ys) {
    assert.equal(xs.length, ys.length, 'pearsonCorrelation requires equal-length inputs');
    const n = xs.length;
    if (n === 0) return 0;

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let cov = 0;
    let varX = 0;
    let varY = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;
        cov += dx * dy;
        varX += dx * dx;
        varY += dy * dy;
    }
    if (varX === 0 || varY === 0) return 0;
    return cov / Math.sqrt(varX * varY);
}

/**
 * Bucket label for prevTrainLength/prevTrainFailures: values 0-5 get their
 * own bucket, 6+ folds together (sparse tail).
 *
 * @param {number} v
 * @returns {string}
 */
function bucketLabel(v) {
    return v >= 6 ? '6+' : String(v);
}

/**
 * For each REAL train start with a defined previous train, the lull it sits
 * at the end of — the gap from the END of the previous train (the end_time
 * of that train's LAST defend) to THIS train start's start_time — plus the
 * mechanical start-to-start gap, for the side-by-side contrast the write-up
 * calls for.
 *
 * Deliberately does NOT reuse the old `prevTrainStatsAt` helper (deleted —
 * see the block comment above its former call site). That helper computed a
 * HYPOTHETICAL control's inherited stats at an arbitrary instant, and its
 * value was piecewise-constant across an entire lull — identical to the
 * value the real train start ending that lull carries. Every "control" was
 * therefore an exact copy of some real event's value by construction, which
 * is why that test was degenerate. This function reads prevTrainLength /
 * prevTrainFailures directly off the real train-start event (already correct,
 * from dataset.mjs) and locates the previous train's actual last defend by
 * walking the full per-season defend list — no hypothetical control involved.
 *
 * @param {object[]} allDefends every defend event, all seasons
 * @returns {{prevTrainLength: number, prevTrainFailures: number, lullHours: number, startToStartGapHours: number}[]}
 */
function buildLullRecords(allDefends) {
    const bySeason = new Map();
    for (const e of allDefends) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }

    const records = [];
    for (const [, list] of bySeason) {
        const startIndices = [];
        for (let i = 0; i < list.length; i++) {
            if (list[i].isTrainStart) startIndices.push(i);
        }
        // k starts at 1: the season's FIRST train (startIndices[0]) has no
        // preceding train, so it contributes no lull record.
        for (let k = 1; k < startIndices.length; k++) {
            const start = list[startIndices[k]];
            if (start.prevTrainLength === null) continue; // defensive; never true for k >= 1
            const prevTrainLastDefend = list[startIndices[k] - 1];
            const prevStart = list[startIndices[k - 1]];
            records.push({
                prevTrainLength: start.prevTrainLength,
                prevTrainFailures: start.prevTrainFailures,
                lullHours: (start.start_time - prevTrainLastDefend.end_time) / HOUR,
                startToStartGapHours: (start.start_time - prevStart.start_time) / HOUR,
            });
        }
    }
    return records;
}

/**
 * Stratify lull-hours by a previous-train feature, bucketed via `bucketLabel`.
 *
 * @param {{prevTrainLength: number, prevTrainFailures: number, lullHours: number}[]} records
 * @param {'prevTrainLength'|'prevTrainFailures'} key
 * @returns {Map<string, {n: number, p25: number|null, p50: number|null, p75: number|null}>}
 *   ordered ascending by bucket, with '6+' last
 */
function stratifyLullBy(records, key) {
    const byBucket = new Map();
    for (const r of records) {
        const label = bucketLabel(r[key]);
        if (!byBucket.has(label)) byBucket.set(label, []);
        byBucket.get(label).push(r.lullHours);
    }
    const order = [...byBucket.keys()].sort((a, b) => {
        if (a === '6+') return 1;
        if (b === '6+') return -1;
        return Number(a) - Number(b);
    });
    const result = new Map();
    for (const label of order) {
        result.set(label, quantileSummary(byBucket.get(label)));
    }
    return result;
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
    // pearsonCorrelation
    assert.equal(
        pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]),
        1,
        'perfectly correlated input should give r=1',
    );
    assert.equal(
        pearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2]),
        -1,
        'perfectly anti-correlated input should give r=-1',
    );
    assert.equal(
        pearsonCorrelation([1, 2, 3, 4], [5, 5, 5, 5]),
        0,
        'constant y should give the documented 0 sentinel, not NaN',
    );
    assert.equal(
        pearsonCorrelation([5, 5, 5, 5], [5, 5, 5, 5]),
        0,
        'both-constant input should give the documented 0 sentinel, not NaN',
    );
}

{
    // buildLullRecords / stratifyLullBy
    //
    // One season: train A (defends at 0-100 and 200-300, length 2), a 10h
    // lull, train B (a single defend at 36300-36400, length 1), a 20h lull,
    // train C (a single defend starting at 108400).
    const fakeDefends = [
        {
            season: 1,
            start_time: 0,
            end_time: 100,
            isTrainStart: true,
            prevTrainLength: null,
            prevTrainFailures: null,
        },
        {
            season: 1,
            start_time: 200,
            end_time: 300,
            isTrainStart: false,
            prevTrainLength: null,
            prevTrainFailures: null,
        },
        {
            season: 1,
            start_time: 300 + 10 * HOUR,
            end_time: 300 + 10 * HOUR + 100,
            isTrainStart: true,
            prevTrainLength: 2,
            prevTrainFailures: 1,
        },
        {
            season: 1,
            start_time: 300 + 10 * HOUR + 100 + 20 * HOUR,
            end_time: 300 + 10 * HOUR + 100 + 20 * HOUR + 100,
            isTrainStart: true,
            prevTrainLength: 1,
            prevTrainFailures: 0,
        },
    ];

    const records = buildLullRecords(fakeDefends);
    assert.equal(records.length, 2, 'season first train contributes no lull record');
    assert.equal(records[0].prevTrainLength, 2, "train B's previous train had length 2");
    assert.equal(records[0].lullHours, 10, "train B's lull should be exactly 10h");
    assert.equal(records[1].prevTrainLength, 1, "train C's previous train had length 1");
    assert.equal(records[1].lullHours, 20, "train C's lull should be exactly 20h");
    assert(
        records[0].startToStartGapHours > records[0].lullHours,
        'start-to-start gap must exceed the lull (it also spans the previous train itself)',
    );

    const byLength = stratifyLullBy(records, 'prevTrainLength');
    assert.deepEqual(
        [...byLength.keys()],
        ['1', '2'],
        'buckets should be sorted ascending, with 6+ last',
    );
    assert.equal(byLength.get('2').n, 1);
    assert.equal(byLength.get('2').p50, 10);

    // bucketLabel folds 6+ into one bucket.
    assert.equal(bucketLabel(5), '5');
    assert.equal(bucketLabel(6), '6+');
    assert.equal(bucketLabel(12), '6+');
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

// --- previous-train features vs. the following lull -------------------------
//
// A prior version of this test built "controls" via a `prevTrainStatsAt`
// helper: the previous-train stats a HYPOTHETICAL train start would inherit
// at a phase-matched instant in some OTHER season. That value is
// piecewise-constant across the entire lull it falls in, and its value on
// that lull IS the value the REAL train start ending that lull carries — so
// every "control" was, by construction, an exact copy of some real event's
// value. Across the full run, 0 of 6270 control draws fell outside the set
// of real event values. A reviewer proved the resulting statistic was
// invariant to the data: shuffling the feature values across all train
// starts (destroying any real relationship) produced IDENTICAL output — IQR
// ratio 1.000, p=1.0000 — and a synthetic world with a literally
// deterministic trigger was still reported as "no signal". A statistic that
// cannot distinguish shuffled data from real data cannot be published as
// evidence, so that test was deleted rather than patched.
//
// This replacement asks the question directly: does the previous train's
// length / failure count predict how long the FOLLOWING LULL runs? Real
// train starts only, stratified by prevTrainLength and (separately) by
// prevTrainFailures, plus the Pearson correlation between each feature and
// the lull across all train starts.
console.log(
    '\n=== Previous-train features vs. the following lull (replaces a degenerate concentration test) ===\n',
);

const lullRecords = buildLullRecords(allDefends);
console.log(
    `train starts with a defined previous train and a following lull: ${lullRecords.length}\n`,
);

for (const key of /** @type {const} */ (['prevTrainLength', 'prevTrainFailures'])) {
    console.log(`stratified by ${key} (lull hours per stratum):`);
    const strata = stratifyLullBy(lullRecords, key);
    for (const [label, s] of strata) {
        console.log(
            `  ${key}=${label.padEnd(3)} n=${String(s.n).padEnd(4)} lull p25=${s.p25?.toFixed(1)}h  p50=${s.p50?.toFixed(1)}h  p75=${s.p75?.toFixed(1)}h`,
        );
    }
    console.log('');
}

const lullVsLength = pearsonCorrelation(
    lullRecords.map((r) => r.prevTrainLength),
    lullRecords.map((r) => r.lullHours),
);
const lullVsFailures = pearsonCorrelation(
    lullRecords.map((r) => r.prevTrainFailures),
    lullRecords.map((r) => r.lullHours),
);
// For CONTRAST ONLY — not the forecasting-relevant quantity. See the note
// printed below.
const startGapVsLength = pearsonCorrelation(
    lullRecords.map((r) => r.prevTrainLength),
    lullRecords.map((r) => r.startToStartGapHours),
);

console.log(
    `Pearson r, prevTrainLength   vs LULL length (end of prev train -> this train's start): ${lullVsLength.toFixed(3)}`,
);
console.log(
    `Pearson r, prevTrainFailures vs LULL length (end of prev train -> this train's start): ${lullVsFailures.toFixed(3)}`,
);
console.log(
    `\nFor CONTRAST, not as evidence of signal: Pearson r, prevTrainLength vs the` +
        `\nSTART-TO-START gap (this train's start minus the PREVIOUS train's start) = ${startGapVsLength.toFixed(3)}.` +
        `\nThat correlation is MECHANICAL, not predictive — a longer previous train pushes its own` +
        `\nend time later, which pushes the start-to-start gap out even when the LULL that follows it` +
        `\n(the actually forecasting-relevant quantity) is unrelated to how long the train was. Read` +
        `\nthe LULL correlations above as the answer to "does the previous train predict the wait" —` +
        `\nnot this one.\n`,
);

// Not a formal significance test (that machinery is exactly what was just
// deleted for being degenerate) — a plain, documented magnitude threshold on
// the correlation coefficient itself.
const FLAT_R_THRESHOLD = 0.1;
const flatSignal =
    Math.abs(lullVsLength) < FLAT_R_THRESHOLD &&
    Math.abs(lullVsFailures) < FLAT_R_THRESHOLD;

console.log(
    flatSignal ?
        `VERDICT: |r| < ${FLAT_R_THRESHOLD} for both features against the lull — null result, consistent with the flat medians above. Do not fit a feature model to noise.`
    :   `VERDICT: |r| >= ${FLAT_R_THRESHOLD} for at least one feature against the lull — a relationship worth a closer look before dismissing as noise.`,
);

if (!flatSignal) {
    console.log(
        '\nA relationship was measured — a feature-conditioned predictor would be the next step. Not built in this run pending that decision.',
    );
} else {
    console.log(
        '\nNull result stands as reported above. No feature model was fit — fitting one to a null relationship would be fitting noise, not signal.',
    );
}
