'use client';

import { useMemo, useRef, useState } from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { useTrack } from '@/shared/hooks/useTrack.mjs';
import { gammaCdf, ksAgainstHistogram } from './gammaMath.mjs';

// Slider spans [0.5, 50] linearly. k=50 (the "fixed timer" preset) sits at
// the far end of the range rather than outside it — extending max to 50
// is simpler than clamp-free state + a log-scaled slider, and the shape
// difference between k=12 and k=50 is visually obvious either way at this
// bin width.
const K_MIN = 0.5;
const K_MAX = 50;
const K_STEP = 0.1;

/**
 * @param {{ active?: boolean, payload?: Array<{ payload: { rightEdge: number, share: number, gammaProb: number } }> }} props - Recharts-injected tooltip props.
 */
function GammaTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
        <div
            style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-ghost)',
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-text)',
            }}
        >
            <div style={{ marginBottom: 4 }}>{row.rightEdge}h</div>
            <div style={{ color: 'var(--color-text-muted)' }}>
                observed {(row.share * 100).toFixed(1)}%
            </div>
            <div style={{ color: 'var(--color-primary)' }}>
                gamma {(row.gammaProb * 100).toFixed(1)}%
            </div>
        </div>
    );
}

/**
 * Interactive lull-histogram + gamma-k fit overlay. Bars are the observed
 * bin shares (count/n); the line is the gamma(k, theta) model's probability
 * mass per bin, with theta LOCKED to `meanH / k` so the curve always
 * matches the observed mean — dragging k changes shape, never the mean.
 *
 * @param {{bins: number[], binWidthH: number, n: number, meanH: number, fittedK: number}} props - histogram + fit stats from `getDefendLiveStats()`.
 */
export default function GammaExplorer({ bins, binWidthH, n, meanH, fittedK }) {
    const [k, setK] = useState(fittedK);
    const track = useTrack();
    const hasTrackedRef = useRef(false);

    const trackFirstInteraction = () => {
        if (hasTrackedRef.current) return;
        hasTrackedRef.current = true;
        track('docs-gamma-explore');
    };

    const theta = meanH / k;

    const data = useMemo(() => {
        const rows = new Array(bins.length);
        let prevCdf = 0;
        for (let i = 0; i < bins.length; i++) {
            const rightEdge = (i + 1) * binWidthH;
            const cdf = gammaCdf(rightEdge, k, theta);
            rows[i] = {
                rightEdge,
                share: n > 0 ? bins[i] / n : 0,
                gammaProb: cdf - prevCdf,
            };
            prevCdf = cdf;
        }
        return rows;
    }, [bins, binWidthH, n, k, theta]);

    const ks = ksAgainstHistogram(bins, binWidthH, k, theta);

    return (
        <div>
            <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                    data={data}
                    margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ghost)" />
                    <XAxis
                        dataKey="rightEdge"
                        type="number"
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                        tickFormatter={(v) => `${v}h`}
                        label={{
                            value: 'Lull length (hours)',
                            position: 'insideBottom',
                            offset: -12,
                            fill: 'var(--color-text-muted)',
                        }}
                    />
                    <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
                    <Tooltip content={<GammaTooltip />} />
                    <Bar
                        dataKey="share"
                        fill="var(--color-surface-4)"
                        isAnimationActive={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="gammaProb"
                        stroke="var(--color-primary)"
                        dot={false}
                        isAnimationActive={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>

            <div
                style={{
                    marginTop: '0.75rem',
                    fontSize: '0.875rem',
                    color: 'var(--color-text)',
                }}
            >
                <label
                    htmlFor="gamma-k-slider"
                    style={{ display: 'block', marginBottom: 4 }}
                >
                    k = {k.toFixed(2)} (θ = {theta.toFixed(2)}h) — KS distance{' '}
                    {ks.toFixed(3)}
                </label>
                <input
                    id="gamma-k-slider"
                    type="range"
                    min={K_MIN}
                    max={K_MAX}
                    step={K_STEP}
                    value={k}
                    onChange={(e) => {
                        setK(Number(e.target.value));
                        trackFirstInteraction();
                    }}
                    style={{ width: '100%' }}
                />
            </div>

            <div
                style={{
                    marginTop: '0.5rem',
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                }}
            >
                <button
                    type="button"
                    onClick={() => {
                        setK(1);
                        trackFirstInteraction();
                    }}
                >
                    memoryless (k=1)
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setK(fittedK);
                        trackFirstInteraction();
                    }}
                >
                    best fit
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setK(K_MAX);
                        trackFirstInteraction();
                    }}
                >
                    fixed timer (k=50)
                </button>
            </div>

            <p
                style={{
                    marginTop: '0.75rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                }}
            >
                If the scheduler were a coin flip every tick, the curve would look like
                k=1 — drag the slider and watch it miss.
            </p>
        </div>
    );
}
