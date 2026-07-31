/**
 * 16-counterattack-pipeline.mjs — the mechanistic pipeline vs the KM table,
 * on the ATTACK and SC9 states (handoff question 4).
 *
 * `14-counterattack-delta.mjs` established the chain: an assault fires at
 * points == points_max (09), a FAIL-resolved assault runs exactly 48.0h
 * (544/544 — a timeout), and the counterattack train starts within 2h of
 * that timeout (467/474 slot-free). So for moments where an assault is
 * running (ATTACK) or imminent (SC9), the next wave may be predictable as a
 * near-deterministic composite rather than a KM quantile lookup.
 *
 * PRE-REGISTERED COMPOSITE — declared before the first comparison run, not
 * tuned after (this is a comparison, not a fishing trip):
 *   - ATTACK moments: predicted wait = (earliest active assault's start
 *     + 48h) − t, floored at 0.25h. Point forecast (p25=p50=p75) — the bet
 *     is "the assault times out (the majority outcome: 544 fail vs 381
 *     success) and the counterattack fires immediately". Success-destined
 *     assaults are the composite's honest error mass: the wave then comes
 *     from the free scheduler later.
 *   - SC9 moments: predicted wait = attack ETA + 48h, where the ETA is
 *     (points_max − points) / rate over a 24h pace window with the
 *     staleness anchor correction — `10-attack-eta.mjs`'s backtested
 *     estimator, minus its day-of-week refinement (kept minimal; the
 *     refinement could only help). Moments with no valid rate emit the
 *     fallback and are EXCLUDED from the comparison (counted).
 *   - All other moments: featureless residual-life fallback, never compared.
 *   - Comparator: `07-train-state-model.mjs`'s STATE-KM replica, walked on
 *     the SAME ORIGINAL series (all train starts — counterattacks ARE the
 *     next wave at these moments, so the uncorrected target is the right
 *     one here), paired moment-by-moment via `${season}:${t}`.
 *   - Decision rule: the pipeline beats the KM table on a branch iff the
 *     season-block-bootstrap 95% CI upper bound of
 *     median|err|_pipeline / median|err|_KM is < 1, on paired UNCENSORED
 *     moments of that branch.
 *
 * Run: node --env-file=.env.development scripts/analysis/16-counterattack-pipeline.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, makeRng, HOUR, SECTOR_COUNT } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const KNN_K = 200;
const MIN_CELL = 30;
const STEP_HOURS = 3;
const ASSAULT_HOURS = 48; // 544/544 fail-resolved assaults ran exactly 48.0h (14)
const RATE_WINDOW_HOURS = 24; // same as 10-attack-eta.mjs
const MIN_ETA_HOURS = 0.25;
const BOOTSTRAP = 500;

// --- pure helpers ------------------------------------------------------------

/**
 * ATTACK-branch composite wait: earliest active assault start + 48h, from t.
 *
 * @param {number[]} activeStarts start_times of assaults active at t (>= 1)
 * @param {number} t unix seconds
 * @returns {number} hours, floored at MIN_ETA_HOURS
 */
function attackBranchWait(activeStarts, t) {
    const wave = Math.min(...activeStarts) + ASSAULT_HOURS * HOUR;
    return Math.max(MIN_ETA_HOURS, (wave - t) / HOUR);
}

/**
 * Empirical residual-life predictor — same as 02/04/07/15.
 *
 * @param {number[]} gaps hours
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
 * K nearest samples by |elapsed| — same as 07/15.
 *
 * @param {{elapsed: number}[]} samples sorted by elapsed asc
 * @param {number} elapsed
 * @param {number} k
 * @returns {object[]}
 */
function nearestSamples(samples, elapsed, k) {
    const n = samples.length;
    if (n === 0) return [];
    if (n <= k) return [...samples];
    let lo = 0;
    let hi = n;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].elapsed < elapsed) lo = mid + 1;
        else hi = mid;
    }
    let left = lo - 1;
    let right = lo;
    const picked = [];
    while (picked.length < k) {
        const dLeft = left >= 0 ? elapsed - samples[left].elapsed : Infinity;
        const dRight = right < n ? samples[right].elapsed - elapsed : Infinity;
        if (dLeft <= dRight) {
            picked.push(samples[left]);
            left--;
        } else {
            picked.push(samples[right]);
            right++;
        }
    }
    return picked;
}

/**
 * Kaplan-Meier product-limit quantiles — same as 07/15.
 *
 * @param {{wait: number|null, censorAt?: number}[]} samples non-empty
 * @returns {{p25: number, p50: number, p75: number}}
 */
function kmQuantiles(samples) {
    assert(samples.length > 0, 'kmQuantiles requires samples');
    const points = samples
        .map((s) => ({
            time: s.wait !== null ? s.wait : s.censorAt,
            event: s.wait !== null,
        }))
        .sort((a, b) => a.time - b.time || (a.event ? 0 : 1) - (b.event ? 0 : 1));
    let atRisk = points.length;
    let survival = 1;
    let lastEventTime = null;
    const cdfSteps = [];
    for (const p of points) {
        if (p.event) {
            survival *= (atRisk - 1) / atRisk;
            cdfSteps.push([p.time, 1 - survival]);
            lastEventTime = p.time;
        }
        atRisk--;
    }
    assert(lastEventTime !== null, 'kmQuantiles requires at least one uncensored sample');
    /** @param {number} q @returns {number} */
    function quantile(q) {
        for (const [time, cdf] of cdfSteps) if (cdf >= q) return time;
        return lastEventTime;
    }
    return { p25: quantile(0.25), p50: quantile(0.5), p75: quantile(0.75) };
}

/**
 * Season-block bootstrap CI of the ratio of median absolute errors between
 * two paired error series.
 *
 * @param {{season: number, a: number, b: number}[]} pairs per-moment |err|
 *   for pipeline (a) and comparator (b)
 * @param {() => number} rng
 * @param {number} draws
 * @returns {{ratio: number, ci: [number, number]}}
 */
function pairedMedianRatioCI(pairs, rng, draws) {
    const medA = quantileOf(
        pairs.map((p) => p.a),
        0.5,
    );
    const medB = quantileOf(
        pairs.map((p) => p.b),
        0.5,
    );
    const ratio = medA / medB;
    const seasonIds = [...new Set(pairs.map((p) => p.season))];
    const bySeason = new Map(
        seasonIds.map((s) => [s, pairs.filter((p) => p.season === s)]),
    );
    const ratios = [];
    for (let d = 0; d < draws; d++) {
        const sample = [];
        for (let i = 0; i < seasonIds.length; i++) {
            sample.push(...bySeason.get(seasonIds[Math.floor(rng() * seasonIds.length)]));
        }
        const ma = quantileOf(
            sample.map((p) => p.a),
            0.5,
        );
        const mb = quantileOf(
            sample.map((p) => p.b),
            0.5,
        );
        if (ma !== null && mb !== null && mb > 0) ratios.push(ma / mb);
    }
    ratios.sort((x, y) => x - y);
    return {
        ratio,
        ci: [quantileOf(ratios, 0.025) ?? ratio, quantileOf(ratios, 0.975) ?? ratio],
    };
}

// --- pure self-checks (no DB) ------------------------------------------------

{
    // attackBranchWait: earliest assault's timeout wins; floor applies.
    const t0 = 1000 * HOUR;
    assert.equal(
        attackBranchWait([t0 - 10 * HOUR, t0 - 2 * HOUR], t0),
        38,
        'earliest active assault times out first',
    );
    assert.equal(
        attackBranchWait([t0 - 47.99 * HOUR], t0 + 0 * HOUR) >= MIN_ETA_HOURS,
        true,
        'floor',
    );
}

{
    // pairedMedianRatioCI: a planted 2x error gap must produce ratio ~0.5
    // with a CI excluding 1; identical series must give ratio 1.
    const rng = makeRng(990001);
    const pairs = [];
    for (let s = 0; s < 20; s++) {
        for (let i = 0; i < 30; i++) {
            const b = 5 + rng() * 10;
            pairs.push({ season: s, a: b / 2, b });
        }
    }
    const r = pairedMedianRatioCI(pairs, makeRng(770001), 200);
    assert(
        Math.abs(r.ratio - 0.5) < 0.05,
        `planted ratio should be ~0.5, got ${r.ratio}`,
    );
    assert(r.ci[1] < 1, 'planted CI upper must exclude 1');
    const same = pairedMedianRatioCI(
        pairs.map((p) => ({ ...p, a: p.b })),
        makeRng(770001),
        200,
    );
    assert.equal(same.ratio, 1, 'identical series ratio must be 1');
}

console.log('=== 16-counterattack-pipeline: pure self-checks OK ===');

// --- data --------------------------------------------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const attacks = ds.events.filter((e) => e.type === 'attack');
const trainStarts = allDefends.filter((e) => e.isTrainStart);

const defendsBySeason = new Map();
for (const e of allDefends) {
    if (!defendsBySeason.has(e.season)) defendsBySeason.set(e.season, []);
    defendsBySeason.get(e.season).push(e);
}
const attacksBySeason = new Map();
for (const a of attacks) {
    if (!attacksBySeason.has(a.season)) attacksBySeason.set(a.season, []);
    attacksBySeason.get(a.season).push(a);
}

/**
 * Sectors captured — same formula as 01/06/07/15.
 *
 * @param {number} season @param {number} enemy @param {number} t
 * @returns {number|null}
 */
function sectorsCapturedAt(season, enemy, t) {
    const st = ds.statusAt(season, enemy, t);
    const max = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    return st && max > 0 ? Math.trunc(st.points / (max / SECTOR_COUNT)) : null;
}

/**
 * Observable state + the ingredients the pipeline needs at a moment.
 *
 * @param {number} season @param {number} t
 * @returns {{state: string, activeStarts: number[], sc9Factions: number[]}}
 */
function stateDetailAt(season, t) {
    const activeStarts = (attacksBySeason.get(season) ?? [])
        .filter((a) => a.start_time <= t && a.end_time > t)
        .map((a) => a.start_time);
    if (activeStarts.length > 0)
        return { state: 'ATTACK', activeStarts, sc9Factions: [] };
    const scs = [0, 1, 2].map((en) => sectorsCapturedAt(season, en, t));
    const known = scs.filter((v) => v !== null);
    const maxSC = known.length > 0 ? Math.max(...known) : null;
    if (maxSC === 9) {
        return {
            state: 'SC9',
            activeStarts: [],
            sc9Factions: [0, 1, 2].filter((en) => scs[en] === 9),
        };
    }
    return { state: maxSC === 10 ? 'SC10' : 'NORMAL', activeStarts: [], sc9Factions: [] };
}

/**
 * Raw attack ETA — `10-attack-eta.mjs`'s estimator (24h window, actual-span
 * rate, staleness anchor correction), without the day-of-week refinement.
 *
 * @param {number} season @param {number} enemy @param {number} t
 * @returns {number|null} hours, or null when no forecast is possible
 */
function attackEtaHours(season, enemy, t) {
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
    let etaHours = remaining / ratePerHour;
    etaHours -= (t - Number(stNow.bucket)) / HOUR; // staleness anchor
    return Math.max(MIN_ETA_HOURS, etaHours);
}

// Per-season moment samples over the ORIGINAL series — 07 replica.
const momentSamplesBySeason = new Map();
for (const [season, list] of defendsBySeason) {
    const span = ds.seasons.get(season);
    if (!span || span.spanSeconds === 0) continue;
    const starts = list.filter((e) => e.isTrainStart);
    if (starts.length < 2) continue;
    const samples = [];
    for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
        if (list.some((e) => e.start_time <= t && e.end_time > t)) continue;
        const last = starts.filter((e) => e.start_time <= t).at(-1);
        if (!last) continue;
        const next = starts.find((e) => e.start_time > t);
        const censorAt = (span.lastEnd - t) / HOUR;
        if (!next && censorAt <= 0) continue;
        samples.push({
            season,
            state: stateDetailAt(season, t).state,
            elapsed: (t - last.start_time) / HOUR,
            wait: next ? (next.start_time - t) / HOUR : null,
            censorAt: next ? null : censorAt,
        });
    }
    momentSamplesBySeason.set(season, samples);
}
assert(momentSamplesBySeason.size > 100, 'expected moment samples for most seasons');

const activeBySeasonSorted = new Map(
    [...defendsBySeason.entries()].map(([s, list]) => [
        s,
        [...list].sort((a, b) => a.start_time - b.start_time),
    ]),
);

/**
 * walkForward momentFilter — same as 07/15.
 *
 * @param {number} t @param {object[]} seasonEvents
 * @returns {boolean}
 */
function noDefendActive(t, seasonEvents) {
    const season = seasonEvents[0]?.season;
    const list = activeBySeasonSorted.get(season) ?? [];
    return !list.some((e) => e.start_time <= t && e.end_time > t);
}

/**
 * STATE-KM — 07's best configuration, original series.
 *
 * @param {object[]} trainEvents @param {object} ctx
 */
function fitStateKM(trainEvents, ctx) {
    const byState = new Map();
    const pooled = [];
    for (const [season, samples] of momentSamplesBySeason) {
        if (season >= ctx.testSeason) continue;
        for (const s of samples) {
            assert(s.season < ctx.testSeason, 'state sample from a non-training season');
            if (!byState.has(s.state)) byState.set(s.state, []);
            byState.get(s.state).push(s);
            pooled.push(s);
        }
    }
    for (const arr of byState.values()) arr.sort((a, b) => a.elapsed - b.elapsed);
    pooled.sort((a, b) => a.elapsed - b.elapsed);
    return function predict(moment) {
        const state = stateDetailAt(moment.season, moment.t).state;
        const elapsed = Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR);
        const cell = byState.get(state) ?? [];
        const samples = cell.length >= MIN_CELL ? cell : pooled;
        assert(samples.length > 0, 'no training samples available');
        return kmQuantiles(nearestSamples(samples, elapsed, KNN_K));
    };
}

// Branch tag per evaluated moment, recorded at predict time so the paired
// comparison below can select exactly the moments the pipeline actually
// forecast mechanistically.
const branchByMoment = new Map();

/**
 * PIPELINE — the pre-registered composite (see header).
 *
 * @param {object[]} trainEvents @param {object} ctx
 */
function fitPipeline(trainEvents, ctx) {
    const fallback = makeResidualPredictor(ctx.trainGaps);
    return function predict(moment) {
        const detail = stateDetailAt(moment.season, moment.t);
        const key = `${moment.season}:${moment.t}`;
        if (detail.state === 'ATTACK') {
            branchByMoment.set(key, 'ATTACK');
            const w = attackBranchWait(detail.activeStarts, moment.t);
            return { p25: w, p50: w, p75: w };
        }
        if (detail.state === 'SC9') {
            const etas = detail.sc9Factions
                .map((en) => attackEtaHours(moment.season, en, moment.t))
                .filter((v) => v !== null);
            if (etas.length > 0) {
                branchByMoment.set(key, 'SC9');
                const w = Math.min(...etas) + ASSAULT_HOURS;
                return { p25: w, p50: w, p75: w };
            }
            branchByMoment.set(key, 'SC9-noeta');
        } else {
            branchByMoment.set(key, 'other');
        }
        return fallback(Math.max(0, (moment.t - moment.lastEvent.start_time) / HOUR));
    };
}

// --- paired walk-forward comparison ------------------------------------------

console.log('\n=== paired walk-forward: PIPELINE vs STATE-KM (original target) ===');
const kmRun = walkForward({
    events: trainStarts,
    seasons: ds.seasons,
    type: 'defend',
    enemy: undefined,
    fitPredictor: fitStateKM,
    momentFilter: noDefendActive,
});
const pipeRun = walkForward({
    events: trainStarts,
    seasons: ds.seasons,
    type: 'defend',
    enemy: undefined,
    fitPredictor: fitPipeline,
    momentFilter: noDefendActive,
});
console.log(
    `  STATE-KM: moments=${kmRun.moments} skill=${kmRun.skillRatio.toFixed(3)} [${kmRun.skillRatioCI[0].toFixed(3)}-${kmRun.skillRatioCI[1].toFixed(3)}]`,
);
console.log(
    `  PIPELINE: moments=${pipeRun.moments} (branch tags: ${branchByMoment.size})`,
);

const kmByKey = new Map(kmRun.records.map((r) => [`${r.season}:${r.t}`, r]));
const branchCounts = new Map();
for (const tag of branchByMoment.values()) {
    branchCounts.set(tag, (branchCounts.get(tag) ?? 0) + 1);
}
console.log(
    `  branch coverage: ${[...branchCounts.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .join('  ')}`,
);

for (const branch of ['ATTACK', 'SC9']) {
    const pairs = [];
    let censoredSkipped = 0;
    for (const r of pipeRun.records) {
        const key = `${r.season}:${r.t}`;
        if (branchByMoment.get(key) !== branch) continue;
        const km = kmByKey.get(key);
        assert(km, `unpaired moment ${key}`);
        if (r.wait === null) {
            censoredSkipped++;
            continue;
        }
        assert.equal(km.wait, r.wait, 'paired moments must share the true wait');
        pairs.push({
            season: r.season,
            a: Math.abs(r.wait - r.q50),
            b: Math.abs(km.wait - km.q50),
        });
    }
    if (pairs.length === 0) {
        console.log(`\n${branch}: no paired uncensored moments`);
        continue;
    }
    const { ratio, ci } = pairedMedianRatioCI(pairs, makeRng(160731), BOOTSTRAP);
    const winRate = pairs.filter((p) => p.a < p.b).length / pairs.length;
    const medA = quantileOf(
        pairs.map((p) => p.a),
        0.5,
    );
    const medB = quantileOf(
        pairs.map((p) => p.b),
        0.5,
    );
    console.log(
        `\n${branch} branch (paired uncensored n=${pairs.length}, censored skipped=${censoredSkipped}, seasons=${new Set(pairs.map((p) => p.season)).size}):`,
    );
    console.log(
        `  median |err|: pipeline ${medA.toFixed(1)}h vs STATE-KM ${medB.toFixed(1)}h  ` +
            `ratio=${ratio.toFixed(3)} (95% CI ${ci[0].toFixed(3)}-${ci[1].toFixed(3)})  win rate=${winRate.toFixed(3)}`,
    );
    console.log(
        ci[1] < 1 ?
            `  PIPELINE BEATS THE KM TABLE on ${branch} (CI upper < 1, pre-registered rule).`
        :   `  NOT better on ${branch} under the pre-registered rule (CI upper >= 1).`,
    );
}
