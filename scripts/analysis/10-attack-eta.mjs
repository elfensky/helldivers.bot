/**
 * 10-attack-eta.mjs — how well does (points_max - points) / rate predict an attack?
 *
 * `09-attack-trigger.mjs` established that attacks fire within minutes of
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
 * Run: node --env-file=.env.development scripts/analysis/10-attack-eta.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const RATE_WINDOW_HOURS = 24;
const DISPLAY_HOURS = 48; // the UI only renders a line when p50 is under this

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

/** Never emit an ETA below this; the campaign may already be complete. */
const MIN_ETA_HOURS = 0.25;

/**
 * The raw ETA in hours: remaining points divided by recent pace.
 * Returns null when no forecast is possible — unknown state, a stalled or
 * retreating front (`rate <= 0`), or an already-complete campaign.
 *
 * **Staleness anchoring.** `points` comes from the last bucket at or before
 * `t`, which for 156 of 160 seasons can be up to 24h old. `remaining / rate` is
 * therefore the wait measured from *when the reading was taken*, not from `t`.
 * The correction falls out algebraically — extrapolating the reading forward at
 * the same rate is identical to subtracting the reading's age:
 *
 *     (max - points - rate*age) / rate  ==  (max - points)/rate - age
 *
 * Uncorrected, the median historical reading age is ~12h, so ETAs in the
 * sub-24h display regime were inflated by roughly their own magnitude. Live the
 * age is ~15 min and the correction is negligible — which is exactly why this
 * shows up as a backtest artifact rather than a production one.
 *
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @param {boolean} correctStaleness anchor the ETA at `t` rather than at the bucket
 * @returns {{etaHours: number, remainingFrac: number}|null}
 */
function rawEta(season, enemy, t, correctStaleness, paceAdjust = null) {
    const pointsMax = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    if (!(pointsMax > 0)) return null;

    const stNow = ds.statusAt(season, enemy, t);
    const stThen = ds.statusAt(season, enemy, t - RATE_WINDOW_HOURS * HOUR);
    if (!stNow || !stThen) return null;

    const now = Number(stNow.points);
    const remaining = pointsMax - now;
    if (remaining <= 0) return null; // already complete; the attack has fired

    // Divide by the ACTUAL span between the two readings, not the nominal 24h.
    // On daily buckets the two rarely sit exactly a day apart, and using the
    // nominal window silently misreports the pace by that discrepancy.
    const spanHours = (Number(stNow.bucket) - Number(stThen.bucket)) / HOUR;
    if (!(spanHours > 0)) return null;
    const ratePerHour = (now - Number(stThen.points)) / spanHours;
    if (!(ratePerHour > 0)) return null; // stalled or retreating

    let etaHours = remaining / ratePerHour;

    // Day-of-week correction, applied as a one-step iteration: the horizon it
    // needs to average over is the ETA itself, so the uncorrected ETA picks the
    // window and the adjusted rate then produces the final answer. Availability
    // is unaffected — the multiplier is strictly positive — which is why
    // `momentFilter` can decide with the unadjusted call and stay non-circular.
    if (paceAdjust) {
        const horizon = Math.min(Math.max(etaHours, 1), 48);
        const adj = paceAdjust(
            Number(stThen.bucket),
            Number(stNow.bucket),
            t,
            t + horizon * HOUR,
        );
        // eta = remaining / (rate * ahead/past) = eta_raw * (past/ahead), and
        // `adj` IS past/ahead — so this multiplies. Dividing here inverts the
        // correction: a faster week ahead would push the arrival LATER.
        if (adj > 0) etaHours *= adj;
    }

    if (correctStaleness) etaHours -= (t - Number(stNow.bucket)) / HOUR;
    if (etaHours < MIN_ETA_HOURS) etaHours = MIN_ETA_HOURS;

    return { etaHours, remainingFrac: remaining / pointsMax };
}

/** Is an attack against this faction already running at `t`? */
function attackActive(t, seasonEvents) {
    return seasonEvents.some((e) => e.start_time <= t && e.end_time > t);
}

// --- day-of-week pace pattern ---------------------------------------------

/**
 * Campaign pace has a weekly rhythm — measured across all 160 seasons, the
 * busiest day runs ~29% faster than the quietest. A 24-hour rate window covers
 * roughly one day, so it carries *yesterday's* day-of-week into a forecast
 * about tomorrow's, and that mismatch is correctable.
 *
 * Only DAY of week, not hour: for 156 of 160 seasons a status transition spans
 * a whole day, so attributing it to one hour would be fiction. Hour-of-day is
 * computable on S157+ alone and mostly cancels inside a 24h window anyway.
 *
 * Factors accumulate walk-forward, one season folded in at a time.
 *
 * @returns {{foldThrough: (s: number) => void, adjuster: () => Function}}
 */
function makeDowPattern() {
    const byDow = Array.from({ length: 7 }, () => []);
    let through = 0;

    function fold(season) {
        for (const enemy of [0, 1, 2]) {
            const series = ds.statusSeries(season, enemy);
            if (series.length < 3) continue;
            const local = [];
            for (let i = 1; i < series.length; i++) {
                const dt =
                    (Number(series[i].bucket) - Number(series[i - 1].bucket)) / HOUR;
                if (dt <= 0) continue;
                const pace =
                    (Number(series[i].points) - Number(series[i - 1].points)) / dt;
                if (pace > 0) {
                    local.push({
                        dow: new Date(Number(series[i].bucket) * 1000).getUTCDay(),
                        pace,
                    });
                }
            }
            if (local.length < 5) continue;
            // Normalise to this campaign's OWN median. points_max and player
            // populations differ by orders of magnitude across 160 seasons;
            // pooling raw paces would measure era, not weekday.
            const m = quantileOf(
                local.map((x) => x.pace),
                0.5,
            );
            if (!(m > 0)) continue;
            for (const x of local) byDow[x.dow].push(x.pace / m);
        }
    }

    return {
        foldThrough(testSeason) {
            for (let s = through + 1; s < testSeason; s++) fold(s);
            through = Math.max(through, testSeason - 1);
            assert(
                through < testSeason,
                `leakage: day-of-week pattern folded season ${through} while testing ${testSeason}`,
            );
        },
        adjuster() {
            const f = byDow.map((v) => (v.length >= 50 ? (quantileOf(v, 0.5) ?? 1) : 1));
            const meanOver = (from, to) => {
                let sum = 0;
                let n = 0;
                for (let t = from; t < to; t += 6 * HOUR) {
                    sum += f[new Date(t * 1000).getUTCDay()];
                    n++;
                }
                return n > 0 ? sum / n : 1;
            };
            return (winFrom, winTo, fwdFrom, fwdTo) => {
                const past = meanOver(winFrom, winTo);
                const ahead = meanOver(fwdFrom, fwdTo);
                return past > 0 ? past / ahead : 1;
            };
        },
    };
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
 * @param {boolean} correctStaleness anchor ETAs at the evaluation moment
 * @param {object|null} dowPattern walk-forward day-of-week learner, or null
 * @returns {Function} a fitPredictor for walkForward
 */
function makeFitPredictor(enemy, stepHours, correctStaleness, dowPattern) {
    /** @type {Map<number, number[]>} band index -> observed wait/eta ratios */
    const ratiosByBand = new Map();
    let accumulatedThrough = 0; // highest season folded into the table

    const attacksBySeason = new Map();
    for (const e of ds.events) {
        if (e.type !== 'attack' || e.enemy !== enemy) continue;
        if (!attacksBySeason.has(e.season)) attacksBySeason.set(e.season, []);
        attacksBySeason.get(e.season).push(e);
    }

    function foldSeason(season, adjust) {
        const list = attacksBySeason.get(season);
        const span = ds.seasons.get(season);
        if (!list || !span) return;
        for (let t = span.firstStart; t <= span.lastEnd; t += stepHours * HOUR) {
            const eta = rawEta(season, enemy, t, correctStaleness, adjust);
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
        if (dowPattern) dowPattern.foldThrough(ctx.testSeason);
        const adjust = dowPattern ? dowPattern.adjuster() : null;
        for (let s = accumulatedThrough + 1; s < ctx.testSeason; s++)
            foldSeason(s, adjust);
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
            const eta = rawEta(moment.season, enemy, moment.t, correctStaleness, adjust);
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
    `  Trigger is exact (09-attack-trigger.mjs) — the error budget is entirely pace.\n`,
);

const VARIANTS = [
    { key: 'corrected', correct: true, dow: false },
    { key: 'corrected+dow', correct: true, dow: true },
    { key: 'uncorrected', correct: false, dow: false },
];

const results = [];
for (const v of VARIANTS) {
    for (const f of FACTIONS) {
        const momentFilter = (t, seasonEvents) => {
            if (seasonEvents.length === 0) return false;
            if (attackActive(t, seasonEvents)) return false;
            return rawEta(seasonEvents[0].season, f.enemy, t, v.correct) !== null;
        };
        const summary = walkForward({
            events: ds.events,
            seasons: ds.seasons,
            type: 'attack',
            enemy: f.enemy,
            stepHours: STEP_HOURS,
            fitPredictor: makeFitPredictor(
                f.enemy,
                STEP_HOURS,
                v.correct,
                v.dow ? makeDowPattern() : null,
            ),
            momentFilter,
        });
        results.push({
            label: `${f.name} / ${v.key}`,
            f,
            variant: 'filtered',
            correct: v.correct,
            summary,
        });
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
            if (!rawEta(season, f.enemy, t, true)) none++;
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

for (const r of results) {
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

// --- band shape: does the window narrow as the attack approaches? ---------

console.log('\n--- What the UI would actually show, Bugs / corrected ---\n');
console.log('  says (p50)     shown range      width    true wait p50   n');
{
    const recs = results
        .find((r) => r.label === 'Bugs / corrected')
        .summary.records.filter((x) => x.wait !== null && x.q50 < DISPLAY_HOURS);
    const EDGES = [0, 4, 8, 12, 16, 20, 24];
    for (let i = 0; i < EDGES.length - 1; i++) {
        const chunk = recs.filter((x) => x.q50 >= EDGES[i] && x.q50 < EDGES[i + 1]);
        if (chunk.length === 0) continue;
        const q = (k) =>
            quantileOf(
                chunk.map((x) => x[k]),
                0.5,
            ) ?? 0;
        console.log(
            `  ${EDGES[i]}-${EDGES[i + 1]}h`.padEnd(15) +
                `${q('q25').toFixed(1)}-${q('q75').toFixed(1)}h`.padEnd(17) +
                `${(q('q75') - q('q25')).toFixed(1)}h`.padEnd(9) +
                `${(
                    quantileOf(
                        chunk.map((x) => x.wait),
                        0.5,
                    ) ?? 0
                ).toFixed(1)}h`.padEnd(16) +
                chunk.length,
        );
    }
}

// --- reliability (marginal calibration can hide stratum-level failure) -----

console.log('\n--- Reliability by predicted-p50 decile, Bugs / corrected ---\n');
const bugs = results.find((r) => r.label === 'Bugs / corrected');
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
