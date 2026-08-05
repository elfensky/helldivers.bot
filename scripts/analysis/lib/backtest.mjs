/**
 * backtest.mjs — walk-forward-by-season evaluation for #472.
 *
 * Knows nothing about any particular predictor: callers supply `fitPredictor`.
 *
 * Self-check: node scripts/analysis/lib/backtest.mjs   (no DB needed)
 */

import assert from 'node:assert/strict';
import { HOUR } from './dataset.mjs';

/**
 * Linear-interpolated quantile of an unsorted numeric array.
 *
 * @param {number[]} values
 * @param {number} q in [0, 1]
 * @returns {number|null}
 */
export function quantileOf(values, q) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const pos = q * (s.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return s[lo];
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Median forward-recurrence wait sampled on the same clock the evaluation uses.
 *
 * This — NOT the median gap — is the correct constant baseline. Waits are
 * observed from a uniformly random clock moment, and forward recurrence time is
 * length-biased relative to the gap distribution. On the real data the two
 * differ by 54.5h vs 46.8h, which inflates skill ratios by ~12%.
 *
 * @param {object[]} trainEvents matching events from training seasons
 * @param {Map<number, object>} seasons
 * @param {number} stepHours
 * @param {((t: number, seasonEvents: object[]) => boolean)|null} momentFilter the SAME
 *   filter the evaluation loop applies. Without it the constant is fit to the
 *   unfiltered moment distribution while the model is scored on the filtered one,
 *   so the skill ratio partly measures the filter rather than the model.
 * @returns {number}
 */
function forwardRecurrenceMedian(trainEvents, seasons, stepHours, momentFilter = null) {
    const bySeason = new Map();
    for (const e of trainEvents) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }

    const waits = [];
    for (const [season, list] of bySeason) {
        const span = seasons.get(season);
        if (!span) continue;
        for (let t = span.firstStart; t <= span.lastEnd; t += stepHours * HOUR) {
            if (momentFilter && !momentFilter(t, list)) continue;
            const next = list.find((e) => e.start_time > t);
            if (next) waits.push((next.start_time - t) / HOUR);
        }
    }
    return quantileOf(waits, 0.5) ?? 0;
}

/**
 * Walk-forward-by-season backtest.
 *
 * For each evaluation season N: fit on seasons < N only, then step a clock
 * through N in `stepHours` increments. At each moment the predictor emits
 * p25/p50/p75 of the wait (hours) until the next matching event start strictly
 * after that moment.
 *
 * Moments with no subsequent event are RIGHT-CENSORED, not dropped. The true
 * wait is known to exceed the remaining span `c`, so any predicted quantile
 * `q <= c` still yields an answerable comparison (`trueWait < q` is false).
 * Only `q > c` is unknown. For the error metric, a censored moment with
 * `p50 <= c` contributes the lower bound `c - p50`.
 *
 * Returned summary fields: `moments`/`uncensored`/`censoredScored`/
 * `censoredUnknown`/`warmupSkipped` (moment counts), `effectiveN` (distinct
 * target events, not clock moments), `calibration`/`calibrationN` (the
 * censoring-aware `{q25,q50,q75}` hit rate — the PRIMARY metric read against
 * the gate, see `calibrationFor` above), `calibrationUncensored`/
 * `calibrationUncensoredN` (DIAGNOSTIC-ONLY `{q25,q50,q75}` hit rate
 * restricted to uncensored moments — NOT the gate metric, see
 * `calibrationUncensoredFor` above), `sharpnessHours` (median p25-p75 band
 * width), `medianAbsErrorHours`/`baselineMedianAbsErrorHours` (predictor vs.
 * constant-baseline error), and `skillRatio`/`skillRatioCI` (their ratio and
 * its 95% season-block-bootstrap CI).
 *
 * @param {object} options `allowNoPriorEvent` additionally evaluates moments
 *   before a season's first matching event (predict receives `lastEvent: null`)
 *   — only valid for predictors that never read `moment.lastEvent`.
 * @returns {object} summary
 */
export function walkForward({
    events,
    seasons,
    type,
    enemy,
    fitPredictor,
    stepHours = 3,
    firstEvalSeason = 21,
    horizonHours = 1500,
    bootstrapSamples = 200,
    momentFilter = null,
    allowNoPriorEvent = false,
}) {
    const matching = events
        .filter((e) => e.type === type && (enemy === undefined || e.enemy === enemy))
        .sort((a, b) => a.season - b.season || a.start_time - b.start_time);

    const evalSeasons = [...new Set(matching.map((e) => e.season))]
        .filter((s) => s >= firstEvalSeason)
        .sort((a, b) => a - b);

    // One record per evaluated moment. Keeping them in a flat list (rather than
    // parallel arrays) is what makes the season-level block bootstrap cheap.
    /**
     * `t` is the evaluated clock moment — the key that lets callers pair the
     * SAME moment across separate walkForward runs (`${season}:${t}`) for a
     * paired-error comparison between predictor variants.
     *
     * @type {{season: number, t: number, target: string, wait: number|null,
     *          censorAt: number|null, p25: number, p50: number, p75: number,
               absErr: number|null, baselineAbsErr: number|null}[]} */
    const records = [];
    let warmupSkipped = 0;
    let censoredUnknown = 0;
    let clampedUpper = 0;
    let clampedBand = 0;

    for (const testSeason of evalSeasons) {
        const trainEvents = matching.filter((e) => e.season < testSeason);
        if (trainEvents.length < 30) continue;

        // Leakage guard — defensive no-op retained for symmetry with the
        // post-fitPredictor check below. `trainEvents` was just built by
        // `matching.filter(e => e.season < testSeason)` above, so this
        // specific assert can never fire; the real work happens after
        // `fitPredictor` runs, where a predictor that mutates its training
        // array would otherwise slip future data past this guard.
        for (const e of trainEvents) {
            assert(
                e.season < testSeason,
                `leakage: training row from season ${e.season} while testing ${testSeason}`,
            );
        }

        const trainGaps = [];
        for (let i = 1; i < trainEvents.length; i++) {
            if (trainEvents[i].season === trainEvents[i - 1].season) {
                trainGaps.push(
                    (trainEvents[i].start_time - trainEvents[i - 1].start_time) / HOUR,
                );
            }
        }
        // Forward-recurrence median, NOT median gap. See the note above.
        const baselineConstant = forwardRecurrenceMedian(
            trainEvents,
            seasons,
            stepHours,
            momentFilter,
        );

        const predict = fitPredictor(trainEvents, {
            testSeason,
            trainGaps,
            baselineConstant,
        });
        // fitPredictor may mutate its own copy; re-verify nothing future leaked in.
        for (const e of trainEvents) {
            assert(
                e.season < testSeason,
                `leakage: training set mutated to include season ${e.season} while testing ${testSeason}`,
            );
        }

        const seasonEvents = matching.filter((e) => e.season === testSeason);
        const span = seasons.get(testSeason);
        if (!span || seasonEvents.length === 0) continue;

        for (let t = span.firstStart; t <= span.lastEnd; t += stepHours * HOUR) {
            if (momentFilter && !momentFilter(t, seasonEvents)) continue;

            // Before the season's first matching event there is no meaningful
            // "time since last event" — falling back to the previous season's
            // last event would feed the predictor a multi-month elapsed value.
            // `allowNoPriorEvent` opts a predictor that never reads
            // `moment.lastEvent` (e.g. a points-rate forecast) into these
            // moments: they have a perfectly well-defined next event, and for
            // seasons with a single matching event they are the ONLY
            // uncensored moments the season can contribute.
            const lastEvent = seasonEvents.filter((e) => e.start_time <= t).at(-1);
            if (!lastEvent && !allowNoPriorEvent) {
                warmupSkipped++;
                continue;
            }

            const next = seasonEvents.find((e) => e.start_time > t);
            const p = predict({
                t,
                season: testSeason,
                enemy,
                lastEvent: lastEvent ?? null,
            });
            const q25 = Math.min(p.p25, horizonHours);
            const q50 = Math.min(p.p50, horizonHours);
            const q75 = Math.min(p.p75, horizonHours);
            // A record whose p25 also clamps contributes a band of width ZERO to
            // `sharpnessHours`. Enough of those and the sharpness leg reports a
            // PASS that is purely an artifact of the horizon, so the rate is
            // surfaced rather than left implicit.
            if (p.p75 > horizonHours) clampedUpper++;
            if (p.p25 > horizonHours) clampedBand++;

            if (next) {
                const wait = (next.start_time - t) / HOUR;
                records.push({
                    season: testSeason,
                    t,
                    target: `${testSeason}:${next.start_time}`,
                    wait,
                    censorAt: null,
                    q25,
                    q50,
                    q75,
                    absErr: Math.abs(wait - q50),
                    baselineAbsErr: Math.abs(wait - baselineConstant),
                });
            } else {
                // Right-censored: the true wait exceeds the remaining span.
                const censorAt = (span.lastEnd - t) / HOUR;
                if (censorAt <= 0) continue;
                records.push({
                    season: testSeason,
                    t,
                    target: `${testSeason}:censored`,
                    wait: null,
                    censorAt,
                    q25,
                    q50,
                    q75,
                    // |true - q50| >= censorAt - q50 when q50 <= censorAt.
                    absErr: q50 <= censorAt ? censorAt - q50 : null,
                    baselineAbsErr:
                        baselineConstant <= censorAt ? censorAt - baselineConstant : null,
                });
                if (q50 > censorAt) censoredUnknown++;
            }
        }
    }

    assert(records.length > 0, 'backtest produced no evaluable moments');

    /**
     * Censoring-aware calibration for one quantile level.
     *
     * Uncensored: `wait < q` is directly answerable.
     * Censored at c: answerable only when `q <= c`, and then it is false.
     *
     * This is the PRIMARY calibration metric — do not change its treatment of
     * censored moments. See `calibrationUncensoredFor` below for the
     * diagnostic-only, uncensored-restricted variant.
     *
     * @param {'q25'|'q50'|'q75'} key
     * @returns {{rate: number, n: number}}
     */
    function calibrationFor(key) {
        let hits = 0;
        let answerable = 0;
        for (const r of records) {
            const q = r[key];
            if (r.wait !== null) {
                answerable++;
                if (r.wait < q) hits++;
            } else if (q <= r.censorAt) {
                answerable++; // known false — true wait exceeds c >= q
            }
        }
        return { rate: answerable > 0 ? hits / answerable : 0, n: answerable };
    }

    /**
     * Uncensored-only calibration for one quantile level — DIAGNOSTIC, not the
     * gate metric. Restricted to moments where the true wait was actually
     * observed (`wait !== null`), dropping every right-censored moment rather
     * than scoring it as a known-false hit like `calibrationFor` does. Useful
     * for isolating whether a censoring-aware calibration failure is driven by
     * the censored moments themselves, but it is not a substitute for
     * `calibrationFor` — it silently discards information the primary metric
     * is deliberately designed to keep.
     *
     * @param {'q25'|'q50'|'q75'} key
     * @returns {{rate: number, n: number}}
     */
    function calibrationUncensoredFor(key) {
        let hits = 0;
        let n = 0;
        for (const r of records) {
            if (r.wait === null) continue;
            n++;
            if (r.wait < r[key]) hits++;
        }
        return { rate: n > 0 ? hits / n : 0, n };
    }

    const scored = records.filter((r) => r.absErr !== null);
    const baselineScored = records.filter((r) => r.baselineAbsErr !== null);

    const medianAbsErrorHours =
        quantileOf(
            scored.map((r) => r.absErr),
            0.5,
        ) ?? 0;
    const baselineMedianAbsErrorHours =
        quantileOf(
            baselineScored.map((r) => r.baselineAbsErr),
            0.5,
        ) ?? 0;
    const skillRatio =
        baselineMedianAbsErrorHours > 0 ?
            medianAbsErrorHours / baselineMedianAbsErrorHours
        :   Infinity;

    // Season-level block bootstrap. Resampling SEASONS (not moments) is what
    // respects the autocorrelation 3h stepping introduces — moments inside one
    // inter-arrival interval are near-duplicates and must move together.
    const seasonIds = [...new Set(records.map((r) => r.season))];
    const bySeasonRecords = new Map(
        seasonIds.map((s) => [s, records.filter((r) => r.season === s)]),
    );
    const ratios = [];
    // ponytail: fixed-seed LCG inline — the harness must stay import-free of
    // dataset.mjs so its self-check runs with no DB.
    let rngState = 987654321;
    const rand = () => {
        rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
        return rngState / 4294967296;
    };
    for (let b = 0; b < bootstrapSamples; b++) {
        const sample = [];
        for (let i = 0; i < seasonIds.length; i++) {
            const pick = seasonIds[Math.floor(rand() * seasonIds.length)];
            sample.push(...bySeasonRecords.get(pick));
        }
        const m = quantileOf(
            sample.filter((r) => r.absErr !== null).map((r) => r.absErr),
            0.5,
        );
        const base = quantileOf(
            sample.filter((r) => r.baselineAbsErr !== null).map((r) => r.baselineAbsErr),
            0.5,
        );
        if (m !== null && base !== null && base > 0) ratios.push(m / base);
    }
    ratios.sort((a, b) => a - b);
    const skillRatioCI =
        ratios.length > 0 ?
            [
                quantileOf(ratios, 0.025) ?? skillRatio,
                quantileOf(ratios, 0.975) ?? skillRatio,
            ]
        :   [skillRatio, skillRatio];

    const widths = records.map((r) => r.q75 - r.q25);

    /**
     * Reliability by predicted-p50 decile. `calibrationFor` pools every record,
     * so it is a MARGINAL check: a model can pass it while being badly
     * miscalibrated in every stratum, with the errors cancelling. This splits
     * the same hit rate by predicted magnitude so that cancellation is visible.
     * Diagnostic only — not a gate leg.
     */
    function reliabilityByDecile() {
        const scored = records.filter((r) => r.wait !== null);
        if (scored.length === 0) return [];
        const sorted = [...scored].sort((a, b) => a.q50 - b.q50);
        const perBin = Math.ceil(sorted.length / 10);
        const bins = [];
        for (let i = 0; i < sorted.length; i += perBin) {
            const chunk = sorted.slice(i, i + perBin);
            if (chunk.length === 0) continue;
            bins.push({
                decile: bins.length + 1,
                n: chunk.length,
                p50Low: chunk[0].q50,
                p50High: chunk.at(-1).q50,
                observed: chunk.filter((r) => r.wait < r.q50).length / chunk.length,
            });
        }
        return bins;
    }

    return {
        // Per-moment records, so callers can compute metrics the summary does
        // not cover (e.g. an alert-quality bar: did a forecast fire before each
        // target event, and how often was it followed by one).
        records,
        clampRateUpper: records.length > 0 ? clampedUpper / records.length : 0,
        clampRateBand: records.length > 0 ? clampedBand / records.length : 0,
        reliability: reliabilityByDecile(),
        moments: records.length,
        uncensored: records.filter((r) => r.wait !== null).length,
        censoredScored: records.filter((r) => r.wait === null && r.absErr !== null)
            .length,
        censoredUnknown,
        warmupSkipped,
        // Distinct target events, not clock moments. This is the honest N.
        effectiveN: new Set(records.filter((r) => r.wait !== null).map((r) => r.target))
            .size,
        calibration: {
            q25: calibrationFor('q25').rate,
            q50: calibrationFor('q50').rate,
            q75: calibrationFor('q75').rate,
        },
        calibrationN: {
            q25: calibrationFor('q25').n,
            q50: calibrationFor('q50').n,
            q75: calibrationFor('q75').n,
        },
        // Diagnostic-only — NOT the gate metric. See calibrationUncensoredFor.
        calibrationUncensored: {
            q25: calibrationUncensoredFor('q25').rate,
            q50: calibrationUncensoredFor('q50').rate,
            q75: calibrationUncensoredFor('q75').rate,
        },
        calibrationUncensoredN: {
            q25: calibrationUncensoredFor('q25').n,
            q50: calibrationUncensoredFor('q50').n,
            q75: calibrationUncensoredFor('q75').n,
        },
        sharpnessHours: quantileOf(widths, 0.5) ?? 0,
        medianAbsErrorHours,
        baselineMedianAbsErrorHours,
        skillRatio,
        skillRatioCI,
    };
}

if (import.meta.filename === process.argv[1]) {
    // A synthetic world: seasons 1..30, one 'attack' every 10h for 20 days.
    const events = [];
    const seasons = new Map();
    for (let s = 1; s <= 30; s++) {
        const base = s * 10_000_000;
        for (let k = 0; k < 48; k++) {
            events.push({
                season: s,
                type: 'attack',
                enemy: 0,
                start_time: base + k * 10 * 3600,
                end_time: base + k * 10 * 3600 + 3600,
            });
        }
        seasons.set(s, {
            season: s,
            firstStart: base,
            lastEnd: base + 48 * 10 * 3600,
            spanSeconds: 48 * 10 * 3600,
        });
    }

    // A predictor that knows the true period nails calibration and skill.
    const oracle = () => (moment) => {
        const elapsed = (moment.t - moment.lastEvent.start_time) / 3600;
        const wait = 10 - (elapsed % 10);
        return { p25: wait, p50: wait, p75: wait };
    };

    const good = walkForward({
        events,
        seasons,
        type: 'attack',
        enemy: 0,
        fitPredictor: oracle,
    });

    assert(good.moments > 0, 'no moments evaluated');
    assert(
        good.medianAbsErrorHours < 0.001,
        `oracle should be near-exact, got ${good.medianAbsErrorHours}`,
    );

    // Every record carries the evaluated moment `t`, and `(season, t)` is
    // unique — the invariant paired cross-variant comparisons rely on.
    {
        const keys = new Set();
        for (const r of good.records) {
            assert(Number.isFinite(r.t), 'record is missing a finite t');
            const key = `${r.season}:${r.t}`;
            assert(!keys.has(key), `duplicate record moment ${key}`);
            keys.add(key);
        }
    }
    assert(good.skillRatio < 0.5, `oracle skill ratio too high: ${good.skillRatio}`);
    assert(good.sharpnessHours === 0, 'oracle bands should have zero width');

    // Effective N must count target EVENTS, not clock moments. With a 10h
    // period and 3h stepping there are ~3.3 moments per event, so effectiveN
    // has to come out far below `moments` — this is the guard against
    // reporting 4.9x-overstated precision.
    assert(
        good.effectiveN < good.moments / 2,
        `effectiveN (${good.effectiveN}) should be well under moments (${good.moments})`,
    );

    // Censored moments must be SCORED, not dropped. In this synthetic world the
    // clock runs to lastEnd, past the final event start, so censored moments
    // exist and the ones with q <= remaining span must be counted.
    assert(
        good.censoredScored > 0,
        'censored moments were not scored — the drop-bias is back',
    );

    // The bootstrap CI must bracket the point estimate. Necessary but not
    // sufficient — holds for essentially any centered resampling scheme, so
    // it cannot by itself catch a regression to per-moment resampling. See
    // the discriminating check below.
    assert(
        good.skillRatioCI[0] <= good.skillRatio &&
            good.skillRatio <= good.skillRatioCI[1],
        `CI ${JSON.stringify(good.skillRatioCI)} does not bracket ${good.skillRatio}`,
    );

    // A second synthetic world that can actually TELL APART season-level
    // block bootstrap from naive per-moment bootstrap. The oracle world above
    // cannot: it is perfectly periodic with a zero-variance predictor, so
    // every resampling scheme agrees. Here, seasons alternate a 10h
    // inter-arrival period (odd) and a 40h period (even), and the predictor
    // always predicts a constant 5h regardless of season or moment — a good
    // fit for the 10h seasons, a poor one for the 40h seasons. That produces
    // sharply different per-season-type absolute error.
    //
    // A season-level bootstrap samples whole seasons, so a given resample can
    // land mostly-odd, mostly-even, or mixed — it inherits the between-season
    // spread and yields a WIDE CI. A moment-level bootstrap draws individual
    // moments from the ~1600-moment pool, which is close to a 50/50 mix of
    // both populations in every draw by the law of large numbers — the
    // resampled median barely moves, collapsing the CI toward zero width.
    const varyingEvents = [];
    const varyingSeasons = new Map();
    const VARYING_SPAN_HOURS = 480;
    for (let s = 1; s <= 30; s++) {
        const base = s * 10_000_000;
        const period = s % 2 === 1 ? 10 : 40; // odd seasons: 10h, even: 40h
        const count = Math.floor(VARYING_SPAN_HOURS / period);
        for (let k = 0; k < count; k++) {
            varyingEvents.push({
                season: s,
                type: 'attack',
                enemy: 0,
                start_time: base + k * period * 3600,
                end_time: base + k * period * 3600 + 3600,
            });
        }
        varyingSeasons.set(s, {
            season: s,
            firstStart: base,
            lastEnd: base + VARYING_SPAN_HOURS * 3600,
            spanSeconds: VARYING_SPAN_HOURS * 3600,
        });
    }
    const constantPredictor = () => () => ({ p25: 5, p50: 5, p75: 5 });

    const varying = walkForward({
        events: varyingEvents,
        seasons: varyingSeasons,
        type: 'attack',
        enemy: 0,
        fitPredictor: constantPredictor,
    });

    // Empirically measured against this exact fixture: the current
    // season-level block bootstrap gives a CI width of ~0.625; mutating the
    // bootstrap loop to resample individual
    // moments instead of whole seasons collapses that width to 0.000. 0.2
    // sits with wide margin above the moment-level failure mode (0) and wide
    // margin below the season-level result (0.625) — a regression to
    // per-moment resampling cannot pass this.
    const varyingWidth = varying.skillRatioCI[1] - varying.skillRatioCI[0];
    assert(
        varyingWidth > 0.2,
        `season-block CI width (${varyingWidth}) too narrow — resampling may have ` +
            `regressed to per-moment (autocorrelation-blind) sampling`,
    );

    // The baseline constant must be the forward-recurrence median, not the gap
    // median. With a perfectly periodic 10h process, forward recurrence from a
    // uniform clock averages ~5h while the gap is 10h — so a baseline built on
    // the gap would be visibly wrong. Assert the harness picked the right one.
    let capturedBaseline = null;
    walkForward({
        events,
        seasons,
        type: 'attack',
        enemy: 0,
        fitPredictor: (_trainEvents, ctx) => {
            capturedBaseline = ctx.baselineConstant;
            return () => ({ p25: 1, p50: 1, p75: 1 });
        },
        bootstrapSamples: 0,
    });
    assert(
        capturedBaseline !== null && capturedBaseline < 8,
        `baseline should be forward-recurrence (~5h), got ${capturedBaseline}`,
    );

    // allowNoPriorEvent must open up the pre-first-event moments (and only
    // those): a lastEvent-blind predictor gains moments, warmup drops to zero,
    // and every gained moment still has a well-defined target. The oracle
    // world starts its span AT the first event, so a dedicated fixture puts
    // the season start 50h earlier — the real dataset does this whenever
    // another event type opens the season before the first attack.
    {
        const warmupSeasons = new Map(
            [...seasons].map(([s, span]) => [
                s,
                { ...span, firstStart: span.firstStart - 50 * 3600 },
            ]),
        );
        const constant = () => () => ({ p25: 5, p50: 5, p75: 5 });
        const closed = walkForward({
            events,
            seasons: warmupSeasons,
            type: 'attack',
            enemy: 0,
            fitPredictor: constant,
            bootstrapSamples: 0,
        });
        const open = walkForward({
            events,
            seasons: warmupSeasons,
            type: 'attack',
            enemy: 0,
            fitPredictor: constant,
            bootstrapSamples: 0,
            allowNoPriorEvent: true,
        });
        assert(open.moments > closed.moments, 'allowNoPriorEvent gained no moments');
        assert.equal(open.warmupSkipped, 0, 'allowNoPriorEvent still skipped warmup');
        assert.equal(
            open.moments,
            closed.moments + closed.warmupSkipped,
            'allowNoPriorEvent changed moments beyond the warmup set',
        );
    }

    // momentFilter must actually exclude moments. Filter on the first half of
    // each season — NOT on `t % 2`, because every synthetic timestamp here is
    // even (base = s * 10_000_000, steps of 3h = 10800s) and that predicate
    // silently excludes nothing, making the assert vacuous.
    const filtered = walkForward({
        events,
        seasons,
        type: 'attack',
        enemy: 0,
        fitPredictor: oracle,
        momentFilter: (t, seasonEvents) =>
            t < seasonEvents[Math.floor(seasonEvents.length / 2)].start_time,
        bootstrapSamples: 0,
    });
    assert(filtered.moments < good.moments, 'momentFilter did not exclude anything');

    // Leakage guard: a fitPredictor that peeks at the test season must throw.
    assert.throws(
        () =>
            walkForward({
                events,
                seasons,
                type: 'attack',
                enemy: 0,
                fitPredictor: (trainEvents) => {
                    trainEvents.push({
                        season: 999,
                        type: 'attack',
                        enemy: 0,
                        start_time: 0,
                        end_time: 0,
                    });
                    return () => ({ p25: 1, p50: 1, p75: 1 });
                },
            }),
        /leakage/i,
        'leakage guard did not fire',
    );

    console.log(
        `backtest self-check OK — ${good.moments} moments, skill ratio ${good.skillRatio.toFixed(3)}`,
    );
}
