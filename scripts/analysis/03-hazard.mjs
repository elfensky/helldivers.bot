/**
 * 03-hazard.mjs — hourly discrete-time hazard model for DEFEND events, using
 * only features with measured support (Phase 1/2): cyclic hour-of-day,
 * weekend indicator, and capped elapsed-hours-since-last-defend. Must beat
 * 02-baseline.mjs (the renewal baseline) on the SAME configuration to justify
 * itself — see the Phase 2 vs Phase 3 comparison printed at the end.
 *
 * Re-scoped from the original plan:
 * attacks are mechanically triggered (retired as a target), and the original
 * campaign-state features (liberation velocity, player percentile) measured
 * as dead ends for defends. This model also tests recency-weighted training,
 * since Phase 2 diagnosed non-stationarity across the ~160-season history as
 * one driver of its calibration failure.
 *
 * Run: node --env-file=.env.development scripts/analysis/03-hazard.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR, DAY } from './lib/dataset.mjs';
import { walkForward } from './lib/backtest.mjs';

// --- model primitives (identical to the task brief's reviewed originals) ---

/**
 * @param {number} z
 * @returns {number}
 */
function sigmoid(z) {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    const e = Math.exp(z);
    return e / (1 + e);
}

/**
 * Full-batch logistic regression by gradient descent on standardized features.
 *
 * @param {{x: number[], y: number}[]} rows
 * @param {number} dim number of features
 * @returns {{w: number[], b: number, mean: number[], std: number[]}}
 */
function fitLogistic(rows, dim, iterations = 3000, lr = 0.5) {
    assert(rows.length > 0, 'fitLogistic got no rows');

    const mean = new Array(dim).fill(0);
    const std = new Array(dim).fill(1);
    for (let d = 0; d < dim; d++) {
        const col = rows.map((r) => r.x[d]);
        mean[d] = col.reduce((a, b) => a + b, 0) / col.length;
        const variance = col.reduce((a, b) => a + (b - mean[d]) ** 2, 0) / col.length;
        std[d] = Math.sqrt(variance) || 1;
    }

    const z = rows.map((r) => ({
        x: r.x.map((v, d) => (v - mean[d]) / std[d]),
        y: r.y,
    }));

    const w = new Array(dim).fill(0);
    let b = 0;

    for (let it = 0; it < iterations; it++) {
        const gw = new Array(dim).fill(0);
        let gb = 0;
        for (const r of z) {
            let s = b;
            for (let d = 0; d < dim; d++) s += w[d] * r.x[d];
            const err = sigmoid(s) - r.y;
            for (let d = 0; d < dim; d++) gw[d] += err * r.x[d];
            gb += err;
        }
        for (let d = 0; d < dim; d++) w[d] -= (lr * gw[d]) / z.length;
        b -= (lr * gb) / z.length;
    }

    return { w, b, mean, std };
}

/**
 * @param {{w: number[], b: number, mean: number[], std: number[]}} model
 * @param {number[]} x raw (unstandardized) features
 * @returns {number} probability in (0, 1)
 */
function predictProb(model, x) {
    let s = model.b;
    for (let d = 0; d < model.w.length; d++) {
        s += model.w[d] * ((x[d] - model.mean[d]) / model.std[d]);
    }
    return sigmoid(s);
}

/**
 * Convert an HOURLY hazard function into wait quantiles, in hours.
 *
 * Adapted from the task brief's `waitQuantilesFromHazard` (which stepped in
 * days and multiplied by 24): defends have a ~2.5h duration and lulls of tens
 * of hours, so an hourly step is the right resolution — no day-to-hour
 * conversion factor is needed here since the loop already steps in hours.
 *
 * @param {(hourIndex: number) => number} hazardForHour
 * @param {number} horizonHours
 * @returns {{p25: number, p50: number, p75: number}} hours
 */
function waitQuantilesFromHourlyHazard(hazardForHour, horizonHours) {
    const targets = [0.25, 0.5, 0.75];
    const out = [null, null, null];
    let survival = 1;

    for (let hour = 0; hour < horizonHours; hour++) {
        const h = Math.min(Math.max(hazardForHour(hour), 0), 1);
        const cdfBefore = 1 - survival;
        survival *= 1 - h;
        const cdfAfter = 1 - survival;

        for (let i = 0; i < targets.length; i++) {
            if (out[i] === null && cdfAfter >= targets[i]) {
                const withinHour =
                    cdfAfter > cdfBefore ?
                        (targets[i] - cdfBefore) / (cdfAfter - cdfBefore)
                    :   0;
                out[i] = hour + withinHour;
            }
        }
    }

    const cap = horizonHours;
    return {
        p25: out[0] ?? cap,
        p50: out[1] ?? cap,
        p75: out[2] ?? cap,
    };
}

// --- features ---------------------------------------------------------------
//
// Only features with measured support survive the Task 6 re-scope:
// hour-of-day (chi2=128.1, df=23), weekend (chi2=21.7, df=6),
// and elapsed-since-last-defend (the renewal/chain structure Phase 2 already
// exploits, here made trend-aware via the recency-weighted training variant).
// Campaign-state features (liberation velocity, player percentile) are
// deliberately NOT here — Phase 1 measured them at IQR ratios 1.084/1.180,
// i.e. no signal, for defends.

const ELAPSED_CAP_HOURS = 120; // 5 days: Task 5 measured the elapsed-dependent
// hit-rate bias plateauing by ~108h (0.40 at 0-12h -> 1.00 at 108h+), so 120h
// covers the full behavioral range without letting rare, very long lulls
// (a season with few defends) blow up the standardization of this feature.

/**
 * UTC hour-of-day [0, 23]. The unix epoch starts exactly at UTC midnight, so
 * integer-dividing by HOUR and reducing mod 24 needs no Date object.
 *
 * @param {number} t unix seconds
 * @returns {number}
 */
function hourOfDayUTC(t) {
    return Math.floor(t / HOUR) % 24;
}

/**
 * Weekday with 0 = Sunday, matching the convention `Math.floor(t / 86400 + 4)
 * % 7` specified in the task brief (the unix epoch, 1970-01-01, was a
 * Thursday = weekday 4).
 *
 * @param {number} t unix seconds
 * @returns {number}
 */
function weekdayUTC(t) {
    return Math.floor(t / DAY + 4) % 7;
}

/**
 * Cyclic encoding of an hour-of-day: sin/cos rather than a raw integer, so
 * 23:00 and 00:00 land close together instead of at opposite ends of a scale.
 *
 * @param {number} hour in [0, 23]
 * @returns {[number, number]}
 */
function hourAngleFeatures(hour) {
    const angle = (2 * Math.PI * hour) / 24;
    return [Math.sin(angle), Math.cos(angle)];
}

/**
 * Features at an instant: [sin(hour), cos(hour), weekend, elapsed hours
 * since the last defend start (capped)].
 *
 * @param {number} t unix seconds
 * @param {number|null} lastStart start_time of the most recent defend at or
 *   before `t`, or null if none precedes it this season
 * @returns {number[]}
 */
function featuresAt(t, lastStart) {
    const [sinHour, cosHour] = hourAngleFeatures(hourOfDayUTC(t));
    const weekday = weekdayUTC(t);
    const weekend = weekday === 0 || weekday === 6 ? 1 : 0;
    const elapsedHours =
        lastStart === null ? ELAPSED_CAP_HOURS : (
            Math.min((t - lastStart) / HOUR, ELAPSED_CAP_HOURS)
        );
    return [sinHour, cosHour, weekend, elapsedHours];
}

const FEATURE_DIM = 4;

/**
 * One training row per hour of a season's span: label is "did a defend start
 * during (t, t+1h]". Pure function of a season span + sorted start times, so
 * it is self-checkable without the database.
 *
 * @param {{firstStart: number, lastEnd: number}} span
 * @param {number[]} starts sorted ascending defend start times within the season
 * @returns {{x: number[], y: number}[]}
 */
function buildRowsForSeason(span, starts) {
    const rows = [];
    let idx = 0; // starts[0..idx-1] are <= t; starts[idx] is the first > t
    for (let t = span.firstStart; t < span.lastEnd; t += HOUR) {
        while (idx < starts.length && starts[idx] <= t) idx++;
        const last = idx > 0 ? starts[idx - 1] : null;
        const fired = idx < starts.length && starts[idx] <= t + HOUR;
        rows.push({ x: featuresAt(t, last), y: fired ? 1 : 0 });
    }
    return rows;
}

/**
 * Keep only events belonging to the most recent `w` distinct seasons present
 * in `trainEvents`. Pure — takes the events array, not a live dataset — so it
 * is self-checkable without the database and cannot mutate its input.
 *
 * @param {object[]} trainEvents
 * @param {number} w
 * @returns {object[]}
 */
function windowFilter(trainEvents, w) {
    const seasonsPresent = [...new Set(trainEvents.map((e) => e.season))].sort(
        (a, b) => a - b,
    );
    const keep = new Set(seasonsPresent.slice(-w));
    return trainEvents.filter((e) => keep.has(e.season));
}

// --- self-check on the pure model + feature pieces --------------------------
{
    assert(Math.abs(sigmoid(0) - 0.5) < 1e-12, 'sigmoid(0) should be 0.5');
    assert(sigmoid(50) > 0.999, 'sigmoid saturates high');
    assert(sigmoid(-50) < 0.001, 'sigmoid saturates low');

    // A separable problem: label is 1 whenever x0 > 0, other features inert.
    const sepRows = [];
    for (let i = -20; i <= 20; i++) {
        sepRows.push({ x: [i, 0, 0, 0], y: i > 0 ? 1 : 0 });
    }
    const model = fitLogistic(sepRows, FEATURE_DIM);
    const high = predictProb(model, [15, 0, 0, 0]);
    const low = predictProb(model, [-15, 0, 0, 0]);
    assert(high > 0.8, `separable high side should be >0.8, got ${high}`);
    assert(low < 0.2, `separable low side should be <0.2, got ${low}`);

    // Survival -> quantiles, hourly step: a constant 50% hazard has a median
    // wait inside the FIRST HOUR (not the first day, per the daily original).
    const q = waitQuantilesFromHourlyHazard(() => 0.5, 60);
    assert(q.p50 > 0 && q.p50 <= 1, `expected p50 within an hour, got ${q.p50}`);
    assert(q.p25 <= q.p50 && q.p50 <= q.p75, 'quantiles out of order');

    // A zero hazard must return the capped horizon (in hours, no *24 factor
    // now that the loop already steps hourly) rather than NaN or Infinity.
    const never = waitQuantilesFromHourlyHazard(() => 0, 60);
    assert(Number.isFinite(never.p50), 'zero hazard must return a finite cap');
    assert.equal(never.p50, 60, 'zero hazard should return the horizon cap (hours)');

    // Cyclic hour encoding: 23:00 must land closer to 00:00 than 12:00 does.
    const [s0, c0] = hourAngleFeatures(0);
    const [s23, c23] = hourAngleFeatures(23);
    const [s12, c12] = hourAngleFeatures(12);
    const distAdjacent = Math.hypot(s0 - s23, c0 - c23);
    const distOpposite = Math.hypot(s0 - s12, c0 - c12);
    assert(
        distAdjacent < distOpposite,
        'hour 23 should be closer to hour 0 than hour 12 is (cyclic encoding)',
    );
    assert(
        distOpposite > 1.9 && distOpposite < 2.1,
        'hour 12 should be diametrically opposite hour 0 on the unit circle',
    );

    assert.equal(hourOfDayUTC(0), 0, 'epoch second should be hour 0');
    assert.equal(hourOfDayUTC(23 * HOUR), 23, 'hour 23 mis-derived');
    assert.equal(hourOfDayUTC(5 * HOUR + 100), 5, 'hour truncation is wrong');

    // Weekday: the unix epoch (1970-01-01) was a Thursday; 1970-01-04 a Sunday.
    assert.equal(weekdayUTC(0), 4, 'epoch should be weekday 4 (Thursday)');
    assert.equal(weekdayUTC(3 * DAY), 0, '1970-01-04 should be weekday 0 (Sunday)');

    // Elapsed feature: capped, and null-last falls back to the cap.
    const capped = featuresAt(1000 * HOUR, 1000 * HOUR - 200 * HOUR);
    assert.equal(capped[3], ELAPSED_CAP_HOURS, 'elapsed should be capped at 120h');
    const noPrior = featuresAt(1000 * HOUR, null);
    assert.equal(
        noPrior[3],
        ELAPSED_CAP_HOURS,
        'no-prior elapsed should fall back to the cap',
    );

    // buildRowsForSeason: one defend inside a 5h span, landing in hour bucket
    // index 2 (t=7200..10800]. Only that bucket should fire, and elapsed must
    // be null-derived (capped) before it and small right after it.
    {
        const span = { firstStart: 0, lastEnd: 5 * HOUR };
        const starts = [2 * HOUR + 1000];
        const rows = buildRowsForSeason(span, starts);
        assert.equal(rows.length, 5, 'expected 5 hourly rows over a 5h span');
        assert.equal(
            rows.map((r) => r.y).join(','),
            '0,0,1,0,0',
            'fired label landed in the wrong hour bucket',
        );
        assert.equal(
            rows[0].x[3],
            ELAPSED_CAP_HOURS,
            'elapsed should be capped before any defend has occurred this season',
        );
        assert(
            rows[3].x[3] < ELAPSED_CAP_HOURS,
            'elapsed just after a defend should be small, not capped',
        );
    }

    // windowFilter: keeps only the most recent W distinct seasons, and does
    // not mutate its input.
    {
        const events = [{ season: 1 }, { season: 2 }, { season: 3 }, { season: 5 }];
        const before = events.length;
        const kept = windowFilter(events, 2);
        assert.equal(kept.length, 2, 'window filter should keep exactly 2 events (W=2)');
        assert(
            kept.every((e) => e.season === 3 || e.season === 5),
            'window filter kept events from the wrong seasons',
        );
        assert.equal(events.length, before, 'windowFilter must not mutate its input');
    }
}

// --- run ---------------------------------------------------------------

const ITERATIONS = 800; // cost estimated before running full — at
// hourly resolution there are ~24x more training rows than the original
// daily design (grand total ~8.9M row-builds summed across all folds for
// both variants combined, per a pre-run measurement). Model-caching (one fit
// per (variant, testSeason) shared across both momentFilter configs — see
// modelCache below) roughly halves that, but a background dry run still died
// without finishing at iterations=3000, so this follows the plan's own
// documented fallback (3000 -> 800) rather than re-risking an unbounded
// foreground run.
const RECENT_WINDOW_SEASONS = 30; // ~1/5 of the ~160-season history: enough
// seasons that a fold still has hundreds of defends to fit on (comfortably
// above walkForward's own 30-event minimum), short enough to track the
// per-season hit-rate drift Task 5 measured (0.12 -> 1.00 with a trend).
const HAZARD_HORIZON_HOURS = 1500; // matches walkForward's own horizonHours
// default, so the internal survival simulation doesn't do wasted work beyond
// where predictions get truncated anyway.

const ds = await loadDataset();

/**
 * Build training rows for every season present in `trainEvents`, using the
 * live dataset's season spans.
 *
 * @param {object[]} trainEvents defend events, all enemies pooled
 * @returns {{x: number[], y: number}[]}
 */
function buildTrainingRows(trainEvents) {
    const bySeason = new Map();
    for (const e of trainEvents) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }

    const rows = [];
    for (const [season, list] of bySeason) {
        const span = ds.seasons.get(season);
        if (!span || span.spanSeconds <= 0) continue;
        const starts = list.map((e) => e.start_time).sort((a, b) => a - b);
        if (starts.length === 0) continue;
        rows.push(...buildRowsForSeason(span, starts));
    }
    return rows;
}

// Fits are shared across the two momentFilter configs (all-enemies vs
// lull-only) for a given variant: training rows depend only on the training
// events and the variant's window policy, never on the eval-time
// momentFilter, so refitting per config would double the work for nothing.
const modelCache = new Map();

/**
 * Build a `fitPredictor` bound to one training-window policy, in the shape
 * walkForward expects.
 *
 * @param {string} variantName cache-key prefix, also used in report labels
 * @param {boolean} useRecentWindow
 * @returns {(trainEvents: object[], ctx: object) => (moment: object) => object}
 */
function fitPredictorFor(variantName, useRecentWindow) {
    return function fitPredictor(trainEvents, ctx) {
        const cacheKey = `${variantName}:${ctx.testSeason}`;
        let model = modelCache.get(cacheKey);
        if (!model) {
            const trainSubset =
                useRecentWindow ?
                    windowFilter(trainEvents, RECENT_WINDOW_SEASONS)
                :   trainEvents;
            assert(trainSubset.length > 0, `no training events for ${cacheKey}`);
            const rows = buildTrainingRows(trainSubset);
            assert(rows.length > 0, `no training rows built for ${cacheKey}`);
            model = fitLogistic(rows, FEATURE_DIM, ITERATIONS);
            modelCache.set(cacheKey, model);
        }

        return function predict(moment) {
            const lastStart = moment.lastEvent.start_time;
            const hazardForHour = (hourIndex) => {
                const t = moment.t + hourIndex * HOUR;
                return predictProb(model, featuresAt(t, lastStart));
            };
            return waitQuantilesFromHourlyHazard(hazardForHour, HAZARD_HORIZON_HOURS);
        };
    };
}

/**
 * Is a defend event active at time `t`? Copied from 02-baseline.mjs's
 * `inLull` per instructions — not imported, since backtest configs are
 * run-script-local by convention.
 *
 * @param {number} t
 * @param {object[]} seasonEvents
 * @returns {boolean}
 */
function inLull(t, seasonEvents) {
    return !seasonEvents.some((e) => e.start_time <= t && e.end_time > t);
}

const CONFIGS = [
    {
        label: 'defend, all enemies',
        type: 'defend',
        enemy: undefined,
        momentFilter: null,
    },
    {
        label: 'defend, LULL ONLY (no defend active)',
        type: 'defend',
        enemy: undefined,
        momentFilter: inLull,
    },
];

const VARIANTS = [
    { name: 'all-history', useRecentWindow: false },
    { name: `recent-window (W=${RECENT_WINDOW_SEASONS})`, useRecentWindow: true },
];

console.log('\n=== Phase 3: hourly hazard, defend-only, evidence-backed features ===');
console.log(
    'features: [sin(hour UTC), cos(hour UTC), weekend, elapsed hours since last defend (cap 120h)]\n',
);

/** @type {{configLabel: string, variantName: string, summary: object}[]} */
const results = [];

for (const variant of VARIANTS) {
    const fitPredictor = fitPredictorFor(variant.name, variant.useRecentWindow);
    console.log(`--- variant: ${variant.name} ---\n`);

    for (const cfg of CONFIGS) {
        const summary = walkForward({
            events: ds.events,
            seasons: ds.seasons,
            type: cfg.type,
            enemy: cfg.enemy,
            fitPredictor,
            momentFilter: cfg.momentFilter,
        });
        results.push({ configLabel: cfg.label, variantName: variant.name, summary });

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
}

// --- Phase 2 vs Phase 3 comparison ------------------------------------------
//
// Phase 3 justifies its existence ONLY if it beats Phase 2 on the SAME
// configuration: lower skill ratio AND calibration no worse. Compare CIs, not
// point estimates — that is the project's decision rule (see the decision
// gate in 02-baseline.mjs). The PHASE2 figures below are hardcoded for this
// comparison, produced by running `02-baseline.mjs`; if that script's output
// ever changes, these must be refreshed to match.

const PHASE2 = {
    'defend, all enemies': { skill: 0.628, ciLo: 0.605, ciHi: 0.653, effN: 3925 },
    'defend, LULL ONLY (no defend active)': {
        skill: 0.77,
        ciLo: 0.746,
        ciHi: 0.789,
        effN: 1472,
    },
};

console.log('=== Phase 2 vs Phase 3 comparison ===\n');
for (const cfg of CONFIGS) {
    const p2 = PHASE2[cfg.label];
    console.log(cfg.label);
    console.log(
        `  Phase 2 (renewal baseline):  skill ${p2.skill.toFixed(3)} [${p2.ciLo.toFixed(3)}-${p2.ciHi.toFixed(3)}]  effN=${p2.effN}`,
    );

    for (const { configLabel, variantName, summary } of results) {
        if (configLabel !== cfg.label) continue;
        const [lo, hi] = summary.skillRatioCI;
        console.log(
            `  Phase 3 ${variantName}:  skill ${summary.skillRatio.toFixed(3)} [${lo.toFixed(3)}-${hi.toFixed(3)}]  effN=${summary.effectiveN}`,
        );

        let verdict;
        if (hi < p2.ciLo) {
            verdict = 'BEATS Phase 2 (CI strictly lower, no overlap)';
        } else if (lo > p2.ciHi) {
            verdict = 'WORSE than Phase 2 (CI strictly higher, no overlap)';
        } else {
            verdict = 'INCONCLUSIVE (CIs overlap)';
        }
        console.log(`    => ${verdict}`);
    }
    console.log('');
}

console.log(
    'Phase 3 earns its keep ONLY where a variant above reads BEATS Phase 2. "INCONCLUSIVE"',
);
console.log(
    'or "WORSE" are expected, reportable outcomes — not evidence of a bug in this script.',
);
