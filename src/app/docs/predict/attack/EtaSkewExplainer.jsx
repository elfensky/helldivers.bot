'use client';

import { useMemo, useRef, useState } from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ReferenceDot,
    ResponsiveContainer,
} from 'recharts';
import { useTrack } from '@/shared/hooks/useTrack.mjs';

/**
 * The worked example the surrounding prose uses: a forecast currently reading
 * 14 hours. The curve is eta = BASE / m — pure arithmetic, no data.
 */
const BASE_ETA_H = 14;
const M_MIN = 0.25;
const M_MAX = 2.5;
const M_STEP = 0.05;

/**
 * @param {number} m pace multiplier
 * @returns {number} arrival in hours at that pace
 */
function etaAt(m) {
    return BASE_ETA_H / m;
}

/**
 * @param {{ active?: boolean, payload?: Array<{ payload: { m: number, eta: number } }> }} props - Recharts-injected tooltip props.
 */
function SkewTooltip({ active, payload }) {
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
            <div style={{ marginBottom: 4 }}>×{row.m.toFixed(2)} pace</div>
            <div style={{ color: 'var(--color-primary)' }}>
                arrives in {row.eta.toFixed(1)}h
            </div>
        </div>
    );
}

/**
 * Interactive `eta = work / pace` curve for a forecast reading 14h. Dragging
 * the pace multiplier shows the skew the prose describes: speeding up can
 * never save more than the hours on the clock, slowing down has no such
 * limit — the same division that makes the forecast window lopsided.
 */
export default function EtaSkewExplainer() {
    const [m, setM] = useState(1);
    const track = useTrack();
    const hasTrackedRef = useRef(false);

    const trackFirstInteraction = () => {
        if (hasTrackedRef.current) return;
        hasTrackedRef.current = true;
        track('docs-eta-skew-explore');
    };

    const data = useMemo(() => {
        const rows = [];
        for (let x = M_MIN; x <= M_MAX + 1e-9; x += M_STEP) {
            rows.push({ m: Number(x.toFixed(2)), eta: etaAt(x) });
        }
        return rows;
    }, []);

    const eta = etaAt(m);
    const delta = eta - BASE_ETA_H;
    const readout =
        Math.abs(delta) < 0.05 ?
            `the forecast: ${BASE_ETA_H}h`
        :   `${eta.toFixed(1)}h — ${Math.abs(delta).toFixed(1)}h ${delta > 0 ? 'later' : 'sooner'} than forecast`;

    const setPace = (value) => {
        setM(value);
        trackFirstInteraction();
    };

    return (
        <div>
            <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                    data={data}
                    margin={{ top: 8, right: 16, bottom: 24, left: 8 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ghost)" />
                    <XAxis
                        dataKey="m"
                        type="number"
                        domain={[M_MIN, M_MAX]}
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                        tickFormatter={(v) => `×${v}`}
                        label={{
                            value: 'Pace vs now',
                            position: 'insideBottom',
                            offset: -12,
                            fill: 'var(--color-text-muted)',
                        }}
                    />
                    <YAxis
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                        tickFormatter={(v) => `${v}h`}
                        domain={[0, 60]}
                    />
                    <Tooltip content={<SkewTooltip />} />
                    <ReferenceLine
                        x={1}
                        stroke="var(--color-text-muted)"
                        strokeDasharray="4 4"
                    />
                    <ReferenceLine
                        y={BASE_ETA_H}
                        stroke="var(--color-text-muted)"
                        strokeDasharray="4 4"
                    />
                    <Line
                        type="monotone"
                        dataKey="eta"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />
                    <ReferenceDot
                        x={m}
                        y={eta}
                        r={5}
                        fill="var(--color-primary)"
                        stroke="var(--color-surface-0)"
                        strokeWidth={2}
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
                    htmlFor="eta-skew-slider"
                    style={{ display: 'block', marginBottom: 4 }}
                >
                    Pace ×{m.toFixed(2)} → {readout}
                </label>
                <input
                    id="eta-skew-slider"
                    type="range"
                    min={M_MIN}
                    max={M_MAX}
                    step={M_STEP}
                    value={m}
                    onChange={(e) => setPace(Number(e.target.value))}
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
                    className="border border-ghost bg-surface-2 px-2 py-1 font-mono text-small text-text hover:border-primary"
                    onClick={() => setPace(0.5)}
                >
                    half pace (+14h)
                </button>
                <button
                    type="button"
                    className="border border-ghost bg-surface-2 px-2 py-1 font-mono text-small text-text hover:border-primary"
                    onClick={() => setPace(1)}
                >
                    current pace
                </button>
                <button
                    type="button"
                    className="border border-ghost bg-surface-2 px-2 py-1 font-mono text-small text-text hover:border-primary"
                    onClick={() => setPace(2)}
                >
                    double pace (−7h)
                </button>
            </div>

            <p
                style={{
                    marginTop: '0.75rem',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-muted)',
                }}
            >
                Same-sized pace swings, lopsided time swings: halving the pace costs 14h,
                doubling it only saves 7h — and the further pace falls, the steeper the
                curve climbs.
            </p>
        </div>
    );
}
