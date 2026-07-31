/**
 * 12-faction-players-eta.mjs — can per-faction player telemetry beat the dow table?
 *
 * The shipped attack forecast (10/11-*) corrects its 24h points-rate with a
 * GLOBAL day-of-week pace table. The faction-pure alternative is to use the
 * faction's own player counts (h1_statistic.players, S157+ only). One player
 * correction has already been tried and documented as harmful — multiplying the
 * rate by `current players / 24h-avg players` worsened pace error 23.5% → 28.1%
 * (docs/predict § "What did not help") — because the 24h points-rate already
 * embodies the players who produced it, so a naive multiplier double-counts.
 *
 * This script asks whether any SMARTER player variant wins, walk-forward, on
 * the only slice where high-res telemetry exists:
 *
 *   V0  baseline — 24h rate + dow + band ratios (script 10's corrected+dow)
 *   V1  control  — the crude documented-harmful multiplier; must reproduce as
 *                  worse, or the negative result does not transfer to this slice
 *   V2  pph(α)   — points per player^α-hour, ETA by integrating a predicted
 *                  player curve until it crosses `remaining`
 *   V3  how(α)   — plain 24h rate, dow factor replaced by the faction's own
 *                  hour-of-week player-pattern factor, dampened by α
 *
 * α < 1 is the answer to the double-counting insight: pace ∝ players^α, not
 * players^1. The grid is FIXED (1.0 / 0.7 / 0.5) — four seasons cannot support
 * nested walk-forward fitting, so the best-α row is exploratory by construction.
 *
 * Leakage strategy for the player pattern: within-season expanding window
 * (only same-season buckets strictly before the queried moment), with fully
 * elapsed prior stat seasons pooled as a prior for hours not yet seen this
 * season. Causal by construction; asserted, not assumed.
 *
 * All variants are scored on the SAME moments (one shared momentFilter, key-set
 * asserted identical), so differences are paired, not compositional.
 *
 * Run: node --env-file=.env.development scripts/analysis/12-faction-players-eta.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const RATE_WINDOW_HOURS = 24;
const DISPLAY_HOURS = 48;
const STEP_HOURS = 3; // must match script 10 for comparability
const MIN_ETA_HOURS = 0.25;
const MAX_PLAYER_STALENESS_HOURS = 2; // 15-min buckets; older means a telemetry gap
const MIN_PATTERN_BUCKETS = 288; // 72h of 15-min buckets before the pattern is trusted
const MIN_SLOT_BUCKETS = 3; // per hour-of-week slot before its own median is used
const ALPHAS = [1.0, 0.7, 0.5];

/**
 * Remaining-fraction band edges — duplicated from 10/11 rather than imported:
 * importing script 10 would execute its full backtest at module load, and the
 * edges must stay pinned to what the shipped model was fitted with anyway.
 */
const BANDS = [0.02, 0.05, 0.1, 0.2, 0.4, 1.01];

/**
 * Index of the remaining-fraction band containing `frac`.
 *
 * @param {number} frac remaining points as a fraction of points_max
 * @returns {number} band index into BANDS
 */
function bandOf(frac) {
    for (let i = 0; i < BANDS.length; i++) if (frac < BANDS[i]) return i;
    return BANDS.length - 1;
}

/**
 * Observed `wait / eta` ratios → the three multipliers of a p25/p50/p75
 * forecast. Duplicated from script 10 for the same import reason as BANDS.
 *
 * @param {number[]} ratios
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
 * Hour-of-week slot (0..167) of a unix-seconds timestamp, UTC.
 *
 * @param {number} t unix seconds
 * @returns {number}
 */
function hourOfWeekOf(t) {
    const d = new Date(t * 1000);
    return d.getUTCDay() * 24 + d.getUTCHours();
}

/**
 * Step-integral of `players^alpha` over `[t0, t1]` in player^α-hours, holding
 * each reading constant until the next bucket. Null when any stretch of the
 * interval relies on a reading older than MAX_PLAYER_STALENESS_HOURS — that is
 * a telemetry gap, and integrating across it would silently invent players.
 *
 * @param {{bucket: number, players: number}[]} series ascending by bucket
 * @param {number} t0 unix seconds
 * @param {number} t1 unix seconds
 * @param {number} alpha dampening exponent
 * @returns {number|null}
 */
function playerHoursBetween(series, t0, t1, alpha) {
    if (!(t1 > t0)) return null;
    let lo = 0;
    let hi = series.length - 1;
    let i = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (series[mid].bucket <= t0) {
            i = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    if (i < 0) return null; // no reading covers the start of the interval

    let cursor = t0;
    let sum = 0;
    for (let j = i; j < series.length && cursor < t1; j++) {
        const segEnd =
            j + 1 < series.length ? Math.min(Number(series[j + 1].bucket), t1) : t1;
        if (segEnd <= cursor) continue;
        if ((segEnd - Number(series[j].bucket)) / HOUR > MAX_PLAYER_STALENESS_HOURS) {
            return null;
        }
        sum += Math.pow(Number(series[j].players), alpha) * (segEnd - cursor);
        cursor = segEnd;
    }
    if (cursor < t1) return null;
    return sum / HOUR;
}

/**
 * Hours until cumulative predicted pace crosses `remaining`, integrating
 * hour-by-hour from `startT`: each hour contributes `ratePph × E[players^α]`
 * evaluated at the hour's midpoint. Linear interpolation inside the crossing
 * hour; capped at `maxHours` (the harness clamps at its horizon anyway).
 *
 * @param {number} remaining points still needed
 * @param {number} ratePph points per player^α-hour
 * @param {(u: number) => number} expectedPowAlphaAt E[players^α] at instant u
 * @param {number} startT unix seconds the integration starts from
 * @param {number} [maxHours]
 * @returns {number} hours from startT
 */
function etaFromPphCrossing(
    remaining,
    ratePph,
    expectedPowAlphaAt,
    startT,
    maxHours = 1500,
) {
    let acc = 0;
    for (let h = 0; h < maxHours; h++) {
        const gain = ratePph * expectedPowAlphaAt(startT + (h + 0.5) * HOUR);
        if (gain > 0 && acc + gain >= remaining) return h + (remaining - acc) / gain;
        acc += gain;
    }
    return maxHours;
}

/**
 * Mean pattern factor over `[from, to)`, sampled hourly. The hourly step (vs
 * the dow adjuster's 6h) matches the pattern's own hour-of-week resolution.
 *
 * @param {(h: number) => number} factor
 * @param {number} from unix seconds
 * @param {number} to unix seconds
 * @returns {number}
 */
function meanFactorOver(factor, from, to) {
    let sum = 0;
    let n = 0;
    for (let u = from; u < to; u += HOUR) {
        sum += factor(hourOfWeekOf(u));
        n++;
    }
    return n > 0 ? sum / n : 1;
}

/**
 * Walk-forward hour-of-week player-pattern learner for ONE faction.
 *
 * Within-season expanding window: a query at `(season, t)` sees only that
 * season's buckets strictly before `t`. Fully elapsed prior stat seasons are
 * folded (via `foldThrough`, same idiom and leakage assert as the dow pattern)
 * into a pooled per-slot prior that answers for hours the current season has
 * not exhibited yet; before MIN_PATTERN_BUCKETS of local data with no prior the
 * factor is 1, so a variant degrades to its no-pattern form rather than
 * changing availability.
 *
 * Slot factors are `median(slot players) / median(all players)`, both over the
 * strictly-earlier data — normalising per sample against a running median would
 * make each sample's meaning depend on when it was folded.
 *
 * @param {(season: number) => {bucket: number, players: number}[]} seriesForSeason
 * @returns {{foldThrough: (s: number) => void,
 *   at: (season: number, t: number) => {factor: (h: number) => number, base: number|null}}}
 */
function makeHowPattern(seriesForSeason) {
    const priorBySlot = Array.from({ length: 168 }, () => []);
    let foldedThrough = 0;

    let curSeason = null;
    let cursor = 0;
    let lastT = -Infinity;
    let bySlot = [];
    let all = [];

    function foldPrior(season) {
        const series = seriesForSeason(season);
        if (series.length < MIN_PATTERN_BUCKETS) return;
        const seasonMedian = quantileOf(
            series.map((r) => Number(r.players)),
            0.5,
        );
        if (!(seasonMedian > 0)) return;
        const slots = Array.from({ length: 168 }, () => []);
        for (const row of series) {
            slots[hourOfWeekOf(Number(row.bucket))].push(Number(row.players));
        }
        for (let h = 0; h < 168; h++) {
            if (slots[h].length >= MIN_SLOT_BUCKETS) {
                priorBySlot[h].push(quantileOf(slots[h], 0.5) / seasonMedian);
            }
        }
    }

    return {
        foldThrough(testSeason) {
            for (let s = foldedThrough + 1; s < testSeason; s++) foldPrior(s);
            foldedThrough = Math.max(foldedThrough, testSeason - 1);
            assert(
                foldedThrough < testSeason,
                `leakage: player pattern folded season ${foldedThrough} while testing ${testSeason}`,
            );
        },
        at(season, t) {
            if (season !== curSeason) {
                curSeason = season;
                cursor = 0;
                lastT = -Infinity;
                bySlot = Array.from({ length: 168 }, () => []);
                all = [];
            }
            assert(t >= lastT, 'player pattern queried non-monotonically');
            lastT = t;

            const series = seriesForSeason(season);
            while (cursor < series.length && Number(series[cursor].bucket) < t) {
                const row = series[cursor];
                bySlot[hourOfWeekOf(Number(row.bucket))].push(Number(row.players));
                all.push(Number(row.players));
                cursor++;
            }

            const base = all.length >= MIN_PATTERN_BUCKETS ? quantileOf(all, 0.5) : null;
            const factor = (h) => {
                if (base > 0 && bySlot[h].length >= MIN_SLOT_BUCKETS) {
                    return quantileOf(bySlot[h], 0.5) / base;
                }
                if (priorBySlot[h].length > 0) return quantileOf(priorBySlot[h], 0.5);
                return 1;
            };
            return { factor, base };
        },
    };
}

// --- self-checks on the pure functions (no DB) ----------------------------
{
    assert.equal(bandOf(0.0), 0);
    assert.equal(bandOf(0.019), 0);
    assert.equal(bandOf(0.5), 5);
    assert.equal(ratioQuantiles([1, 2, 3]), null, 'thin samples must not fit');
    const q = ratioQuantiles(Array.from({ length: 100 }, () => 1));
    assert.equal(q.r50, 1);

    // 1970-01-01 00:00 UTC was a Thursday — slot 4*24; 1970-01-04 a Sunday — slot 0.
    assert.equal(hourOfWeekOf(0), 96);
    assert.equal(hourOfWeekOf(3 * 24 * HOUR), 0);
    assert.equal(hourOfWeekOf(3 * 24 * HOUR + 90 * 60), 1);

    // playerHoursBetween: constant series integrates exactly; alpha=0 gives the
    // wall-clock span; a telemetry gap returns null.
    const flat = Array.from({ length: 12 }, (_, i) => ({
        bucket: i * 900,
        players: 100,
    }));
    assert.equal(playerHoursBetween(flat, 0, 2 * HOUR, 1), 200);
    assert.equal(playerHoursBetween(flat, 0, 2 * HOUR, 0), 2);
    assert.equal(playerHoursBetween(flat, -900, HOUR, 1), null, 'start uncovered');
    const gappy = [
        { bucket: 0, players: 100 },
        { bucket: 5 * HOUR, players: 100 },
    ];
    assert.equal(playerHoursBetween(gappy, 0, 6 * HOUR, 1), null, 'gap must null');

    // etaFromPphCrossing reduces to remaining/(rate*players^α) when expected
    // players are constant.
    assert.equal(
        etaFromPphCrossing(600, 2, () => 100, 0),
        3,
    );

    // Pattern causality: a query at t must be computable from strictly-earlier
    // buckets only, and a flat series yields factor 1 after burn-in.
    {
        const flatSeries = Array.from({ length: 400 }, (_, i) => ({
            bucket: i * 900,
            players: 50,
        }));
        const pat = makeHowPattern(() => flatSeries);
        const { factor, base } = pat.at(1, 400 * 900);
        assert.equal(base, 50);
        for (let h = 0; h < 168; h++) assert.equal(factor(h), 1);

        // Only buckets strictly before t are visible: at t = bucket 10 the
        // base is null (burn-in) and every slot falls back to 1.
        const early = makeHowPattern(() => flatSeries).at(1, 10 * 900);
        assert.equal(early.base, null);
        assert.equal(early.factor(0), 1);

        // Non-monotone queries within a season must throw.
        const mono = makeHowPattern(() => flatSeries);
        mono.at(1, 1000);
        assert.throws(() => mono.at(1, 500), /non-monotonically/);

        // Folding past the test season must throw.
        const fold = makeHowPattern(() => flatSeries);
        fold.foldThrough(3);
        assert.throws(() => fold.foldThrough(2), /leakage/);
    }
}

// --- data ------------------------------------------------------------------

const ds = await loadDataset({ statistics: true });
const STAT_SEASONS = ds.statSeasons();
assert(STAT_SEASONS.length >= 2, 'need at least two telemetry seasons');
const STAT_SEASON_SET = new Set(STAT_SEASONS);
const FIRST_EVAL_SEASON = STAT_SEASONS[0];

const FACTIONS = [
    { enemy: 0, name: 'Bugs' },
    { enemy: 1, name: 'Cyborgs' },
    { enemy: 2, name: 'Illuminate' },
];

/** Is an attack against this faction already running at `t`? */
function attackActive(t, seasonEvents) {
    return seasonEvents.some((e) => e.start_time <= t && e.end_time > t);
}

/**
 * Day-of-week pace pattern — verbatim idiom from script 10 (see the rationale
 * there); folds status pace per (season, enemy) normalised to the campaign's
 * own median, walk-forward.
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

/**
 * The raw ETA under one variant. Staleness anchoring is always on (see script
 * 10 for the algebra); every failure path returns null, and the stalled rule
 * (`rate <= 0` → null) is shared so availability is identical across variants.
 *
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @param {{kind: 'v0'|'v1'|'v2'|'v3', alpha?: number, pat?: object, adjust?: Function|null}} mode
 * @returns {{etaHours: number, remainingFrac: number}|null}
 */
function rawEtaVariant(season, enemy, t, mode) {
    const pointsMax = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    if (!(pointsMax > 0)) return null;

    const stNow = ds.statusAt(season, enemy, t);
    const stThen = ds.statusAt(season, enemy, t - RATE_WINDOW_HOURS * HOUR);
    if (!stNow || !stThen) return null;

    const now = Number(stNow.points);
    const remaining = pointsMax - now;
    if (remaining <= 0) return null;

    const spanHours = (Number(stNow.bucket) - Number(stThen.bucket)) / HOUR;
    if (!(spanHours > 0)) return null;
    const ratePerHour = (now - Number(stThen.points)) / spanHours;
    if (!(ratePerHour > 0)) return null;

    let etaHours;
    if (mode.kind === 'v2') {
        const series = ds.statisticSeries(season, enemy);
        const dPoints = now - Number(stThen.points);
        const ph = playerHoursBetween(
            series,
            Number(stThen.bucket),
            Number(stNow.bucket),
            mode.alpha,
        );
        if (ph === null || !(ph > 0)) return null;
        const ratePph = dPoints / ph;

        // Predicted player curve: the recent 24h mean sets the LEVEL, the
        // hour-of-week pattern sets only the SHAPE (normalised so a flat
        // pattern reproduces the constant-level ETA exactly).
        const meanHours = playerHoursBetween(series, t - RATE_WINDOW_HOURS * HOUR, t, 1);
        if (meanHours === null) return null;
        const meanPlayers = meanHours / RATE_WINDOW_HOURS;
        if (!(meanPlayers > 0)) return null;

        const { factor, base } = mode.pat.at(season, t);
        let expectedAt;
        if (base !== null) {
            const past = meanFactorOver(factor, t - RATE_WINDOW_HOURS * HOUR, t);
            expectedAt = (u) =>
                Math.pow((meanPlayers * factor(hourOfWeekOf(u))) / past, mode.alpha);
        } else {
            expectedAt = () => Math.pow(meanPlayers, mode.alpha);
        }
        etaHours = etaFromPphCrossing(
            remaining,
            ratePph,
            expectedAt,
            Number(stNow.bucket),
        );
    } else {
        etaHours = remaining / ratePerHour;

        if (mode.kind === 'v0' && mode.adjust) {
            const horizon = Math.min(Math.max(etaHours, 1), 48);
            const adj = mode.adjust(
                Number(stThen.bucket),
                Number(stNow.bucket),
                t,
                t + horizon * HOUR,
            );
            if (adj > 0) etaHours *= adj;
        }

        if (mode.kind === 'v1') {
            // The documented-harmful control: rate × current/24h-avg players,
            // i.e. eta × avg/current.
            const p = ds.playersAt(season, enemy, t);
            const series = ds.statisticSeries(season, enemy);
            const ph = playerHoursBetween(series, t - RATE_WINDOW_HOURS * HOUR, t, 1);
            if (!p || ph === null || !(Number(p.players) > 0)) return null;
            const avg = ph / RATE_WINDOW_HOURS;
            if (avg > 0) etaHours *= avg / Number(p.players);
        }

        if (mode.kind === 'v3') {
            const { factor } = mode.pat.at(season, t);
            const horizon = Math.min(Math.max(etaHours, 1), 48);
            const past = meanFactorOver(
                factor,
                Number(stThen.bucket),
                Number(stNow.bucket),
            );
            const ahead = meanFactorOver(factor, t, t + horizon * HOUR);
            const adj = ahead > 0 ? Math.pow(past / ahead, mode.alpha) : 1;
            if (adj > 0) etaHours *= adj;
        }
    }

    etaHours -= (t - Number(stNow.bucket)) / HOUR;
    if (etaHours < MIN_ETA_HOURS) etaHours = MIN_ETA_HOURS;

    return { etaHours, remainingFrac: remaining / pointsMax };
}

/**
 * Predictor factory: accumulating per-band ratio table + variant ETA at
 * predict time. The table folds EVERY training season with the dow-adjusted
 * ETA — including the handful of stat seasons.
 *
 * ponytail: 0% of table samples carry a player adjustment. Folding the 3-4
 * stat training seasons with each variant's own ETA would player-adjust well
 * under 1% of a table dominated by 150+ pre-telemetry seasons, at the cost of
 * a second walk-forward pattern instance per fold; the transfer assumption is
 * disclosed in the output and tested by the when-showing calibration column.
 *
 * @param {number} enemy
 * @param {{kind: string, alpha?: number}} variantDef
 * @param {object|null} pat player pattern instance for v2/v3
 * @returns {Function} a fitPredictor for walkForward
 */
function makeFitPredictor(enemy, variantDef, pat) {
    const ratiosByBand = new Map();
    let accumulatedThrough = 0;
    const dowPattern = makeDowPattern();

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
        for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
            const eta = rawEtaVariant(season, enemy, t, { kind: 'v0', adjust });
            if (!eta) continue;
            const next = list.find((e) => e.start_time > t);
            if (!next) continue;
            const wait = (next.start_time - t) / HOUR;
            const band = bandOf(eta.remainingFrac);
            if (!ratiosByBand.has(band)) ratiosByBand.set(band, []);
            ratiosByBand.get(band).push(wait / eta.etaHours);
        }
    }

    return function fitPredictor(trainEvents, ctx) {
        dowPattern.foldThrough(ctx.testSeason);
        if (pat) pat.foldThrough(ctx.testSeason);
        const adjust = dowPattern.adjuster();
        for (let s = accumulatedThrough + 1; s < ctx.testSeason; s++)
            foldSeason(s, adjust);
        accumulatedThrough = Math.max(accumulatedThrough, ctx.testSeason - 1);
        assert(
            accumulatedThrough < ctx.testSeason,
            `leakage: ratio table folded season ${accumulatedThrough} while testing ${ctx.testSeason}`,
        );

        const perBand = new Map();
        for (const [band, ratios] of ratiosByBand) {
            const q = ratioQuantiles(ratios);
            if (q) perBand.set(band, q);
        }
        const pooled = ratioQuantiles([...ratiosByBand.values()].flat());

        return function predict(moment) {
            const eta = rawEtaVariant(moment.season, enemy, moment.t, {
                kind: variantDef.kind,
                alpha: variantDef.alpha,
                pat,
                adjust,
            });
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

// --- coverage --------------------------------------------------------------

console.log('\n=== Faction-players attack ETA — experiment (attempt 4) ===\n');
console.log(`  Telemetry seasons: ${STAT_SEASONS.join(', ')}\n`);
console.log('--- Coverage ---\n');
console.log('  season   faction      buckets   buckets/day   span     attacks');
for (const season of STAT_SEASONS) {
    for (const f of FACTIONS) {
        const series = ds.statisticSeries(season, f.enemy);
        if (series.length === 0) continue;
        const spanDays =
            (Number(series.at(-1).bucket) - Number(series[0].bucket)) / 86400;
        const attacks = ds.events.filter(
            (e) => e.type === 'attack' && e.enemy === f.enemy && e.season === season,
        ).length;
        console.log(
            `  ${String(season).padEnd(8)} ${f.name.padEnd(12)} ${String(series.length).padStart(7)}   ` +
                `${(series.length / Math.max(spanDays, 0.01)).toFixed(1).padStart(11)}   ` +
                `${spanDays.toFixed(1).padStart(4)}d   ${attacks}`,
        );
    }
}
const totalAttacks = ds.events.filter(
    (e) => e.type === 'attack' && STAT_SEASON_SET.has(e.season),
).length;
console.log(
    `\n  ${totalAttacks} attacks total in the eval window — every number below is read at that N.`,
);
console.log(
    '  Ratio table: 100% of samples folded with the dow-adjusted ETA (0% player-',
);
console.log(
    '  adjusted) — a transfer assumption, tested by the when-showing calibration.\n',
);

// --- run -------------------------------------------------------------------

const VARIANT_DEFS = [
    { key: 'V0 dow', kind: 'v0' },
    { key: 'V1 crude-players', kind: 'v1' },
    ...ALPHAS.map((a) => ({ key: `V2 pph a=${a}`, kind: 'v2', alpha: a })),
    ...ALPHAS.map((a) => ({ key: `V3 how a=${a}`, kind: 'v3', alpha: a })),
];

const results = [];
for (const f of FACTIONS) {
    const momentFilter = (t, seasonEvents) => {
        if (seasonEvents.length === 0) return false;
        const season = seasonEvents[0].season;
        if (attackActive(t, seasonEvents)) return false;
        if (!rawEtaVariant(season, f.enemy, t, { kind: 'v0', adjust: null })) {
            return false;
        }
        // Player-data requirements apply only where telemetry exists: eval
        // seasons all have it, so eval moments carry the full filter, while
        // pre-telemetry TRAIN seasons keep contributing to the constant
        // baseline exactly as in script 10.
        if (STAT_SEASON_SET.has(season)) {
            const p = ds.playersAt(season, f.enemy, t);
            if (!p || (t - Number(p.bucket)) / HOUR > MAX_PLAYER_STALENESS_HOURS) {
                return false;
            }
            const series = ds.statisticSeries(season, f.enemy);
            if (playerHoursBetween(series, t - RATE_WINDOW_HOURS * HOUR, t, 1) === null) {
                return false;
            }
        }
        return true;
    };

    for (const v of VARIANT_DEFS) {
        const pat =
            v.kind === 'v2' || v.kind === 'v3' ?
                makeHowPattern((s) => ds.statisticSeries(s, f.enemy))
            :   null;
        const summary = walkForward({
            events: ds.events,
            seasons: ds.seasons,
            type: 'attack',
            enemy: f.enemy,
            stepHours: STEP_HOURS,
            firstEvalSeason: FIRST_EVAL_SEASON,
            fitPredictor: makeFitPredictor(f.enemy, v, pat),
            momentFilter,
            // Most telemetry seasons have exactly ONE attack, and the default
            // warmup skip would discard every pre-attack moment — the only
            // uncensored ones such a season has. Our predictors never read
            // moment.lastEvent, so those moments are fully well-posed.
            allowNoPriorEvent: true,
        });
        results.push({ label: `${f.name} / ${v.key}`, f, v, summary });
    }
}

// Fairness: every variant of a faction must have been scored on the exact same
// moments — otherwise the comparison is compositional, not paired.
for (const f of FACTIONS) {
    const sets = results
        .filter((r) => r.f.enemy === f.enemy)
        .map((r) => new Set(r.summary.records.map((x) => `${x.season}:${x.t}`)));
    for (let i = 1; i < sets.length; i++) {
        assert.equal(sets[i].size, sets[0].size, `moment-set size differs (${f.name})`);
        for (const k of sets[0]) {
            assert(sets[i].has(k), `moment ${k} missing from a variant (${f.name})`);
        }
    }
}

// --- main table ------------------------------------------------------------

console.log('--- Walk-forward on telemetry seasons only ---\n');
console.log(
    'config                        effN   cal 25/50/75        MAE/base     skill [95% CI]',
);
for (const r of results) {
    const s = r.summary;
    console.log(
        `${r.label.padEnd(28)} ${String(s.effectiveN).padStart(5)}   ` +
            `${s.calibration.q25.toFixed(3)}/${s.calibration.q50.toFixed(3)}/${s.calibration.q75.toFixed(3)}   ` +
            `${s.medianAbsErrorHours.toFixed(1)}/${s.baselineMedianAbsErrorHours.toFixed(1)}h   ` +
            `${s.skillRatio.toFixed(3)} [${s.skillRatioCI[0].toFixed(3)}, ${s.skillRatioCI[1].toFixed(3)}]`,
    );
}

// --- paired comparison vs V0 ----------------------------------------------

console.log('\n--- Paired Δ|err| vs V0 (negative = variant better) ---\n');
console.log('  Identical moments, per record: |err_variant| − |err_V0|. Season-block');
console.log(
    '  bootstrap CI over the paired median — coarse over ≤4 seasons, by design.\n',
);
console.log(
    'config                        n      median Δ [95% CI]        per-season (win/loss)',
);

/**
 * @param {object[]} vRecords
 * @param {object[]} v0Records
 * @returns {{deltas: {season: number, d: number}[]}|null}
 */
function pairedDeltas(vRecords, v0Records) {
    const v0ByKey = new Map(v0Records.map((r) => [`${r.season}:${r.t}`, r]));
    const deltas = [];
    for (const r of vRecords) {
        const b = v0ByKey.get(`${r.season}:${r.t}`);
        if (!b || r.absErr === null || b.absErr === null) continue;
        deltas.push({ season: r.season, d: r.absErr - b.absErr });
    }
    return deltas.length > 0 ? { deltas } : null;
}

const paired = [];
for (const f of FACTIONS) {
    const v0 = results.find((r) => r.f.enemy === f.enemy && r.v.kind === 'v0');
    for (const r of results) {
        if (r.f.enemy !== f.enemy || r.v.kind === 'v0') continue;
        const p = pairedDeltas(r.summary.records, v0.summary.records);
        if (!p) continue;

        const med = quantileOf(
            p.deltas.map((x) => x.d),
            0.5,
        );

        // Season-block bootstrap of the paired median (fixed-seed LCG, same
        // idiom as backtest.mjs so re-runs reproduce exactly).
        const seasonIds = [...new Set(p.deltas.map((x) => x.season))];
        const bySeason = new Map(
            seasonIds.map((s) => [s, p.deltas.filter((x) => x.season === s)]),
        );
        let rngState = 123456789;
        const rand = () => {
            rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
            return rngState / 4294967296;
        };
        const meds = [];
        for (let b = 0; b < 200; b++) {
            const sample = [];
            for (let i = 0; i < seasonIds.length; i++) {
                sample.push(
                    ...bySeason.get(seasonIds[Math.floor(rand() * seasonIds.length)]),
                );
            }
            const m = quantileOf(
                sample.map((x) => x.d),
                0.5,
            );
            if (m !== null) meds.push(m);
        }
        meds.sort((a, b) => a - b);
        const ci = [quantileOf(meds, 0.025) ?? med, quantileOf(meds, 0.975) ?? med];

        const perSeason = seasonIds.map((s) => {
            const m = quantileOf(
                bySeason.get(s).map((x) => x.d),
                0.5,
            );
            return { season: s, win: m < 0 };
        });
        const wins = perSeason.filter((x) => x.win).length;

        paired.push({
            label: r.label,
            f,
            v: r.v,
            med,
            ci,
            perSeason,
            wins,
            deltas: p.deltas,
        });
        console.log(
            `${r.label.padEnd(28)} ${String(p.deltas.length).padStart(5)}  ` +
                `${med >= 0 ? '+' : ''}${med.toFixed(2)}h [${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}]`.padEnd(
                    26,
                ) +
                `${wins}/${perSeason.length - wins}  ` +
                perSeason.map((x) => `${x.season}${x.win ? '+' : '-'}`).join(' '),
        );
    }
}

// --- alert bar -------------------------------------------------------------

console.log('\n--- Alert bar (fires when p50 < 48h; calibration when showing) ---\n');
for (const r of results) {
    const recs = r.summary.records.filter((x) => x.wait !== null);
    const targets = new Set(recs.map((x) => x.target));
    const fired = new Set(recs.filter((x) => x.q50 < DISPLAY_HOURS).map((x) => x.target));
    const showing = recs.filter((x) => x.q50 < DISPLAY_HOURS);
    const honoured = showing.filter((x) => x.wait < 2 * x.q75);
    const recall = targets.size > 0 ? fired.size / targets.size : 0;
    const precision = showing.length > 0 ? honoured.length / showing.length : 0;
    const hit = (q) =>
        showing.length > 0 ?
            showing.filter((x) => x.wait < x[q]).length / showing.length
        :   0;
    console.log(
        `  ${r.label.padEnd(28)} recall ${(recall * 100).toFixed(0).padStart(3)}% of ${targets.size}` +
            ` | precision ${(precision * 100).toFixed(0).padStart(3)}% of ${String(showing.length).padStart(3)}` +
            ` | showing p25/p50/p75 ${hit('q25').toFixed(2)}/${hit('q50').toFixed(2)}/${hit('q75').toFixed(2)}`,
    );
}

// --- verdict ---------------------------------------------------------------

console.log('\n--- Verdict ---\n');

const v1Rows = paired.filter((x) => x.v.kind === 'v1');
const v1AllWorse = v1Rows.every((x) => x.med > 0);
console.log(
    v1AllWorse ?
        '  [1] V1 (crude player ratio) reproduces as WORSE than V0 on every faction —'
    :   '  [1] *** V1 DID NOT REPRODUCE AS WORSE — the documented negative result does',
);
console.log(
    v1AllWorse ?
        '      consistent with the documented 23.5% → 28.1% regression.'
    :   '      NOT transfer to high-res telemetry; re-read every comparison above. ***',
);

for (const f of FACTIONS) {
    const effN = results.find((r) => r.f.enemy === f.enemy && r.v.kind === 'v0').summary
        .effectiveN;
    if (effN < 30) {
        console.log(
            `  [2] ${f.name}: effN=${effN} — INSUFFICIENT N, directional only, do not conclude.`,
        );
    } else {
        console.log(`  [2] ${f.name}: effN=${effN}.`);
    }
}

console.log('\n  Pooled across factions (directional only at this N):');
for (const v of VARIANT_DEFS) {
    if (v.kind === 'v0') continue;
    const all = paired.filter((x) => x.v.key === v.key).flatMap((x) => x.deltas);
    if (all.length === 0) continue;
    const med = quantileOf(
        all.map((x) => x.d),
        0.5,
    );
    console.log(
        `        ${v.key.padEnd(20)} median Δ ${med >= 0 ? '+' : ''}${med.toFixed(2)}h over ${all.length} paired moments`,
    );
}
console.log('');

// A variant only QUALIFIES on this faction when the evidence could actually
// support a model swap: better paired median, at least two seasons of paired
// data all won, a CI clear of zero that is not degenerate (a single season
// resamples to itself), and a real effective N behind it.
const QUALIFY_EFFN = 30;
const winners = paired.filter((x) => {
    if (x.v.kind === 'v1') return false;
    const effN = results.find((r) => r.f.enemy === x.f.enemy && r.v.kind === 'v0').summary
        .effectiveN;
    return (
        x.med < 0 &&
        x.perSeason.length >= 2 &&
        x.wins === x.perSeason.length &&
        x.ci[1] < 0 &&
        effN >= QUALIFY_EFFN
    );
});
if (winners.length > 0) {
    console.log('  [3] Variants qualifying for a model swap on their faction:');
    for (const w of winners) console.log(`        ${w.label}  Δ ${w.med.toFixed(2)}h`);
    console.log('      The α grid is exploratory — treat the best-α row as such.');
} else {
    console.log(
        `  [3] No variant qualifies (needs: better paired median, >=2 paired seasons`,
    );
    console.log(
        `      all won, non-degenerate CI < 0, and effN >= ${QUALIFY_EFFN} on that faction).`,
    );
}

console.log('\n  Decision rule: swap the shipped model only if [1] holds, some variant');
console.log(
    '  clears [3], AND the result survives being read at the N in [2]. Otherwise:',
);
console.log('  keep the shipped model, record the numbers in docs/predict.\n');
