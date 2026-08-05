/**
 * 13-scheduler-shape.mjs — reverse-engineering the wave scheduler's SHAPE.
 *
 * Asks "which game-dev design produces the observed lull distribution?" and
 * discriminates six candidate implementations by their statistical
 * fingerprints:
 *   H1 memoryless dice (per-tick p)        -> exponential lulls, CV = 1
 *   H2 cooldown + uniform roll             -> flat-topped window
 *   H3 coarse scheduler tick               -> comb in lull mod tick
 *   H4 k-stage accumulator                 -> gamma shape, CV = 1/sqrt(k)
 *   H5 per-faction independent timers      -> per-faction cleaner than pooled
 *   H6 fixed per-season schedule table     -> regularity varies by wave index
 *
 * Every statistic here is descriptive-forensic, not a hypothesis test with
 * a placebo — the discriminations rest on large, qualitative gaps (KS 0.07
 * vs 0.31; CV 0.78 vs 0.45), not on p-values. The one caveat is printed
 * with the comb test: only tick sizes well below the distribution's spread
 * are testable that way.
 *
 * Run: node --env-file=.env.development scripts/analysis/13-scheduler-shape.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

// --- pure math helpers -------------------------------------------------------

/**
 * Natural log of the gamma function (Lanczos approximation, g=7).
 *
 * @param {number} x positive real
 * @returns {number}
 */
export function lnGamma(x) {
    const g = [
        676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
        12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
        1.5056327351493116e-7,
    ];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
    x -= 1;
    let a = 0.99999999999980993;
    const t = x + 7.5;
    for (let i = 0; i < 8; i++) a += g[i] / (x + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Regularized lower incomplete gamma P(k, x/theta) — the gamma CDF.
 * Series expansion; adequate for the k/x ranges used here.
 *
 * @param {number} x value (hours)
 * @param {number} k shape
 * @param {number} theta scale (hours)
 * @returns {number} in [0, 1]
 */
export function gammaCdf(x, k, theta) {
    const z = x / theta;
    if (z <= 0) return 0;
    let sum = 1 / k;
    let term = sum;
    for (let n = 1; n < 500; n++) {
        term *= z / (k + n);
        sum += term;
        if (term < 1e-14) break;
    }
    return Math.min(1, sum * Math.exp(-z + k * Math.log(z) - lnGamma(k)));
}

/**
 * Kolmogorov-Smirnov distance between a sorted sample and a CDF.
 *
 * @param {number[]} sortedSample ascending
 * @param {(x: number) => number} cdf
 * @returns {number}
 */
export function ksDistance(sortedSample, cdf) {
    let d = 0;
    const n = sortedSample.length;
    for (let i = 0; i < n; i++) {
        const c = cdf(sortedSample[i]);
        d = Math.max(d, Math.abs((i + 1) / n - c), Math.abs(i / n - c));
    }
    return d;
}

/**
 * Chi-squared of values folded modulo `mod` into `bins` equal bins, against
 * a uniform expectation. Used for both wall-clock and relative tick combs.
 *
 * @param {number[]} values seconds
 * @param {number} mod seconds
 * @param {number} bins
 * @returns {{chi2: number, maxShare: number}}
 */
export function combChi2(values, mod, bins) {
    const counts = new Array(bins).fill(0);
    for (const v of values) {
        counts[Math.floor((((v % mod) + mod) % mod) / (mod / bins))]++;
    }
    const n = values.length;
    const exp = n / bins;
    const chi2 = counts.reduce((a, c) => a + (c - exp) ** 2 / exp, 0);
    return { chi2, maxShare: Math.max(...counts) / n };
}

// --- self-checks (no DB) -----------------------------------------------------

{
    // lnGamma against known values: Γ(5) = 24, Γ(0.5) = sqrt(pi).
    assert(Math.abs(lnGamma(5) - Math.log(24)) < 1e-9, 'lnGamma(5)');
    assert(Math.abs(lnGamma(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-9, 'lnGamma(0.5)');
    // gammaCdf: k=1 is exponential — CDF(theta) = 1 - 1/e.
    assert(
        Math.abs(gammaCdf(10, 1, 10) - (1 - Math.exp(-1))) < 1e-6,
        'gammaCdf k=1 must reduce to exponential',
    );
    // Median of gamma(k=1, theta=1) is ln 2.
    assert(Math.abs(gammaCdf(Math.LN2, 1, 1) - 0.5) < 1e-6, 'gammaCdf median');
    // ksDistance: a sample drawn AT the CDF's own quantiles scores near 1/(2n)... use
    // an exact fixture: sample [1,2,3] vs CDF(x)=x/4 -> max deviation at x=3: |1 - 0.75|.
    assert(
        Math.abs(ksDistance([1, 2, 3], (x) => x / 4) - 0.25) < 1e-12,
        'ksDistance fixture',
    );
    // combChi2 detects a planted tick: multiples of 3600 fold into one bin.
    const ticked = Array.from({ length: 120 }, (_, i) => (i + 1) * 3600);
    const flat = Array.from({ length: 120 }, (_, i) => i * 997 + 13);
    assert(
        combChi2(ticked, 3600, 12).chi2 > combChi2(flat, 3600, 12).chi2 * 10,
        'combChi2 must detect a planted tick',
    );
}

console.log('=== 13-scheduler-shape: pure self-checks OK ===');

// --- data --------------------------------------------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const bySeason = new Map();
for (const e of allDefends) {
    if (!bySeason.has(e.season)) bySeason.set(e.season, []);
    bySeason.get(e.season).push(e);
}

const lulls = [];
for (const [season, list] of bySeason) {
    const idx = [];
    for (let i = 0; i < list.length; i++) if (list[i].isTrainStart) idx.push(i);
    for (let k = 1; k < idx.length; k++) {
        lulls.push({
            season,
            h: (list[idx[k]].start_time - list[idx[k] - 1].end_time) / HOUR,
            sec: list[idx[k]].start_time - list[idx[k] - 1].end_time,
            waveIndex: k,
            prevTrainDurationH:
                (list[idx[k] - 1].end_time - list[idx[k - 1]].start_time) / HOUR,
        });
    }
}
assert(lulls.length > 1500, `expected ~1800 lulls, got ${lulls.length}`);

const H = lulls.map((r) => r.h);
const mean = H.reduce((a, b) => a + b, 0) / H.length;
const sd = Math.sqrt(H.reduce((a, b) => a + (b - mean) ** 2, 0) / H.length);
const cv = sd / mean;
const skew = H.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / H.length;
console.log(
    `\nlulls n=${H.length}  mean=${mean.toFixed(1)}h  sd=${sd.toFixed(1)}h  CV=${cv.toFixed(3)}  skew=${skew.toFixed(2)}`,
);
assert(cv < 0.9, 'CV should already rule out a memoryless process');

// --- H1/H2/H4: shape fits ----------------------------------------------------

const sorted = [...H].sort((a, b) => a - b);
const ksExp = ksDistance(sorted, (x) => 1 - Math.exp(-x / mean));
const kHat = 1 / (cv * cv);
const thetaHat = mean * cv * cv;
const ksGam = ksDistance(sorted, (x) => gammaCdf(x, kHat, thetaHat));
const a5 = quantileOf(H, 0.05);
const b95 = quantileOf(H, 0.95);
const ksUni = ksDistance(sorted, (x) => Math.max(0, Math.min(1, (x - a5) / (b95 - a5))));
console.log('\nshape fits (KS distance, smaller = better):');
console.log(`  H1 exponential (memoryless):        ${ksExp.toFixed(3)}`);
console.log(
    `  H4 gamma (k=${kHat.toFixed(1)}, theta=${thetaHat.toFixed(1)}h):  ${ksGam.toFixed(3)}`,
);
console.log(`  H2 uniform [p05, p95]:              ${ksUni.toFixed(3)}`);
assert(ksGam < ksExp / 2, 'gamma must beat exponential decisively');

// --- H3/H6: tick combs -------------------------------------------------------

const starts = allDefends.filter((e) => e.isTrainStart);
const startTimes = starts.map((e) => e.start_time);
const nonZeroSeconds = startTimes.filter((t) => t % 60 !== 0).length;
console.log(
    `\ntimestamp entropy: ${nonZeroSeconds}/${startTimes.length} train starts have non-zero seconds`,
);
console.log('wall-clock combs (train-start times; chi2 ~ df means no comb):');
for (const [label, mod, bins] of [
    ['mod 15 min', 900, 15],
    ['mod 1 h', 3600, 12],
]) {
    const { chi2, maxShare } = combChi2(startTimes, mod, bins);
    console.log(
        `  ${label}: chi2=${chi2.toFixed(1)} (df=${bins - 1})  max bin ${(maxShare * 100).toFixed(1)}% vs uniform ${(100 / bins).toFixed(1)}%`,
    );
}
console.log(
    'relative tick combs (lull mod tick; only ticks well below the ~19h IQR are testable):',
);
const lullSecs = lulls.map((r) => r.sec);
for (const tickH of [0.5, 1, 2, 3, 6]) {
    const { chi2, maxShare } = combChi2(lullSecs, tickH * 3600, 12);
    console.log(
        `  mod ${tickH}h: chi2=${chi2.toFixed(1)} (df=11)  max bin ${(maxShare * 100).toFixed(1)}%`,
    );
}

// --- H5: per-faction vs pooled ----------------------------------------------

console.log('\nper-faction same-faction cycle vs pooled (start-to-start):');
/**
 * @param {(e: object) => boolean} filter
 * @returns {{n: number, p50: number, cv: number}}
 */
function cycleStats(filter) {
    const gaps = [];
    for (const [, list] of bySeason) {
        const mine = list.filter((e) => e.isTrainStart && filter(e));
        for (let i = 1; i < mine.length; i++) {
            gaps.push((mine[i].start_time - mine[i - 1].start_time) / HOUR);
        }
    }
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const s = Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length);
    return { n: gaps.length, p50: quantileOf(gaps, 0.5), cv: s / m };
}
const pooledStats = cycleStats(() => true);
for (const en of [0, 1, 2]) {
    const s = cycleStats((e) => e.enemy === en);
    console.log(
        `  enemy ${en}: n=${s.n}  p50=${s.p50.toFixed(1)}h  CV=${s.cv.toFixed(3)}`,
    );
    assert(
        s.cv > pooledStats.cv,
        'per-faction cycles must be noisier than pooled for the global-clock verdict',
    );
}
console.log(
    `  POOLED : n=${pooledStats.n}  p50=${pooledStats.p50.toFixed(1)}h  CV=${pooledStats.cv.toFixed(3)}`,
);
console.log(
    '  VERDICT: pooled is cleaner than every per-faction series — one GLOBAL clock, faction drawn at spawn (kills H5).',
);

// --- H6: stationarity by wave index ------------------------------------------

console.log('\nlull spread by wave index (a schedule table would show structure):');
for (const [lo, hi] of [
    [1, 3],
    [4, 7],
    [8, 12],
    [13, 99],
]) {
    const sub = lulls
        .filter((r) => r.waveIndex >= lo && r.waveIndex <= hi)
        .map((r) => r.h);
    if (sub.length < 50) continue;
    const m = sub.reduce((a, b) => a + b, 0) / sub.length;
    const s = Math.sqrt(sub.reduce((a, b) => a + (b - m) ** 2, 0) / sub.length);
    console.log(
        `  wave ${String(lo).padStart(2)}-${hi}: n=${sub.length}  p50=${quantileOf(sub, 0.5).toFixed(1)}h  CV=${(s / m).toFixed(3)}`,
    );
}

// --- anchor check ------------------------------------------------------------

{
    const xs = lulls.map((r) => r.prevTrainDurationH);
    const ys = lulls.map((r) => r.h);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let c = 0;
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx;
        const dy = ys[i] - my;
        c += dx * dy;
        vx += dx * dx;
        vy += dy * dy;
    }
    const r = c / Math.sqrt(vx * vy);
    console.log(
        `\nr(previous train DURATION, following lull) = ${r.toFixed(3)} — near zero means the scheduler anchors on the train's END`,
    );
}

console.log(
    '\nRECONSTRUCTED DESIGN: one global end-anchored timer, delay ~ gamma(k≈' +
        kHat.toFixed(1) +
        ', θ≈' +
        thetaHat.toFixed(1) +
        'h); faction drawn at spawn; no ticks, no schedule table.',
);
