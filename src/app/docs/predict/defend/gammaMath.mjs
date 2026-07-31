/**
 * gammaMath.mjs — pure gamma-distribution helpers for GammaExplorer.
 *
 * `lnGamma` (Lanczos approximation) and `gammaCdf` (regularized lower
 * incomplete gamma via series expansion) are the SAME implementations as
 * `scripts/analysis/13-scheduler-shape.mjs`, duplicated here rather than
 * imported — app code cannot import from `scripts/` (that tree runs
 * standalone against `.env.development`, outside the Next.js build). Keep
 * both in sync by hand if the math ever changes.
 */

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
 * Gamma probability density, parameterized by shape `k` and scale `theta`.
 * Zero for `x <= 0` (the support starts at 0).
 *
 * @param {number} x value (hours), where the density is evaluated
 * @param {number} k shape
 * @param {number} theta scale (hours)
 * @returns {number}
 */
export function gammaPdf(x, k, theta) {
    if (x <= 0) return 0;
    return Math.exp((k - 1) * Math.log(x) - x / theta - lnGamma(k) - k * Math.log(theta));
}

/**
 * Regularized lower incomplete gamma P(k, x/theta) — the gamma CDF.
 * Series expansion; adequate for the k/x ranges used here (k in [0.5, 50]).
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
 * Kolmogorov-Smirnov-style distance between a binned histogram's cumulative
 * shares (evaluated at each bin's right edge) and an arbitrary CDF. This is
 * the binned analogue of comparing an empirical CDF to a model CDF — since
 * we only have per-bin counts (not raw samples), the comparison can only be
 * made at bin-edge resolution.
 *
 * @param {number[]} bins histogram counts, one per fixed-width bin starting at 0
 * @param {number} binWidthH bin width in hours
 * @param {(x: number) => number} cdf model CDF to compare against
 * @returns {number} max absolute deviation across bin edges; 0 when `bins` is empty
 */
export function ksAgainstHistogramCdf(bins, binWidthH, cdf) {
    const n = bins.reduce((a, b) => a + b, 0);
    if (n <= 0) return 0;
    let cumulative = 0;
    let maxDist = 0;
    for (let i = 0; i < bins.length; i++) {
        cumulative += bins[i];
        const rightEdge = (i + 1) * binWidthH;
        const observedShare = cumulative / n;
        const modelShare = cdf(rightEdge);
        maxDist = Math.max(maxDist, Math.abs(observedShare - modelShare));
    }
    return maxDist;
}

/**
 * `ksAgainstHistogramCdf` specialized to a gamma(k, theta) CDF.
 *
 * @param {number[]} bins histogram counts, one per fixed-width bin starting at 0
 * @param {number} binWidthH bin width in hours
 * @param {number} k shape
 * @param {number} theta scale (hours)
 * @returns {number} max absolute deviation across bin edges
 */
export function ksAgainstHistogram(bins, binWidthH, k, theta) {
    return ksAgainstHistogramCdf(bins, binWidthH, (x) => gammaCdf(x, k, theta));
}
