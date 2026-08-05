/**
 * 05-defend-covariates.mjs — tests covariates against defend TRAIN STARTS
 * that 01-trigger-hunt.mjs never tested, including liberation VELOCITY (one
 * of the project owner's original hypotheses, previously believed
 * uncomputable — it is computable via two `ds.liberationAt` calls a fixed
 * interval apart).
 *
 * Method for the continuous variables is identical to 01-trigger-hunt.mjs:
 * phase-matched controls drawn from OTHER seasons at the same fractional
 * season position, a 3h exclusion window, seeded RNG, IQR/span concentration
 * ratio + permutation test. The pure helpers (`quantile`, `summarize`,
 * `ratio`, `permutationP`) are DUPLICATED from that file rather than
 * imported — 01-trigger-hunt.mjs is a script, not a library: importing it
 * would run its entire analysis (DB connection included) as a side effect of
 * the import, same reason 04-train-baseline.mjs duplicates
 * `makeResidualPredictor` instead of importing it.
 *
 * The two categorical/binary variables (6-7) use a DIFFERENT test — the IQR
 * concentration test is meaningless on a boolean. Proportions are compared
 * directly, with a permutation null built the same way (pool labels, shuffle,
 * recompute), reusing the same add-one smoothing.
 *
 * Testing 7 variables: Bonferroni-corrected alpha = 0.05 / 7.
 *
 * Run: node --env-file=.env.development scripts/analysis/05-defend-covariates.mjs
 */

import assert from 'node:assert/strict';

import { loadDataset, makeRng, DAY, HOUR } from './lib/dataset.mjs';

// --- pure helpers (duplicated from 01-trigger-hunt.mjs; see file banner) ---

/**
 * Linear-interpolated quantile of an unsorted numeric array.
 *
 * @param {number[]} values
 * @param {number} q in [0, 1]
 * @returns {number|null} null for an empty array
 */
function quantile(values, q) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const pos = q * (s.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return s[lo];
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * @param {number[]} values
 * @returns {{n: number, p05: number|null, p25: number|null, p50: number|null,
 *            p75: number|null, p95: number|null, iqr: number, span: number}}
 */
function summarize(values) {
    const p05 = quantile(values, 0.05);
    const p25 = quantile(values, 0.25);
    const p50 = quantile(values, 0.5);
    const p75 = quantile(values, 0.75);
    const p95 = quantile(values, 0.95);
    return {
        n: values.length,
        p05,
        p25,
        p50,
        p75,
        p95,
        iqr: p75 !== null && p25 !== null ? p75 - p25 : 0,
        span: p95 !== null && p05 !== null ? p95 - p05 : 0,
    };
}

/**
 * Concentration ratio. Zero denominator with a non-zero numerator is Infinity
 * (maximally un-concentrated), which is the honest reading.
 *
 * @param {number} eventSpread
 * @param {number} controlSpread
 * @returns {number}
 */
function ratio(eventSpread, controlSpread) {
    if (eventSpread === 0) return 0;
    if (controlSpread === 0) return Infinity;
    return eventSpread / controlSpread;
}

const PERMUTATIONS = 2000;

/**
 * Permutation p-value for "event values are more concentrated than controls",
 * on a CONTINUOUS variable (IQR ratio). See `proportionPermutationP` below
 * for the boolean-variable equivalent.
 *
 * @param {number[]} eventVals
 * @param {number[]} controlVals
 * @param {() => number} rand
 * @returns {number} p-value
 */
function permutationP(eventVals, controlVals, rand) {
    const observed = ratio(summarize(eventVals).iqr, summarize(controlVals).iqr);
    if (!Number.isFinite(observed)) return 1;

    const pool = [...eventVals, ...controlVals];
    const nA = eventVals.length;
    let atLeastAsExtreme = 0;

    for (let p = 0; p < PERMUTATIONS; p++) {
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const permRatio = ratio(
            summarize(shuffled.slice(0, nA)).iqr,
            summarize(shuffled.slice(nA)).iqr,
        );
        if (Number.isFinite(permRatio) && permRatio <= observed) {
            atLeastAsExtreme++;
        }
    }
    // Add-one smoothing: a p-value of exactly 0 is never honest from 2000 draws.
    return (atLeastAsExtreme + 1) / (PERMUTATIONS + 1);
}

/**
 * Permutation p-value for "event and control PROPORTIONS differ", on a
 * BOOLEAN variable. The IQR test above does not apply — there is no spread to
 * concentrate. Pools the two boolean groups, reshuffles group membership
 * `PERMUTATIONS` times, and reports how often chance alone produces an
 * absolute proportion difference at least as large as the observed one
 * (two-sided — either group could be the more common one). Same add-one
 * smoothing as `permutationP`.
 *
 * @param {boolean[]} eventVals
 * @param {boolean[]} controlVals
 * @param {() => number} rand
 * @returns {{pEvent: number, pControl: number, diff: number, pValue: number}}
 */
function proportionPermutationP(eventVals, controlVals, rand) {
    const pEvent = eventVals.filter(Boolean).length / eventVals.length;
    const pControl = controlVals.filter(Boolean).length / controlVals.length;
    const observed = Math.abs(pEvent - pControl);

    const pool = [...eventVals, ...controlVals];
    const nA = eventVals.length;
    let atLeastAsExtreme = 0;

    for (let p = 0; p < PERMUTATIONS; p++) {
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const groupA = shuffled.slice(0, nA);
        const groupB = shuffled.slice(nA);
        const pA = groupA.filter(Boolean).length / groupA.length;
        const pB = groupB.filter(Boolean).length / groupB.length;
        if (Math.abs(pA - pB) >= observed) atLeastAsExtreme++;
    }
    return {
        pEvent,
        pControl,
        diff: pEvent - pControl,
        pValue: (atLeastAsExtreme + 1) / (PERMUTATIONS + 1),
    };
}

/**
 * @param {number|null|undefined} x
 * @returns {string}
 */
function fmt(x) {
    if (x === null || x === undefined) return 'n/a';
    if (!Number.isFinite(x)) return String(x);
    return x.toFixed(3);
}

// --- variable-specific pure extraction helpers ------------------------------

/**
 * Liberation gained per day over a trailing window ending at `t`. This is the
 * "liberation velocity" hypothesis — previously believed uncomputable because
 * no single stored field holds it, but it falls straight out of two
 * `liberationAt` calls a fixed interval apart, which IS evaluable at an
 * arbitrary instant (control moments included).
 *
 * @param {(season: number, enemy: number, t: number) => number|null} liberationAt
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @param {number} days window length
 * @returns {number|null} null if either endpoint is unavailable
 */
function libVelocity(liberationAt, season, enemy, t, days) {
    const now = liberationAt(season, enemy, t);
    const then = liberationAt(season, enemy, t - days * DAY);
    if (now === null || then === null) return null;
    return (now - then) / days;
}

/**
 * Fraction of a faction's points_max already taken, at `t`.
 *
 * @param {{statusAt: Function, seasons: Map<number, object>}} ds
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @returns {number|null}
 */
function pointsTakenRatioAt(ds, season, enemy, t) {
    const st = ds.statusAt(season, enemy, t);
    if (!st) return null;
    const pointsMax = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    if (!(pointsMax > 0)) return null;
    return st.points_taken / pointsMax;
}

/**
 * Whether a faction's own campaign status is 'active' at `t`.
 *
 * @param {{statusAt: Function}} ds
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @returns {boolean|null} null when no status bucket is available yet
 */
function factionStatusActiveAt(ds, season, enemy, t) {
    const st = ds.statusAt(season, enemy, t);
    if (!st) return null;
    return st.status === 'active';
}

/**
 * Whether any event of a DIFFERENT faction is active at `t` (start_time <= t
 * < end_time). Always well-defined (false, not null, when no such event
 * exists) — unlike the other variables there is no missing-data case.
 *
 * @param {Map<number, object[]>} eventsBySeasonAll every event (any type/enemy), keyed by season
 * @param {number} season
 * @param {number} enemy the faction whose event we're evaluating a moment for
 * @param {number} t unix seconds
 * @returns {boolean}
 */
function otherFactionEventActiveAt(eventsBySeasonAll, season, enemy, t) {
    const list = eventsBySeasonAll.get(season) ?? [];
    return list.some((e) => e.enemy !== enemy && e.start_time <= t && e.end_time > t);
}

// --- self-checks (no DB; run BEFORE any DB work) ----------------------------

{
    assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5, 'quantile midpoint');
    assert.equal(quantile([5], 0.9), 5, 'quantile single value');
    assert.equal(quantile([], 0.5), null, 'quantile of empty is null');

    const spread = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(spread.n, 10);
    assert(spread.iqr > 0, 'iqr should be positive for a spread sample');

    const flat = summarize([7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
    assert.equal(flat.iqr, 0, 'iqr of a constant sample is 0');

    assert.equal(ratio(0, 4), 0, 'ratio with zero numerator');
    assert.equal(ratio(2, 0), Infinity, 'ratio with zero denominator');
}

{
    // permutationP: a strongly concentrated event sample vs a wide control
    // sample should score a small p-value; identical distributions should
    // score a large one (no artificial concentration to detect).
    const rand = makeRng(1);
    const concentrated = [10, 10.1, 10.2, 9.9, 9.8, 10.05, 9.95, 10.1, 9.9, 10];
    const wide = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    const pConcentrated = permutationP(concentrated, wide, rand);
    assert(
        pConcentrated < 0.05,
        `expected a small p-value for an obviously concentrated sample, got ${pConcentrated}`,
    );

    const rand2 = makeRng(2);
    const sameA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const sameB = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const pSame = permutationP(sameA, sameB, rand2);
    assert(
        pSame > 0.2,
        `expected a large p-value for identical distributions, got ${pSame}`,
    );
}

{
    // proportionPermutationP: fully separated groups (all true vs all false)
    // must score a small p-value; identical proportions must score a large one.
    const rand = makeRng(3);
    const allTrue = Array(20).fill(true);
    const allFalse = Array(20).fill(false);
    const separated = proportionPermutationP(allTrue, allFalse, rand);
    assert.equal(separated.pEvent, 1, 'pEvent should be 1 for an all-true event group');
    assert.equal(
        separated.pControl,
        0,
        'pControl should be 0 for an all-false control group',
    );
    assert.equal(separated.diff, 1, 'diff should be 1 for fully separated groups');
    assert(
        separated.pValue < 0.05,
        `expected a small p-value for fully separated groups, got ${separated.pValue}`,
    );

    const rand2 = makeRng(4);
    const mixedA = Array.from({ length: 40 }, (_, i) => i % 2 === 0);
    const mixedB = Array.from({ length: 40 }, (_, i) => i % 2 === 0);
    const identical = proportionPermutationP(mixedA, mixedB, rand2);
    assert(
        identical.pValue > 0.2,
        `expected a large p-value for identical proportions, got ${identical.pValue}`,
    );
}

{
    // libVelocity: pure arithmetic + null propagation, against a fake
    // liberationAt that ignores season/enemy and returns a linear ramp of
    // 0.01/day starting at t=0, or null before t=0.
    const fakeLiberationAt = (season, enemy, t) => (t < 0 ? null : 0.01 * (t / DAY));

    const v1d = libVelocity(fakeLiberationAt, 1, 0, 10 * DAY, 1);
    assert(Math.abs(v1d - 0.01) < 1e-9, `expected velocity 0.01/day, got ${v1d}`);

    const v3d = libVelocity(fakeLiberationAt, 1, 0, 10 * DAY, 3);
    assert(Math.abs(v3d - 0.01) < 1e-9, `expected velocity 0.01/day over 3d, got ${v3d}`);

    // Window reaches before t=0 -> the earlier endpoint is null -> null result.
    const vNull = libVelocity(fakeLiberationAt, 1, 0, 0.5 * DAY, 1);
    assert.equal(
        vNull,
        null,
        'libVelocity must be null when the earlier endpoint is null',
    );
}

{
    // pointsTakenRatioAt: fake ds with a controllable statusAt + seasons map.
    const fakeDs = {
        statusAt: (season, enemy, t) =>
            t >= 100 ? { points_taken: 500, status: 'active' } : null,
        seasons: new Map([[1, { pointsMax: [1000, 2000, 3000] }]]),
    };
    assert.equal(pointsTakenRatioAt(fakeDs, 1, 0, 100), 0.5, 'points_taken / pointsMax');
    assert.equal(pointsTakenRatioAt(fakeDs, 1, 0, 0), null, 'null when no status bucket');
    assert.equal(
        pointsTakenRatioAt(fakeDs, 2, 0, 100),
        null,
        'null when the season has no pointsMax entry',
    );
}

{
    // factionStatusActiveAt: fake ds with a controllable statusAt.
    const fakeDs = {
        statusAt: (season, enemy, t) =>
            t >= 100 ? { status: t < 200 ? 'active' : 'defeated' } : null,
    };
    assert.equal(
        factionStatusActiveAt(fakeDs, 1, 0, 50),
        null,
        'null before any status bucket',
    );
    assert.equal(
        factionStatusActiveAt(fakeDs, 1, 0, 150),
        true,
        'true while status is active',
    );
    assert.equal(
        factionStatusActiveAt(fakeDs, 1, 0, 250),
        false,
        'false once status is no longer active',
    );
}

{
    // otherFactionEventActiveAt: fake per-season event list, mixed enemies.
    const eventsBySeasonAll = new Map([
        [
            1,
            [
                { enemy: 0, start_time: 100, end_time: 200 },
                { enemy: 1, start_time: 150, end_time: 300 },
            ],
        ],
    ]);
    assert.equal(
        otherFactionEventActiveAt(eventsBySeasonAll, 1, 0, 175),
        true,
        'an enemy-1 event is active at t=175 while evaluating for enemy 0',
    );
    assert.equal(
        otherFactionEventActiveAt(eventsBySeasonAll, 1, 1, 250),
        false,
        'the only OTHER-faction event (enemy 0) already ended by t=250; the still-active ' +
            'enemy-1 event does not count because it IS the faction being evaluated',
    );
    assert.equal(
        otherFactionEventActiveAt(eventsBySeasonAll, 1, 0, 50),
        false,
        'no other-faction event active before either starts',
    );
    assert.equal(
        otherFactionEventActiveAt(eventsBySeasonAll, 2, 0, 175),
        false,
        'a season with no events at all has nothing active',
    );
}

console.log('\n=== Phase 5: defend covariates — pure self-checks OK ===');

// --- run (DB-dependent) ------------------------------------------------------

const ds = await loadDataset();

const trainStarts = ds.events.filter((e) => e.type === 'defend' && e.isTrainStart);
assert(trainStarts.length > 0, 'no train starts found');
console.log(`train starts: ${trainStarts.length}`);

// Full per-season event index (ALL types/enemies) for otherFactionEventActive.
const eventsBySeasonAll = new Map();
for (const e of ds.events) {
    if (!eventsBySeasonAll.has(e.season)) eventsBySeasonAll.set(e.season, []);
    eventsBySeasonAll.get(e.season).push(e);
}

// Train-starts-only index (same type+enemy scope as the event set under
// test), used for the phase-matched control exclusion window — matching
// 01-trigger-hunt.mjs's use of `eventsBySeasonEnemy` built from its own
// `events` argument.
const trainStartsBySeasonEnemy = new Map();
for (const e of trainStarts) {
    const key = `${e.season}:${e.enemy}`;
    if (!trainStartsBySeasonEnemy.has(key)) trainStartsBySeasonEnemy.set(key, []);
    trainStartsBySeasonEnemy.get(key).push(e);
}

const CONTINUOUS_VARIABLES = [
    'libVelocity1d',
    'libVelocity3d',
    'libVelocity7d',
    'pointsTakenRatio',
    'playersRelToSeasonMedian',
];
const BOOLEAN_VARIABLES = ['factionStatusActive', 'otherFactionEventActive'];
const ALL_VARIABLES = [...CONTINUOUS_VARIABLES, ...BOOLEAN_VARIABLES];

// 7 variables tested; Bonferroni-correct so a raw 0.05 threshold applied 7
// times does not manufacture a false positive (~30% chance at raw 0.05).
const ALPHA = 0.05 / ALL_VARIABLES.length;

const RULE_IQR_RATIO = 0.25;
const RULE_SPAN_RATIO = 0.35;

/**
 * All 7 covariates at one (season, enemy, instant).
 *
 * @param {object} ds dataset
 * @param {Map<number, object[]>} eventsBySeasonAll
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @returns {Record<string, number|boolean|null>}
 */
function covariatesAt(ds, eventsBySeasonAll, season, enemy, t) {
    return {
        libVelocity1d: libVelocity(ds.liberationAt, season, enemy, t, 1),
        libVelocity3d: libVelocity(ds.liberationAt, season, enemy, t, 3),
        libVelocity7d: libVelocity(ds.liberationAt, season, enemy, t, 7),
        pointsTakenRatio: pointsTakenRatioAt(ds, season, enemy, t),
        playersRelToSeasonMedian: ds.playersRelToSeasonMedianAt(season, t),
        factionStatusActive: factionStatusActiveAt(ds, season, enemy, t),
        otherFactionEventActive: otherFactionEventActiveAt(
            eventsBySeasonAll,
            season,
            enemy,
            t,
        ),
    };
}

const rng = makeRng(20260728);
const candidateSeasons = [...ds.seasons.values()].filter((s) => s.spanSeconds > 0);

/** @type {Record<string, number[]>} */
const atEventCont = Object.fromEntries(CONTINUOUS_VARIABLES.map((v) => [v, []]));
/** @type {Record<string, number[]>} */
const atControlCont = Object.fromEntries(CONTINUOUS_VARIABLES.map((v) => [v, []]));
/** @type {Record<string, boolean[]>} */
const atEventBool = Object.fromEntries(BOOLEAN_VARIABLES.map((v) => [v, []]));
/** @type {Record<string, boolean[]>} */
const atControlBool = Object.fromEntries(BOOLEAN_VARIABLES.map((v) => [v, []]));

const CONTROLS_PER_EVENT = 5;
const EXCLUSION_HOURS = 3;

let controlsAttempted = 0;
let controlsRejected = 0;

for (const a of trainStarts) {
    const eventVars = covariatesAt(
        ds,
        eventsBySeasonAll,
        a.season,
        a.enemy,
        a.start_time,
    );
    for (const v of CONTINUOUS_VARIABLES) {
        if (eventVars[v] !== null && Number.isFinite(eventVars[v])) {
            atEventCont[v].push(eventVars[v]);
        }
    }
    for (const v of BOOLEAN_VARIABLES) {
        if (eventVars[v] !== null) atEventBool[v].push(eventVars[v]);
    }

    // PHASE-MATCHED controls, drawn from OTHER seasons at the SAME fractional
    // point through the war — see 01-trigger-hunt.mjs's banner comment for
    // why phase-matching (not uniform same-season sampling) is required.
    const season = ds.seasons.get(a.season);
    if (!season || season.spanSeconds <= 0) continue;
    const phase = (a.start_time - season.firstStart) / season.spanSeconds;

    for (let i = 0; i < CONTROLS_PER_EVENT; i++) {
        controlsAttempted++;

        const other = candidateSeasons[Math.floor(rng() * candidateSeasons.length)];
        if (!other || other.season === a.season) {
            controlsRejected++;
            continue;
        }
        const t = other.firstStart + phase * other.spanSeconds;

        const otherSiblings =
            trainStartsBySeasonEnemy.get(`${other.season}:${a.enemy}`) ?? [];
        const tooClose = otherSiblings.some(
            (s) => Math.abs(s.start_time - t) < EXCLUSION_HOURS * HOUR,
        );
        if (tooClose) {
            controlsRejected++;
            continue;
        }

        const cVars = covariatesAt(ds, eventsBySeasonAll, other.season, a.enemy, t);
        for (const v of CONTINUOUS_VARIABLES) {
            if (cVars[v] !== null && Number.isFinite(cVars[v])) {
                atControlCont[v].push(cVars[v]);
            }
        }
        for (const v of BOOLEAN_VARIABLES) {
            if (cVars[v] !== null) atControlBool[v].push(cVars[v]);
        }
    }
}

// --- degenerate-control guard ------------------------------------------------
//
// This project has hit the same bug TWICE: a "control" whose value was
// silently copied from the event rather than computed independently at the
// control's own season and instant, producing an IQR ratio of exactly 1.000
// and p exactly 1.0000 — indistinguishable from shuffled noise. Verify here,
// BEFORE reporting anything, that the control population for at least one
// continuous variable is NOT a copy of the event population: some control
// values must fall outside the set of event values.
{
    const eventValueSet = new Set(atEventCont.libVelocity1d.map((x) => x.toFixed(9)));
    const outsideEventSet = atControlCont.libVelocity1d.filter(
        (x) => !eventValueSet.has(x.toFixed(9)),
    );
    assert(
        outsideEventSet.length > 0,
        'DEGENERATE CONTROL: every libVelocity1d control value matches an event value — ' +
            'controls may have been copied from events rather than computed independently',
    );
    console.log(
        `\ncontrol-independence guard: ${outsideEventSet.length}/${atControlCont.libVelocity1d.length} ` +
            `libVelocity1d control values fall outside the event value set (OK — controls are ` +
            `independently evaluated at their own season/instant, not copied from events)`,
    );
}

// --- report ------------------------------------------------------------------

console.log(`\n${'#'.repeat(78)}`);
console.log('# PHASE 5: DEFEND TRAIN-START COVARIATES (previously untested)');
console.log('#'.repeat(78));
console.log(
    `\ntrain starts=${trainStarts.length}  controls attempted=${controlsAttempted}  rejected=${controlsRejected}`,
);
console.log(
    `controls are PHASE-MATCHED from other seasons; ${PERMUTATIONS} permutations; ` +
        `Bonferroni alpha=${ALPHA.toFixed(5)} across ${ALL_VARIABLES.length} variables\n`,
);

const permRng = makeRng(31337);

/** @type {{variable: string, n: number, effect: string, pValue: number, survives: boolean, effectLarge: boolean|null}[]} */
const summaryRows = [];

console.log('--- Continuous variables (IQR/span concentration) ---\n');
for (const v of CONTINUOUS_VARIABLES) {
    const A = summarize(atEventCont[v]);
    const C = summarize(atControlCont[v]);
    const iqrRatio = ratio(A.iqr, C.iqr);
    const spanRatio = ratio(A.span, C.span);
    const pValue = permutationP(atEventCont[v], atControlCont[v], permRng);

    const effectLarge = iqrRatio <= RULE_IQR_RATIO && spanRatio <= RULE_SPAN_RATIO;
    const survives = pValue < ALPHA;
    const ruleLike = effectLarge && survives;

    if (iqrRatio === 1 && pValue === 1) {
        console.log(
            `  *** RED FLAG for ${v}: IQR ratio exactly 1.000 and p exactly 1.0000 — this is the ` +
                `signature of a degenerate control (copied from the event, not computed independently). ` +
                `Treat as a bug to investigate, NOT as a finding. ***`,
        );
    }

    console.log(`${v}`);
    console.log(
        `  at train starts  n=${A.n}  p25=${fmt(A.p25)}  p50=${fmt(A.p50)}  p75=${fmt(A.p75)}  IQR=${fmt(A.iqr)}  p05-p95 span=${fmt(A.span)}`,
    );
    console.log(
        `  at controls      n=${C.n}  p25=${fmt(C.p25)}  p50=${fmt(C.p50)}  p75=${fmt(C.p75)}  IQR=${fmt(C.iqr)}  p05-p95 span=${fmt(C.span)}`,
    );
    console.log(
        `  concentration: IQR ratio=${fmt(iqrRatio)} (<=${RULE_IQR_RATIO})  span ratio=${fmt(spanRatio)} (<=${RULE_SPAN_RATIO})  effect=${effectLarge ? 'LARGE' : 'small'}`,
    );
    console.log(
        `  permutation p=${pValue.toFixed(4)} (significant if < ${ALPHA.toFixed(5)})  => ${ruleLike ? 'RULE-LIKE' : 'no rule'}\n`,
    );

    summaryRows.push({
        variable: v,
        n: A.n,
        effect: `IQR ratio=${fmt(iqrRatio)}`,
        pValue,
        survives,
        effectLarge,
    });
}

console.log('--- Categorical/binary variables (proportion difference) ---\n');
for (const v of BOOLEAN_VARIABLES) {
    const { pEvent, pControl, diff, pValue } = proportionPermutationP(
        atEventBool[v],
        atControlBool[v],
        permRng,
    );
    const survives = pValue < ALPHA;

    if (Math.abs(diff) < 1e-12 && pValue === 1) {
        console.log(
            `  *** RED FLAG for ${v}: proportion difference exactly 0 and p exactly 1.0000 — ` +
                `verify controls are independently evaluated, not copied from events. ***`,
        );
    }

    console.log(`${v}`);
    console.log(
        `  n_event=${atEventBool[v].length}  n_control=${atControlBool[v].length}`,
    );
    console.log(
        `  p_event=${(pEvent * 100).toFixed(1)}%  p_control=${(pControl * 100).toFixed(1)}%  diff=${(diff * 100).toFixed(1)}pp`,
    );
    console.log(
        `  permutation p=${pValue.toFixed(4)} (significant if < ${ALPHA.toFixed(5)})  => ${survives ? 'SIGNIFICANT' : 'not significant'}\n`,
    );

    summaryRows.push({
        variable: v,
        n: atEventBool[v].length,
        effect: `diff=${(diff * 100).toFixed(1)}pp`,
        pValue,
        survives,
        effectLarge: null, // n/a — proportion test has no IQR-ratio effect gate
    });
}

// --- summary table + verdict -------------------------------------------------

console.log(`\n${'#'.repeat(78)}`);
console.log('# SUMMARY');
console.log('#'.repeat(78));
console.log(
    `\n${'variable'.padEnd(28)}${'n'.padEnd(8)}${'effect'.padEnd(20)}${'raw p'.padEnd(10)}survives Bonferroni?`,
);
for (const row of summaryRows) {
    console.log(
        `${row.variable.padEnd(28)}${String(row.n).padEnd(8)}${row.effect.padEnd(20)}${row.pValue.toFixed(4).padEnd(10)}${row.survives ? 'YES' : 'no'}`,
    );
}

const survivors = summaryRows.filter((r) => r.survives).map((r) => r.variable);
console.log(
    survivors.length ?
        `\nVERDICT: variable(s) surviving Bonferroni correction: ${survivors.join(', ')} — statistically significant, see effect-size caveat below before treating any as a trigger.`
    :   '\nVERDICT: no variable survives Bonferroni correction. Null sweep — consistent with the prior five-variable trigger hunt.',
);

// A statistically significant permutation p-value is NOT the same claim as
// "rule-like" (01-trigger-hunt.mjs's bar: IQR ratio <= 0.25 AND span ratio <=
// 0.35). With n in the thousands on both sides, even a small, practically
// unremarkable difference in spread becomes detectable — reporting the
// p-value alone here would overclaim. Flag any continuous survivor whose
// effect size did NOT clear that bar.
const significantButSmallEffect = summaryRows.filter(
    (r) => r.survives && r.effectLarge === false,
);
if (significantButSmallEffect.length) {
    console.log(
        `\nCAVEAT: ${significantButSmallEffect.map((r) => r.variable).join(', ')} ` +
            `${significantButSmallEffect.length > 1 ? 'are' : 'is'} statistically significant after ` +
            `Bonferroni correction but with SMALL effect size (IQR ratio well above the 0.25 rule-like ` +
            `threshold used in 01-trigger-hunt.mjs). At n in the thousands, even a modest narrowing of ` +
            `spread is detectable by a permutation test — this is a weak, real association, NOT a ` +
            `deterministic trigger, and should not be reported as one.`,
    );
}
