/**
 * 09-attack-eta.mjs — how well does (points_max - points) / rate predict an attack?
 *
 * `08-attack-trigger.mjs` established that attacks fire within minutes of
 * `points == points_max`. The threshold is therefore a KNOWN CONSTANT, not a
 * distribution to estimate, and the whole forecasting problem collapses to:
 *
 *     eta = (points_max - points) / rate
 *
 * Every term but `rate` is known exactly and in real time, so the entire error
 * budget lives in estimating pace. This script measures that.
 *
 * Design decisions, all recorded in
 * docs/superpowers/specs/2026-07-28-attack-forecast-design.md BEFORE any number
 * was produced:
 *
 *  - **24-hour rate window.** Shorter windows are better live (a 1h window is
 *    usable 84% of the time vs 77% for 24h) but UNBACKTESTABLE: 156 of 160
 *    seasons have ~daily buckets, so both endpoints of a 1h window land in the
 *    same bucket. S157+ has the resolution but only 8 attacks. So the shipped
 *    configuration is the one history can validate, and the live feed can only
 *    improve its inputs — which makes the backtested error an honest floor.
 *  - **No fallback model.** Moments with `rate <= 0` emit no forecast and are
 *    excluded via `momentFilter`, rather than falling back to some other
 *    predictor. A blended predictor makes "does this work" unanswerable.
 *  - **Ratio quantiles learned per remaining-fraction band.** `wait / eta` is
 *    heavy-tailed and mechanically correlated with `eta` as `remaining -> 0`,
 *    so a single pooled {r25, r50, r75} is invalid.
 *
 * Run: node --env-file=.env.development scripts/analysis/09-attack-eta.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const RATE_WINDOW_HOURS = 24;
const DISPLAY_HOURS = 24; // the UI only renders a line when p50 is under this

/**
 * Remaining-fraction band edges. Attacks fire at remaining = 0, so the
 *  resolution that matters is concentrated near zero.
 */
const BANDS = [0.02, 0.05, 0.1, 0.2, 0.4, 1.01];

/**
 * Index of the remaining-fraction band containing `frac`.
 *
 * @param {number} frac remaining points as a fraction of points_max
 * @returns {number} band index into BANDS
 */
export function bandOf(frac) {
    for (let i = 0; i < BANDS.length; i++) if (frac < BANDS[i]) return i;
    return BANDS.length - 1;
}

/**
 * Turn a set of observed `wait / eta` ratios into the three multipliers that
 * convert a raw ETA into a p25/p50/p75 forecast.
 *
 * @param {number[]} ratios observed true-wait / raw-eta values
 * @returns {{r25: number, r50: number, r75: number}|null} null when too thin
 */
export function ratioQuantiles(ratios) {
    if (ratios.length < 30) return null;
    return {
        r25: quantileOf(ratios, 0.25),
        r50: quantileOf(ratios, 0.5),
        r75: quantileOf(ratios, 0.75),
    };
}

// --- self-checks on the pure functions (no DB) ----------------------------
{
    assert.equal(bandOf(0.0), 0);
    assert.equal(bandOf(0.019), 0);
    assert.equal(bandOf(0.02), 1);
    assert.equal(bandOf(0.5), 5);
    assert.equal(bandOf(1.0), 5);

    assert.equal(ratioQuantiles([1, 2, 3]), null, 'thin samples must not fit');

    // A perfectly-calibrated world: every wait is exactly its eta, so all three
    // multipliers must be 1 and the forecast must reproduce the eta unchanged.
    const exact = Array.from({ length: 100 }, () => 1);
    const q = ratioQuantiles(exact);
    assert.equal(q.r25, 1);
    assert.equal(q.r50, 1);
    assert.equal(q.r75, 1);

    // Ordering must survive a skewed sample — this is what keeps p25<=p50<=p75
    // after multiplying back through a positive eta.
    const skewed = Array.from({ length: 100 }, (_, i) => (i < 90 ? 1 : 50));
    const s = ratioQuantiles(skewed);
    assert(s.r25 <= s.r50 && s.r50 <= s.r75, 'ratio quantiles out of order');

    // The band split must actually SEPARATE differently-behaved regimes. If
    // bandOf collapsed everything into one bucket the per-band fit would be a
    // pooled fit wearing a different name — the degeneracy this project has
    // already had to delete a test for.
    const fracs = [0.01, 0.03, 0.07, 0.15, 0.3, 0.9];
    assert.equal(new Set(fracs.map(bandOf)).size, 6, 'bands must separate');
}

// --- data ------------------------------------------------------------------

const ds = await loadDataset();

/**
 * Campaign points for a faction at an instant, or null when unknown.
 *
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @returns {number|null}
 */
function pointsAt(season, enemy, t) {
    const st = ds.statusAt(season, enemy, t);
    return st ? Number(st.points) : null;
}

/**
 * The raw ETA in hours: remaining points divided by the trailing 24h pace.
 * Returns null when no forecast is possible — unknown state, a stalled or
 * retreating front (`rate <= 0`), or an already-complete campaign.
 *
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @returns {{etaHours: number, remainingFrac: number}|null}
 */
function rawEta(season, enemy, t) {
    const pointsMax = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    if (!(pointsMax > 0)) return null;

    const now = pointsAt(season, enemy, t);
    const then = pointsAt(season, enemy, t - RATE_WINDOW_HOURS * HOUR);
    if (now === null || then === null) return null;

    const remaining = pointsMax - now;
    if (remaining <= 0) return null; // already complete; the attack has fired

    const ratePerHour = (now - then) / RATE_WINDOW_HOURS;
    if (!(ratePerHour > 0)) return null; // stalled or retreating

    return { etaHours: remaining / ratePerHour, remainingFrac: remaining / pointsMax };
}

/** Is an attack against this faction already running at `t`? */
function attackActive(t, seasonEvents) {
    return seasonEvents.some((e) => e.start_time <= t && e.end_time > t);
}

// --- fit -------------------------------------------------------------------

/**
 * Build a predictor factory whose per-band ratio table accumulates ACROSS eval
 * seasons instead of being rebuilt from scratch each time.
 *
 * `fitPredictor` runs once per evaluation season, and a naive fit walks every
 * training season on every call — O(seasons^2) clock steps across the run. The
 * walk-forward loop visits eval seasons in ascending order, so the training set
 * only ever grows: each season's contribution can be added once and reused.
 *
 * @param {number} enemy
 * @param {number} stepHours must match the evaluation clock exactly
 * @returns {Function} a fitPredictor for walkForward
 */
function makeFitPredictor(enemy, stepHours) {
    /** @type {Map<number, number[]>} band index -> observed wait/eta ratios */
    const ratiosByBand = new Map();
    let accumulatedThrough = 0; // highest season folded into the table

    const attacksBySeason = new Map();
    for (const e of ds.events) {
        if (e.type !== 'attack' || e.enemy !== enemy) continue;
        if (!attacksBySeason.has(e.season)) attacksBySeason.set(e.season, []);
        attacksBySeason.get(e.season).push(e);
    }

    function foldSeason(season) {
        const list = attacksBySeason.get(season);
        const span = ds.seasons.get(season);
        if (!list || !span) return;
        for (let t = span.firstStart; t <= span.lastEnd; t += stepHours * HOUR) {
            const eta = rawEta(season, enemy, t);
            if (!eta) continue;
            const next = list.find((e) => e.start_time > t);
            if (!next) continue; // right-censored — no observed ratio
            const wait = (next.start_time - t) / HOUR;
            const band = bandOf(eta.remainingFrac);
            if (!ratiosByBand.has(band)) ratiosByBand.set(band, []);
            ratiosByBand.get(band).push(wait / eta.etaHours);
        }
    }

    return function fitPredictor(trainEvents, ctx) {
        for (let s = accumulatedThrough + 1; s < ctx.testSeason; s++) foldSeason(s);
        accumulatedThrough = Math.max(accumulatedThrough, ctx.testSeason - 1);
        assert(
            accumulatedThrough < ctx.testSeason,
            `leakage: ratio table folded season ${accumulatedThrough} while testing ${ctx.testSeason}`,
        );

        // Per band, with a pooled fallback for bands too thin to fit alone.
        const perBand = new Map();
        for (const [band, ratios] of ratiosByBand) {
            const q = ratioQuantiles(ratios);
            if (q) perBand.set(band, q);
        }
        const pooled = ratioQuantiles([...ratiosByBand.values()].flat());

        return function predict(moment) {
            const eta = rawEta(moment.season, enemy, moment.t);
            // momentFilter guarantees this is non-null; the guard is for the
            // warm-up moments the harness evaluates before the filter applies.
            if (!eta) return { p25: 0, p50: 0, p75: 0 };
            const q = perBand.get(bandOf(eta.remainingFrac)) ?? pooled;
            if (!q) return { p25: eta.etaHours, p50: eta.etaHours, p75: eta.etaHours };
            return {
                p25: eta.etaHours * q.r25,
                p50: eta.etaHours * q.r50,
                p75: eta.etaHours * q.r75,
            };
        };
    };
}

// --- run -------------------------------------------------------------------

const STEP_HOURS = 3;
const FACTIONS = [
    { enemy: 0, name: 'Bugs' },
    { enemy: 1, name: 'Cyborgs' },
    { enemy: 2, name: 'Illuminate' },
];

console.log('\n=== Phase 9: attack ETA from a known threshold ===\n');
console.log(`  eta = (points_max - points) / rate,  rate over ${RATE_WINDOW_HOURS}h`);
console.log(
    `  Trigger is exact (08-attack-trigger.mjs) — the error budget is entirely pace.\n`,
);

const results = [];
for (const f of FACTIONS) {
    for (const variant of ['filtered', 'unrestricted']) {
        const momentFilter = (t, seasonEvents) => {
            if (seasonEvents.length === 0) return false;
            if (variant === 'filtered' && attackActive(t, seasonEvents)) return false;
            return rawEta(seasonEvents[0].season, f.enemy, t) !== null;
        };

        const summary = walkForward({
            events: ds.events,
            seasons: ds.seasons,
            type: 'attack',
            enemy: f.enemy,
            stepHours: STEP_HOURS,
            fitPredictor: makeFitPredictor(f.enemy, STEP_HOURS),
            momentFilter,
        });
        results.push({ label: `${f.name} / ${variant}`, f, variant, summary });
    }
}

// --- no-forecast rate ------------------------------------------------------

console.log('--- Moments with no forecast (rate <= 0, or state unknown) ---\n');
for (const f of FACTIONS) {
    let total = 0;
    let none = 0;
    for (const [season, span] of ds.seasons) {
        for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
            total++;
            if (!rawEta(season, f.enemy, t)) none++;
        }
    }
    console.log(
        `  ${f.name.padEnd(11)} ${((none / total) * 100).toFixed(1)}% of ${total} moments emit nothing`,
    );
}

// --- main table ------------------------------------------------------------

console.log('\n--- Backtest (walk-forward by season, 925 attacks) ---\n');
console.log(
    'config                    effN   cal 25/50/75      band/marg    MAE/base    skill [95% CI]      clamp',
);
for (const r of results) {
    const s = r.summary;
    const marg = marginalIqr(r.f.enemy, r.variant);
    console.log(
        `${r.label.padEnd(24)} ${String(s.effectiveN).padStart(5)}   ` +
            `${s.calibration.q25.toFixed(3)}/${s.calibration.q50.toFixed(3)}/${s.calibration.q75.toFixed(3)}   ` +
            `${s.sharpnessHours.toFixed(1)}/${marg.toFixed(1)}h   ` +
            `${s.medianAbsErrorHours.toFixed(1)}/${s.baselineMedianAbsErrorHours.toFixed(1)}h   ` +
            `${s.skillRatio.toFixed(3)} [${s.skillRatioCI[0].toFixed(3)}, ${s.skillRatioCI[1].toFixed(3)}]   ` +
            `${(s.clampRateUpper * 100).toFixed(1)}%`,
    );
}

/**
 * Unconditional spread the sharpness leg is read against. For a filtered
 * config that is attack-END to next attack-START (the moments it is actually
 * evaluated on), not raw start-to-start — mirroring 02-baseline.mjs.
 *
 * @param {number} enemy
 * @param {string} variant
 * @returns {number} IQR in hours
 */
function marginalIqr(enemy, variant) {
    const list = ds.events
        .filter((e) => e.type === 'attack' && e.enemy === enemy)
        .sort((a, b) => a.season - b.season || a.start_time - b.start_time);
    const vals = [];
    for (let i = 1; i < list.length; i++) {
        if (list[i].season !== list[i - 1].season) continue;
        const from =
            variant === 'filtered' ? list[i - 1].end_time : list[i - 1].start_time;
        vals.push((list[i].start_time - from) / HOUR);
    }
    return (quantileOf(vals, 0.75) ?? 0) - (quantileOf(vals, 0.25) ?? 0);
}

// --- alert bar (governs shipping) -----------------------------------------

console.log('\n--- Alert bar (the bar this feeds a heads-up UI against) ---');
console.log(`    Line renders when p50 < ${DISPLAY_HOURS}h.`);
console.log('    [1] fires before >=70% of attacks   [2] followed within 2x p75 >=80%\n');

for (const r of results.filter((x) => x.variant === 'filtered')) {
    const recs = r.summary.records.filter((x) => x.wait !== null);
    const targets = new Set(recs.map((x) => x.target));
    const fired = new Set(recs.filter((x) => x.q50 < DISPLAY_HOURS).map((x) => x.target));
    const showing = recs.filter((x) => x.q50 < DISPLAY_HOURS);
    const honoured = showing.filter((x) => x.wait < 2 * x.q75);

    const recall = targets.size > 0 ? fired.size / targets.size : 0;
    const precision = showing.length > 0 ? honoured.length / showing.length : 0;
    const pass = recall >= 0.7 && precision >= 0.8;

    // Calibration RESTRICTED TO THE DISPLAY REGIME. The whole-run calibration
    // figure averages over moments the UI never renders. What a shipped line
    // stands or falls on is whether it is honest in the <24h window where it
    // actually appears — and the reliability table suggests that is the
    // model's worst-behaved stratum, not its best.
    const hit = (q) => showing.filter((x) => x.wait < x[q]).length / showing.length;
    console.log(
        `  ${r.label.padEnd(24)} fires before ${(recall * 100).toFixed(1)}% of ${targets.size} attacks` +
            ` | followed ${(precision * 100).toFixed(1)}% of ${showing.length} showing` +
            ` => ${pass ? 'PASS' : 'FAIL'}`,
    );
    console.log(
        `    ${''.padEnd(22)} calibration WHEN SHOWING: ` +
            `p25=${hit('q25').toFixed(3)}/0.250  p50=${hit('q50').toFixed(3)}/0.500  p75=${hit('q75').toFixed(3)}/0.750` +
            `  median true wait ${(
                quantileOf(
                    showing.map((x) => x.wait),
                    0.5,
                ) ?? 0
            ).toFixed(1)}h`,
    );
}

// --- reliability (marginal calibration can hide stratum-level failure) -----

console.log('\n--- Reliability by predicted-p50 decile, Bugs / filtered ---\n');
const bugs = results.find((r) => r.label === 'Bugs / filtered');
console.log('  decile   n     predicted p50 range     observed   nominal 0.500');
for (const b of bugs.summary.reliability) {
    const off = Math.abs(b.observed - 0.5);
    console.log(
        `  ${String(b.decile).padStart(6)} ${String(b.n).padStart(5)}   ` +
            `${b.p50Low.toFixed(1)}-${b.p50High.toFixed(1)}h`.padEnd(22) +
            `  ${b.observed.toFixed(3)}    ${off > 0.05 ? `off by ${off.toFixed(3)}` : 'ok'}`,
    );
}

// --- gate (reported, not governing) ---------------------------------------

console.log('\n--- Three-leg gate (reported for continuity with the defend work) ---\n');
for (const r of results) {
    const s = r.summary;
    const calOk =
        Math.abs(s.calibration.q25 - 0.25) <= 0.05 &&
        Math.abs(s.calibration.q50 - 0.5) <= 0.05 &&
        Math.abs(s.calibration.q75 - 0.75) <= 0.05;
    const sharpness =
        s.clampRateBand > 0.1 ? 'UNREADABLE (clamped)'
        : s.sharpnessHours < marginalIqr(r.f.enemy, r.variant) ? 'PASS'
        : 'FAIL';
    console.log(
        `  ${r.label.padEnd(24)} calibration ${calOk ? 'PASS' : 'FAIL'}, ` +
            `skill CI hi ${s.skillRatioCI[1].toFixed(3)} vs 0.600, sharpness ${sharpness}`,
    );
}

console.log('');
