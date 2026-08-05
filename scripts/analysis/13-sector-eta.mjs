/**
 * 13-sector-eta.mjs — how well does (next sector boundary - points) / rate
 * predict when the frontier crosses into the next of 10 equal sectors?
 *
 * The sector view of the dashboard wants an ETA to the NEXT SECTOR BOUNDARY
 * (points_max / 10 steps), not to campaign completion — a target roughly 1/10
 * the size of the attack-ETA target `10-attack-eta.mjs` measures. There is no
 * real "sector crossing" event in the data; this script manufactures one
 * (`sectorCrossings`) from the same `h1_status` points series and backtests
 * the identical rate-based approach against it, walk-forward, before anything
 * downstream is allowed to rely on the result.
 *
 * This is the spec's "measure first" gate (see
 * docs/superpowers/specs/2026-07-31-view-dependent-eta-design.md): the
 * emitter (script 11, Task 3) refuses to write a `sector` section into
 * `attackModel.mjs` unless recall >= 0.70 and precision >= 0.80 in the
 * when-showing table this script prints. If those numbers don't clear the
 * bar here, the sector-view feature does not proceed.
 *
 * Design choices, deliberately mirrored from `10-attack-eta.mjs`:
 *
 *  - **24-hour rate window, 3-hour step.** Same reasoning as script 10 — most
 *    of the 160-season history only has ~daily status buckets, so this is the
 *    coarsest configuration history can actually validate.
 *  - **No fallback model.** Moments with `rate <= 0` or an already-complete
 *    campaign emit no forecast (`rawSectorEta` returns null) and are excluded
 *    via `momentFilter`.
 *  - **Ratio quantiles learned per remaining-SECTOR-fraction band**, not per
 *    remaining-campaign-fraction band — a sector target is a fundamentally
 *    smaller, more local window than the campaign target script 10 measures,
 *    so its own band edges (`SECTOR_BANDS`) are fit and reported separately.
 *  - **Synthetic events, real harness.** `sectorCrossings` reshapes the
 *    points series into `{start_time, end_time, boundary}` records so the
 *    existing `walkForward` harness (built for real events) can consume them
 *    unchanged — `type: 'crossing'` keeps them namespaced away from real
 *    attack/defend events in the same dataset.
 *
 * **Amendment (2026-07-31, approved):** the first run of this script (all
 * 160+ seasons, ~daily buckets for 156 of them) failed the gate — recall
 * ~80% but precision ~50-55%, and a skill ratio worse than the naive
 * baseline on every faction. Root cause: a sector boundary is 1/10th a
 * campaign, an hours-scale target, and `sectorCrossings` can only stamp a
 * crossing at the next status BUCKET at or past the boundary — on a
 * ~daily-bucket season that bucket can be up to ~24h later than the true
 * crossing, which systematically inflates the "true wait" the model is
 * scored against. Fit and eval are now restricted to HIGH-RESOLUTION
 * seasons only (`deriveHighResSeasons`: median bucket spacing <= 1h) — this
 * matches the live dashboard feed (15-min buckets), so it is the correct
 * evaluation of the configuration that actually ships. The day-of-week pace
 * pattern still folds every prior season (campaign-level pace is measurable
 * at daily resolution; only the sector-crossing target itself needs high
 * resolution). To keep N workable given how few high-res seasons exist, the
 * wait/eta ratio table is POOLED across all three factions into one shared
 * per-band table (crossing dynamics are faction-agnostic); per-faction
 * backtest/eval tables stay separate.
 *
 * Ref #483
 *
 * Run: node --env-file=.env.development scripts/analysis/13-sector-eta.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const RATE_WINDOW_HOURS = 24;
const STEP_HOURS = 3;
const DISPLAY_HOURS = 8; // sector horizon is ~1/10 the campaign's
const MIN_ETA_HOURS = 1 / 12; // 5 minutes
const SECTOR_COUNT = 10;

/** Band edges over the REMAINING FRACTION OF THE SECTOR (not the campaign). */
const SECTOR_BANDS = [0.1, 0.25, 0.5, 0.75, 1.01];

/**
 * Index of the remaining-sector-fraction band containing `frac`.
 *
 * @param {number} frac remaining points to the boundary as a fraction of one sector's size
 * @returns {number} band index into SECTOR_BANDS
 */
function sectorBandOf(frac) {
    for (let i = 0; i < SECTOR_BANDS.length; i++) if (frac < SECTOR_BANDS[i]) return i;
    return SECTOR_BANDS.length - 1;
}

/**
 * Synthetic "crossing events" for one (season, enemy): the first status bucket
 * at or past each boundary k * pointsMax/10, k = 1..10. Shaped like events
 * (start_time/end_time) so walkForward can consume them unchanged.
 *
 * @param {{bucket: number, points: number}[]} series ascending by bucket
 * @param {number} pointsMax
 * @returns {{start_time: number, end_time: number, boundary: number}[]}
 */
function sectorCrossings(series, pointsMax) {
    if (!(pointsMax > 0)) return [];
    const pps = pointsMax / SECTOR_COUNT;
    const out = [];
    let k = 1;
    for (const row of series) {
        while (k <= SECTOR_COUNT && Number(row.points) >= k * pps) {
            out.push({
                start_time: Number(row.bucket),
                end_time: Number(row.bucket),
                boundary: k * pps,
            });
            k++;
        }
    }
    return out;
}

/**
 * Turn a set of observed `wait / eta` ratios into the three multipliers that
 * convert a raw ETA into a p25/p50/p75 forecast.
 *
 * @param {number[]} ratios observed true-wait / raw-eta values
 * @returns {{r25: number, r50: number, r75: number}|null} null when too thin
 */
function ratioQuantiles(ratios) {
    if (ratios.length < 30) return null;
    return {
        r25: quantileOf(ratios, 0.25),
        r50: quantileOf(ratios, 0.5),
        r75: quantileOf(ratios, 0.75),
    };
}

/**
 * Median spacing between consecutive buckets, in hours. Used to classify a
 * season as high-resolution (matching the live dashboard's 15-min feed) vs
 * the ~daily-bucket resolution most of history has — see the header
 * amendment for why the sector-crossing fit/eval needs this distinction.
 *
 * @param {{bucket: number}[]} series ascending by bucket
 * @returns {number|null} null when fewer than 2 buckets exist to space
 */
function medianBucketSpacingHours(series) {
    if (series.length < 2) return null;
    const diffs = [];
    for (let i = 1; i < series.length; i++) {
        diffs.push((Number(series[i].bucket) - Number(series[i - 1].bucket)) / HOUR);
    }
    return quantileOf(diffs, 0.5);
}

/** Seasons at or below this median bucket spacing count as high-resolution. */
const HIGH_RES_MAX_SPACING_HOURS = 1;

// --- self-checks on the pure functions (no DB) ----------------------------
{
    assert.equal(sectorBandOf(0.05), 0);
    // 0.5 sits exactly on the band-2/band-3 edge; with strict `<` (same
    // semantics as script 10's bandOf) it lands in band 3, not band 2 —
    // 0.4 below is the genuine mid-band-2 check.
    assert.equal(sectorBandOf(0.4), 2);
    assert.equal(sectorBandOf(0.5), 3);
    assert.equal(sectorBandOf(1.0), 4);
    // A linear climb crosses each boundary exactly once, in order.
    const series = Array.from({ length: 100 }, (_, i) => ({
        bucket: i * 3600,
        points: i * 100, // reaches 9900 < 10000
    }));
    const c = sectorCrossings(series, 10_000);
    assert.equal(c.length, 9, 'linear climb to 99% crosses 9 boundaries');
    assert.equal(c[0].boundary, 1000);
    for (let i = 1; i < c.length; i++) {
        assert(c[i - 1].start_time < c[i].start_time, 'crossings ascend');
    }
    // A single jump over several boundaries emits one crossing per boundary
    // at the same bucket.
    const jump = [
        { bucket: 0, points: 0 },
        { bucket: 3600, points: 5500 },
    ];
    assert.equal(sectorCrossings(jump, 10_000).length, 5);
    assert.equal(ratioQuantiles([1, 2]), null);

    assert.equal(medianBucketSpacingHours([{ bucket: 0 }]), null);
    // 900s = 15min = 0.25h — the live dashboard's actual bucket spacing.
    assert.equal(
        medianBucketSpacingHours([{ bucket: 0 }, { bucket: 900 }, { bucket: 1800 }]),
        0.25,
    );
    // A daily-bucket season (24h spacing) must NOT qualify as high-res.
    assert(
        medianBucketSpacingHours([{ bucket: 0 }, { bucket: 86400 }]) >
            HIGH_RES_MAX_SPACING_HOURS,
    );
}

// --- data ------------------------------------------------------------------

const ds = await loadDataset();

const FACTIONS = [
    { enemy: 0, name: 'Bugs' },
    { enemy: 1, name: 'Cyborgs' },
    { enemy: 2, name: 'Illuminate' },
];

/**
 * The raw ETA to the NEXT sector boundary in hours, plus how far into that
 * sector's remaining span the moment sits. Every failure path (unknown
 * state, a stalled/retreating front, an already-complete campaign) returns
 * null — no fallback model, same rule as `10-attack-eta.mjs`.
 *
 * Staleness anchoring is the same algebra as script 10: `points` comes from
 * the last bucket at or before `t`, so the raw `remaining / rate` wait is
 * measured from the READING's time, and subtracting the reading's age
 * re-anchors it at `t`.
 *
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @param {Function|null} adjust day-of-week pace adjuster, or null to skip
 * @returns {{etaHours: number, sectorFrac: number}|null}
 */
function rawSectorEta(season, enemy, t, adjust) {
    const pointsMax = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    if (!(pointsMax > 0)) return null;
    const stNow = ds.statusAt(season, enemy, t);
    const stThen = ds.statusAt(season, enemy, t - RATE_WINDOW_HOURS * HOUR);
    if (!stNow || !stThen) return null;

    const now = Number(stNow.points);
    if (now >= pointsMax) return null; // campaign complete
    const pps = pointsMax / SECTOR_COUNT;
    const boundary = (Math.trunc(now / pps) + 1) * pps;
    const remaining = boundary - now;

    const spanHours = (Number(stNow.bucket) - Number(stThen.bucket)) / HOUR;
    if (!(spanHours > 0)) return null;
    const ratePerHour = (now - Number(stThen.points)) / spanHours;
    if (!(ratePerHour > 0)) return null;

    let etaHours = remaining / ratePerHour;
    if (adjust) {
        const horizon = Math.min(Math.max(etaHours, 1), 48);
        const adj = adjust(
            Number(stThen.bucket),
            Number(stNow.bucket),
            t,
            t + horizon * HOUR,
        );
        if (adj > 0) etaHours *= adj;
    }
    etaHours -= (t - Number(stNow.bucket)) / HOUR; // staleness anchor
    if (etaHours < MIN_ETA_HOURS) etaHours = MIN_ETA_HOURS;

    return { etaHours, sectorFrac: remaining / pps };
}

/**
 * Day-of-week pace pattern — verbatim idiom from script 10 (see the rationale
 * there); folds status pace per (season, enemy) normalised to the campaign's
 * own median, walk-forward. Copied from `12-faction-players-eta.mjs`, which
 * copied it from script 10 — same rationale comment, same leakage assert.
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

// --- synthetic crossing events, pooled per enemy ---------------------------

/**
 * @param {number} season
 * @param {number} enemy
 * @returns {number}
 */
function pointsMaxOf(season, enemy) {
    return ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
}

const ALL_SEASONS = [...ds.seasons.keys()];

/**
 * Seasons where every faction with status data this season polls at <=
 * `HIGH_RES_MAX_SPACING_HOURS` median bucket spacing — the resolution the
 * live dashboard feed actually has. Most of history (~daily buckets) does
 * not qualify; see the header amendment for why the sector-crossing fit and
 * eval are restricted to the seasons that do.
 *
 * @returns {number[]} ascending season numbers
 */
function deriveHighResSeasons() {
    const out = [];
    for (const s of ALL_SEASONS) {
        let present = false;
        let allQualify = true;
        for (const enemy of [0, 1, 2]) {
            const series = ds.statusSeries(s, enemy);
            if (series.length === 0) continue; // faction absent this season
            present = true;
            const spacing = medianBucketSpacingHours(series);
            if (spacing === null || !(spacing <= HIGH_RES_MAX_SPACING_HOURS)) {
                allQualify = false;
                break;
            }
        }
        if (present && allQualify) out.push(s);
    }
    return out;
}

const HIGH_RES_SEASONS = deriveHighResSeasons();
const HIGH_RES_SET = new Set(HIGH_RES_SEASONS);

/** @type {Record<number, object[]>} enemy -> crossings across every season */
const crossingsByEnemy = {};
/** @type {Record<number, Map<number, object[]>>} enemy -> season -> crossings */
const crossingsBySeasonByEnemy = {};
/** @type {Record<number, object[]>} enemy -> crossings, HIGH-RES seasons only (walkForward events) */
const highResCrossingsByEnemy = {};
for (const f of FACTIONS) {
    const list = ALL_SEASONS.flatMap((s) =>
        sectorCrossings(ds.statusSeries(s, f.enemy), pointsMaxOf(s, f.enemy)).map(
            (c) => ({ ...c, season: s, type: 'crossing', enemy: f.enemy }),
        ),
    );
    crossingsByEnemy[f.enemy] = list;
    highResCrossingsByEnemy[f.enemy] = list.filter((c) => HIGH_RES_SET.has(c.season));

    const bySeason = new Map();
    for (const c of list) {
        if (!bySeason.has(c.season)) bySeason.set(c.season, []);
        bySeason.get(c.season).push(c);
    }
    crossingsBySeasonByEnemy[f.enemy] = bySeason;
}

/**
 * Season span map for the sector-crossing harness. NOT `ds.seasons` — real
 * event spans (`firstStart`/`lastEnd` derived from h1_event) start late in
 * some seasons and would silently truncate the walk-forward clock before the
 * status series (and its crossings) even begin. Built once from h1_status
 * coverage across all three factions and reused for every enemy's walkForward
 * call, so all three see the identical clock.
 *
 * @type {Map<number, {season: number, firstStart: number, lastEnd: number, spanSeconds: number}>}
 */
const crossingSeasons = new Map();
for (const s of ALL_SEASONS) {
    let firstStart = Infinity;
    let lastEnd = -Infinity;
    for (const enemy of [0, 1, 2]) {
        const series = ds.statusSeries(s, enemy);
        if (series.length === 0) continue;
        firstStart = Math.min(firstStart, Number(series[0].bucket));
        lastEnd = Math.max(lastEnd, Number(series.at(-1).bucket));
    }
    if (firstStart === Infinity) continue; // no status data at all this season
    crossingSeasons.set(s, {
        season: s,
        firstStart,
        lastEnd,
        spanSeconds: Math.max(0, lastEnd - firstStart),
    });
}

/**
 * Accumulate `wait / eta.etaHours` ratios, keyed by sector band, for every
 * step-clock moment in one (season, enemy) that has both a forecast and a
 * subsequent crossing. Shared by the walk-forward fit and the full-history
 * report below so the two never drift apart.
 *
 * Restricted to HIGH-RES seasons (no-op on any other season) — see the
 * header amendment: a daily-bucket season's synthetic crossing timestamp can
 * lag the true crossing by up to ~24h, which is not a valid training/eval
 * sample for an hours-scale sector target.
 *
 * @param {Map<number, number[]>} ratiosByBand mutated in place
 * @param {number} enemy
 * @param {number} season
 * @param {Function|null} adjust day-of-week pace adjuster
 */
function foldSectorRatios(ratiosByBand, enemy, season, adjust) {
    if (!HIGH_RES_SET.has(season)) return;
    const list = crossingsBySeasonByEnemy[enemy].get(season);
    const span = crossingSeasons.get(season);
    if (!list || !span) return;
    for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
        const eta = rawSectorEta(season, enemy, t, adjust);
        if (!eta) continue;
        const next = list.find((e) => e.start_time > t);
        if (!next) continue; // right-censored — no observed ratio
        const wait = (next.start_time - t) / HOUR;
        const band = sectorBandOf(eta.sectorFrac);
        if (!ratiosByBand.has(band)) ratiosByBand.set(band, []);
        ratiosByBand.get(band).push(wait / eta.etaHours);
    }
}

// --- fit ---------------------------------------------------------------

/**
 * Build a predictor factory whose per-band ratio table accumulates ACROSS
 * eval seasons instead of being rebuilt from scratch each time (same
 * O(seasons) idiom as `10-attack-eta.mjs`'s `makeFitPredictor`).
 *
 * The ratio table is POOLED across all three factions (`foldSectorRatios` is
 * called for enemy 0, 1, AND 2 every fold, regardless of `evalEnemy`) — see
 * the header amendment: high-res history is thin enough that a per-faction
 * table would starve every band. Only `predict`'s raw ETA is faction-specific
 * (`evalEnemy`'s own rate); the ratio table it's multiplied by is shared.
 *
 * @param {number} evalEnemy the faction this predictor's `predict` answers for
 * @returns {Function} a fitPredictor for walkForward
 */
function makeFitPredictor(evalEnemy) {
    const dowPattern = makeDowPattern();
    /** @type {Map<number, number[]>} band index -> observed wait/eta ratios, pooled across factions */
    const ratiosByBand = new Map();
    let accumulatedThrough = 0; // highest season folded into the table

    return function fitPredictor(trainEvents, ctx) {
        dowPattern.foldThrough(ctx.testSeason); // unrestricted — pace is measurable at daily resolution
        const adjust = dowPattern.adjuster();
        for (let s = accumulatedThrough + 1; s < ctx.testSeason; s++) {
            for (const poolEnemy of [0, 1, 2]) {
                foldSectorRatios(ratiosByBand, poolEnemy, s, adjust); // no-op on non-high-res seasons
            }
        }
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
            const eta = rawSectorEta(moment.season, evalEnemy, moment.t, adjust);
            // momentFilter guarantees this is non-null; the guard is for the
            // warm-up moments the harness evaluates before the filter applies.
            if (!eta) return { p25: 0, p50: 0, p75: 0 };
            const q = perBand.get(sectorBandOf(eta.sectorFrac)) ?? pooled;
            if (!q) return { p25: eta.etaHours, p50: eta.etaHours, p75: eta.etaHours };
            return {
                p25: eta.etaHours * q.r25,
                p50: eta.etaHours * q.r50,
                p75: eta.etaHours * q.r75,
            };
        };
    };
}

/**
 * Fold every HIGH-RES season's ratios, POOLED across all three factions
 * (same rationale as `makeFitPredictor`), with a fully-folded (no
 * walk-forward holdout) day-of-week pattern — the single shared table
 * `11-emit-attack-model.mjs` will actually fit, since the emitter trains on
 * the entire history rather than replaying a season-by-season backtest.
 *
 * @returns {Map<number, number[]>} band index -> observed wait/eta ratios (pooled)
 */
function fitFullHistoryPooled() {
    const dowPattern = makeDowPattern();
    const maxSeason = Math.max(...ALL_SEASONS);
    dowPattern.foldThrough(maxSeason + 1);
    const adjust = dowPattern.adjuster();

    const ratiosByBand = new Map();
    for (const season of HIGH_RES_SEASONS) {
        for (const enemy of [0, 1, 2])
            foldSectorRatios(ratiosByBand, enemy, season, adjust);
    }
    return ratiosByBand;
}

// --- run -------------------------------------------------------------------

console.log('\n=== Script 13: sector-crossing ETA backtest ===\n');
console.log(
    `  eta = (next boundary - points) / rate,  rate over ${RATE_WINDOW_HOURS}h, boundary = next of ${SECTOR_COUNT} equal sector steps`,
);
console.log(
    '  Synthetic "crossing" events (no real event backs a sector boundary) — see header for the rationale.',
);
console.log(
    '  Amendment: fit + eval restricted to high-resolution seasons only (see header).\n',
);

/**
 * True when at least one of `enemy`'s high-res eval seasons has >= 30 prior
 * (same-enemy) high-res crossings to train on — the same threshold
 * `walkForward` enforces internally (`trainEvents.length < 30` skip). Only 4
 * high-res seasons exist (S157-160), so a faction whose early seasons ran
 * short on crossings can end up with EVERY eval season skipped — and
 * `walkForward` hard-asserts on zero evaluable moments rather than returning
 * an empty summary. Checking this first lets the run report that faction as
 * "insufficient training data" instead of crashing the whole script.
 *
 * @param {number} enemy
 * @returns {boolean}
 */
function hasQualifyingEvalSeason(enemy) {
    const evts = highResCrossingsByEnemy[enemy];
    const evalSeasonsSorted = [...new Set(evts.map((c) => c.season))].sort(
        (a, b) => a - b,
    );
    return evalSeasonsSorted.some(
        (testSeason) => evts.filter((c) => c.season < testSeason).length >= 30,
    );
}

const results = [];
for (const f of FACTIONS) {
    if (!hasQualifyingEvalSeason(f.enemy)) {
        results.push({ label: f.name, f, summary: null });
        continue;
    }

    const momentFilter = (t, seasonEvents) =>
        seasonEvents.length > 0 &&
        rawSectorEta(seasonEvents[0].season, f.enemy, t, null) !== null;

    const summary = walkForward({
        events: highResCrossingsByEnemy[f.enemy],
        seasons: crossingSeasons,
        type: 'crossing',
        enemy: f.enemy,
        stepHours: STEP_HOURS,
        fitPredictor: makeFitPredictor(f.enemy),
        momentFilter,
        allowNoPriorEvent: true,
    });
    results.push({ label: f.name, f, summary });
}

// --- coverage ----------------------------------------------------------

console.log('--- Coverage (full history, all seasons — context only) ---\n');
console.log('  faction        crossings   seasons   no-forecast %');
for (const f of FACTIONS) {
    const crossings = crossingsByEnemy[f.enemy].length;
    const seasonsWithCrossings = crossingsBySeasonByEnemy[f.enemy].size;
    let total = 0;
    let none = 0;
    for (const [season, span] of crossingSeasons) {
        for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
            total++;
            if (!rawSectorEta(season, f.enemy, t, null)) none++;
        }
    }
    console.log(
        `  ${f.name.padEnd(13)}  ${String(crossings).padStart(9)}   ${String(seasonsWithCrossings).padStart(7)}   ${((none / total) * 100).toFixed(1)}% of ${total}`,
    );
}

console.log(
    `\n--- High-resolution seasons (median bucket spacing <= ${HIGH_RES_MAX_SPACING_HOURS}h — the amendment) ---\n`,
);
console.log(
    `  Derived seasons (${HIGH_RES_SEASONS.length}): ${HIGH_RES_SEASONS.join(', ') || '(none)'}\n`,
);
console.log(
    '  faction        crossings   no-forecast %   (within high-res seasons only)',
);
for (const f of FACTIONS) {
    const crossings = highResCrossingsByEnemy[f.enemy].length;
    let total = 0;
    let none = 0;
    for (const season of HIGH_RES_SEASONS) {
        const span = crossingSeasons.get(season);
        if (!span) continue;
        for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
            total++;
            if (!rawSectorEta(season, f.enemy, t, null)) none++;
        }
    }
    console.log(
        `  ${f.name.padEnd(13)}  ${String(crossings).padStart(9)}   ${total > 0 ? ((none / total) * 100).toFixed(1) : '0.0'}% of ${total}`,
    );
}

// --- evaluated seasons + effN (walkForward's trainEvents>=30 guard skips
// early high-res seasons — reported honestly, not smoothed over) -----------

console.log('\n--- Seasons actually evaluated (after the trainEvents >= 30 guard) ---\n');
let totalEffN = 0;
for (const r of results) {
    if (!r.summary) {
        console.log(
            `  ${r.label.padEnd(13)} effN=0   NO eval season had >= 30 pooled high-res crossings to train on`,
        );
        continue;
    }
    const evaluatedSeasons = [...new Set(r.summary.records.map((x) => x.season))].sort(
        (a, b) => a - b,
    );
    totalEffN += r.summary.effectiveN;
    console.log(
        `  ${r.label.padEnd(13)} effN=${r.summary.effectiveN}   evaluated seasons: ${evaluatedSeasons.join(', ') || '(none)'}`,
    );
}
console.log(
    `\n  Total effN across factions: ${totalEffN}` +
        (totalEffN < 30 ?
            '  — UNDER 30: report DONE_WITH_CONCERNS, do not self-declare pass/fail.'
        :   ''),
);

// --- main table ----------------------------------------------------------

console.log('\n--- Backtest (walk-forward by season, sector crossings) ---\n');
console.log('faction        effN     cal 25/50/75      MAE/base    skill [95% CI]');
for (const r of results) {
    const s = r.summary;
    if (!s) {
        console.log(
            `${r.label.padEnd(14)}      0   (no eval season — insufficient training data)`,
        );
        continue;
    }
    console.log(
        `${r.label.padEnd(14)} ${String(s.effectiveN).padStart(6)}   ` +
            `${s.calibration.q25.toFixed(3)}/${s.calibration.q50.toFixed(3)}/${s.calibration.q75.toFixed(3)}   ` +
            `${s.medianAbsErrorHours.toFixed(2)}/${s.baselineMedianAbsErrorHours.toFixed(2)}h   ` +
            `${s.skillRatio.toFixed(3)} [${s.skillRatioCI[0].toFixed(3)}, ${s.skillRatioCI[1].toFixed(3)}]`,
    );
}

// --- when-showing table (governs the emitter's refuse-to-emit guard) -------

console.log(`\n--- When showing (p50 < ${DISPLAY_HOURS}h) ---\n`);
console.log(
    '    recall = crossings preceded by a showing forecast; precision = showing moments followed',
);
console.log(
    '    by a crossing within 2x p75. Gate: recall >= 0.70 AND precision >= 0.80.\n',
);

let anyBlocked = false;
for (const r of results) {
    if (!r.summary) {
        console.log(
            `  ${r.label.padEnd(14)} no eval season — insufficient training data, cannot compute recall/precision`,
        );
        continue;
    }
    const recs = r.summary.records.filter((x) => x.wait !== null);
    const targets = new Set(recs.map((x) => x.target));
    const fired = new Set(recs.filter((x) => x.q50 < DISPLAY_HOURS).map((x) => x.target));
    const showing = recs.filter((x) => x.q50 < DISPLAY_HOURS);
    const honoured = showing.filter((x) => x.wait < 2 * x.q75);

    const recall = targets.size > 0 ? fired.size / targets.size : 0;
    const precision = showing.length > 0 ? honoured.length / showing.length : 0;
    const pass = recall >= 0.7 && precision >= 0.8;
    if (!pass) anyBlocked = true;

    const hit = (q) =>
        showing.length > 0 ?
            showing.filter((x) => x.wait < x[q]).length / showing.length
        :   0;

    console.log(
        `  ${r.label.padEnd(14)} recall ${(recall * 100).toFixed(1)}% of ${targets.size} crossings` +
            ` | precision ${(precision * 100).toFixed(1)}% of ${showing.length} showing` +
            ` => ${pass ? 'PASS' : 'FAIL'}`,
    );
    console.log(
        `    ${''.padEnd(12)} showing hit rates p25/p50/p75 ${hit('q25').toFixed(3)}/0.250  ` +
            `${hit('q50').toFixed(3)}/0.500  ${hit('q75').toFixed(3)}/0.750`,
    );
}

if (anyBlocked && totalEffN >= 30) {
    console.log(
        '\n  *** STOP: at least one faction failed the recall/precision gate above. ***',
    );
    console.log(
        '  The Task 3 emitter would refuse to emit; the sector UI must not proceed until resolved.',
    );
} else if (anyBlocked) {
    console.log(
        '\n  (A gate FAIL is printed above, but total effN is under 30 — see the Verdict',
    );
    console.log(
        '  section below; this is not a meaningful pass/fail at this N, not a STOP.)',
    );
}

// --- full-history fitted per-band ratio table (what the emitter will fit) --

console.log(
    '\n--- Full-history fitted per-band ratio table (pooled across factions, high-res seasons only) ---\n',
);
console.log('  band   frac<     n       r25      r50      r75');
{
    const ratiosByBand = fitFullHistoryPooled();
    for (let b = 0; b < SECTOR_BANDS.length; b++) {
        const ratios = ratiosByBand.get(b) ?? [];
        const q = ratioQuantiles(ratios);
        const fitted =
            q ?
                `${q.r25.toFixed(3)}    ${q.r50.toFixed(3)}    ${q.r75.toFixed(3)}`
            :   '(pooled fallback — n<30)';
        console.log(
            `  ${String(b).padStart(4)}   ${SECTOR_BANDS[b].toFixed(2)}   ${String(ratios.length).padStart(5)}   ${fitted}`,
        );
    }
}

// --- verdict -----------------------------------------------------------

console.log('\n--- Verdict ---\n');
if (totalEffN < 30) {
    console.log(
        `  DONE_WITH_CONCERNS: total effN across factions is ${totalEffN} (< 30). The gate`,
    );
    console.log(
        '  numbers above are printed but should not be treated as a self-declared PASS or FAIL',
    );
    console.log('  at this N — see the per-faction evaluated-seasons list above.');
} else if (anyBlocked) {
    console.log(
        '  BLOCKED: at least one faction failed the recall/precision gate above.',
    );
} else {
    console.log('  PASS: every faction cleared recall >= 0.70 and precision >= 0.80.');
}

console.log('');
