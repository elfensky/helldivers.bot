import {
    lnGamma,
    gammaPdf,
    gammaCdf,
    ksAgainstHistogram,
    ksAgainstHistogramCdf,
} from '@/app/docs/predict/defend/gammaMath.mjs';

describe('gammaPdf', () => {
    test('integrates to ~1 over a fine trapezoid grid (k=4.4, theta=9, 0-400h)', () => {
        const k = 4.4;
        const theta = 9;
        const steps = 40000;
        const hi = 400;
        const dx = hi / steps;
        let area = 0;
        let prev = gammaPdf(0, k, theta);
        for (let i = 1; i <= steps; i++) {
            const x = i * dx;
            const cur = gammaPdf(x, k, theta);
            area += ((prev + cur) / 2) * dx;
            prev = cur;
        }
        expect(area).toBeGreaterThan(0.99);
        expect(area).toBeLessThan(1.01);
    });

    test('is 0 for x <= 0', () => {
        expect(gammaPdf(0, 4.4, 9)).toBe(0);
        expect(gammaPdf(-5, 4.4, 9)).toBe(0);
    });
});

describe('gammaCdf', () => {
    test('k=1 reduces to the exponential CDF 1 - e^(-x/theta)', () => {
        const theta = 12;
        for (const x of [1, 10, 50]) {
            expect(gammaCdf(x, 1, theta)).toBeCloseTo(1 - Math.exp(-x / theta), 6);
        }
    });
});

describe('ksAgainstHistogram / ksAgainstHistogramCdf', () => {
    // Build a histogram directly FROM the gamma's own CDF (differencing at bin
    // edges, scaled by n) — a self-consistent fixture. Comparing it against
    // the SAME (k, theta) must score ~0; comparing it against an exponential
    // with the same mean must score decisively worse (>0.25), since a
    // shape-4.4 gamma looks nothing like memoryless decay.
    const k = 4.4;
    const theta = 9;
    const mean = k * theta;
    const binWidthH = 2;
    const numBins = 60; // 120h span, matches liveStats' HIST_MAX_H/HIST_BIN_WIDTH_H
    const n = 5000;

    function buildGammaHistogram() {
        const bins = new Array(numBins).fill(0);
        let prevCdf = 0;
        for (let i = 0; i < numBins; i++) {
            const rightEdge = (i + 1) * binWidthH;
            const cdf = gammaCdf(rightEdge, k, theta);
            bins[i] = (cdf - prevCdf) * n;
            prevCdf = cdf;
        }
        return bins;
    }

    test('self-consistent histogram scores ~0 against its own (k, theta)', () => {
        const bins = buildGammaHistogram();
        const ks = ksAgainstHistogram(bins, binWidthH, k, theta);
        expect(ks).toBeLessThan(0.01);
    });

    test('same histogram scores > 0.25 against an exponential with the same mean', () => {
        const bins = buildGammaHistogram();
        const expCdf = (x) => 1 - Math.exp(-x / mean);
        const ks = ksAgainstHistogramCdf(bins, binWidthH, expCdf);
        expect(ks).toBeGreaterThan(0.25);
    });
});

describe('finiteness across k in [0.5, 50]', () => {
    test('lnGamma, gammaPdf, gammaCdf stay finite', () => {
        const theta = 9;
        for (const k of [0.5, 1, 2, 4.4, 10, 25, 50]) {
            expect(Number.isFinite(lnGamma(k))).toBe(true);
            for (const x of [0.001, 1, 10, 50, 100, 400]) {
                expect(Number.isFinite(gammaPdf(x, k, theta))).toBe(true);
                expect(Number.isFinite(gammaCdf(x, k, theta))).toBe(true);
            }
        }
    });
});
