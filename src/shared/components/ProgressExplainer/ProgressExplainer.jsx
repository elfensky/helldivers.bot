'use client';

import { useState, useMemo } from 'react';
import {
    ComposedChart,
    Area,
    Line,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import './ProgressExplainer.css';

const COLORS = {
    expected: 'var(--color-text-muted)',
    buffer: 'rgba(255, 224, 0, 0.2)',
    bufferStroke: 'rgba(255, 224, 0, 0.35)',
    ahead: 'var(--color-success)',
    on_track: 'var(--color-text)',
    behind: 'var(--color-danger)',
};

const STATUS_COLORS = {
    ahead: 'var(--color-success)',
    on_track: 'var(--color-text)',
    behind: 'var(--color-danger)',
};

function fmt(n) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function evaluate(pointsMax, elapsedPct, actual) {
    const expectedPts = (elapsedPct / 100) * pointsMax;
    const buffer = expectedPts * 0.1;

    let status;
    if (actual > expectedPts + buffer) status = 'ahead';
    else if (actual < expectedPts) status = 'behind';
    else status = 'on_track';

    const delta = Math.abs(Math.round(expectedPts - actual));
    const deltaPct =
        expectedPts > 0 ? Math.round(((actual - expectedPts) / expectedPts) * 100) : 0;

    return { status, expectedPts, delta, deltaPct };
}

function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
        <div className="progress-result" style={{ fontSize: '0.75rem' }}>
            <div>
                <strong>{d.pct}%</strong> elapsed
            </div>
            <div>Expected: {fmt(Math.round(d.expected))} pts</div>
            <div>Buffer ceiling: {fmt(Math.round(d.bufferCeiling))} pts</div>
        </div>
    );
}

export default function ProgressExplainer() {
    const [duration, setDuration] = useState(24);
    const [pointsMax, setPointsMax] = useState(50000);
    const [elapsedPct, setElapsedPct] = useState(50);
    const [actual, setActual] = useState(25000);

    const clampedActual = Math.min(actual, pointsMax);

    const { status, expectedPts, delta, deltaPct } = useMemo(
        () => evaluate(pointsMax, elapsedPct, clampedActual),
        [pointsMax, elapsedPct, clampedActual],
    );

    const chartData = useMemo(() => {
        const points = [];
        for (let pct = 0; pct <= 100; pct += 2) {
            const expected = (pct / 100) * pointsMax;
            points.push({
                pct,
                expected,
                bufferCeiling: expected * 1.1,
            });
        }
        return points;
    }, [pointsMax]);

    const dotData = useMemo(
        () => [{ pct: elapsedPct, actual: clampedActual }],
        [elapsedPct, clampedActual],
    );

    const totalTimeSec = duration * 3600;
    const elapsedSec = totalTimeSec * (elapsedPct / 100);
    const remainingSec = totalTimeSec - elapsedSec;
    const currentRate = elapsedSec > 0 ? clampedActual / elapsedSec : 0;
    const remainingPts = pointsMax - clampedActual;
    const requiredRate = remainingSec > 0 ? remainingPts / remainingSec : Infinity;

    const dotColor = STATUS_COLORS[status];
    const sign =
        status === 'on_track' ? '±'
        : status === 'ahead' ? '+'
        : '−';

    return (
        <div className="progress-explainer">
            <div className="progress-chart">
                <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 10, right: 10, bottom: 5, left: 10 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--color-surface-3)"
                        />
                        <XAxis
                            dataKey="pct"
                            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                            tickFormatter={(v) => (v % 20 === 0 ? `${v}%` : '')}
                            stroke="var(--color-surface-4)"
                            label={{
                                value: 'Time elapsed',
                                position: 'insideBottom',
                                offset: -2,
                                fill: 'var(--color-text-muted)',
                                fontSize: 11,
                            }}
                        />
                        <YAxis
                            domain={[0, pointsMax]}
                            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                            tickFormatter={(v) =>
                                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                            }
                            stroke="var(--color-surface-4)"
                            label={{
                                value: 'Points',
                                angle: -90,
                                position: 'insideLeft',
                                offset: 4,
                                fill: 'var(--color-text-muted)',
                                fontSize: 11,
                            }}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Buffer zone fill between expected and buffer ceiling */}
                        <Area
                            dataKey="bufferCeiling"
                            stroke={COLORS.bufferStroke}
                            strokeWidth={1}
                            strokeDasharray="4 4"
                            fill={COLORS.buffer}
                            fillOpacity={1}
                            baseLine={chartData.map((d) => d.expected)}
                            isAnimationActive={false}
                        />
                        <Area
                            dataKey="expected"
                            stroke="none"
                            fill="var(--color-surface-1)"
                            fillOpacity={1}
                            isAnimationActive={false}
                        />

                        {/* Expected line */}
                        <Line
                            dataKey="expected"
                            stroke={COLORS.expected}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />

                        {/* Vertical reference at elapsed position */}
                        <ReferenceLine
                            x={elapsedPct}
                            stroke="var(--color-surface-4)"
                            strokeDasharray="3 3"
                        />

                        {/* Actual point */}
                        <Scatter
                            data={dotData}
                            dataKey="actual"
                            fill={dotColor}
                            isAnimationActive={false}
                        ></Scatter>
                    </ComposedChart>
                </ResponsiveContainer>

                <div className="progress-legend">
                    <span className="progress-legend-item">
                        <span
                            className="progress-legend-swatch"
                            style={{ background: COLORS.expected }}
                        />
                        Expected (linear)
                    </span>
                    <span className="progress-legend-item">
                        <span
                            className="progress-legend-swatch"
                            style={{
                                background: COLORS.buffer,
                                border: `1px dashed ${COLORS.bufferStroke}`,
                                height: '10px',
                            }}
                        />
                        On-track buffer (0–10%)
                    </span>
                    <span className="progress-legend-item">
                        <span
                            className="progress-legend-dot"
                            style={{ background: dotColor }}
                        />
                        Actual ({status.replace('_', ' ')})
                    </span>
                </div>
            </div>

            <div className="progress-controls">
                <div className="progress-control">
                    <label>Total Duration (hours)</label>
                    <input
                        type="range"
                        min={1}
                        max={72}
                        value={duration}
                        onChange={(e) => setDuration(+e.target.value)}
                    />
                    <span className="progress-control-val">{duration}h</span>
                </div>
                <div className="progress-control">
                    <label>Points Max (target)</label>
                    <input
                        type="range"
                        min={1000}
                        max={100000}
                        step={1000}
                        value={pointsMax}
                        onChange={(e) => setPointsMax(+e.target.value)}
                    />
                    <span className="progress-control-val">{fmt(pointsMax)}</span>
                </div>
                <div className="progress-control">
                    <label>Time Elapsed (%)</label>
                    <input
                        type="range"
                        min={1}
                        max={99}
                        value={elapsedPct}
                        onChange={(e) => setElapsedPct(+e.target.value)}
                    />
                    <span className="progress-control-val">{elapsedPct}%</span>
                </div>
                <div className="progress-control">
                    <label>Actual Points</label>
                    <input
                        type="range"
                        min={0}
                        max={pointsMax}
                        step={500}
                        value={clampedActual}
                        onChange={(e) => setActual(+e.target.value)}
                    />
                    <span className="progress-control-val">{fmt(clampedActual)}</span>
                </div>

                <div className="progress-result">
                    <div style={{ marginBottom: '0.5rem' }}>
                        Status:{' '}
                        <span className={`progress-badge progress-badge--${status}`}>
                            {status.replace('_', ' ')}
                        </span>
                    </div>
                    <dl className="progress-result-grid">
                        <dt>Expected pts</dt>
                        <dd>{fmt(Math.round(expectedPts))}</dd>
                        <dt>Actual pts</dt>
                        <dd>{fmt(clampedActual)}</dd>
                        <dt>Delta</dt>
                        <dd style={{ color: dotColor }}>
                            {sign}
                            {fmt(delta)}
                        </dd>
                        <dt>Delta %</dt>
                        <dd style={{ color: dotColor }}>
                            {deltaPct >= 0 ? '+' : ''}
                            {deltaPct}%
                        </dd>
                        <dt>Current rate</dt>
                        <dd>{fmt(currentRate)} pts/s</dd>
                        <dt>Required rate</dt>
                        <dd>
                            {requiredRate === Infinity ?
                                '∞'
                            :   `${fmt(requiredRate)} pts/s`}
                        </dd>
                    </dl>
                </div>

                <div className="progress-formula">
                    <strong>expectedRate</strong> = points_max / totalTime
                    <br />
                    <strong>expectedPts</strong> = expectedRate × elapsed
                    <br />
                    <strong>buffer</strong> = expectedPts × 0.10
                    <br />
                    <br />
                    if actual &gt; expected + buffer →{' '}
                    <strong style={{ color: STATUS_COLORS.ahead }}>ahead</strong>
                    <br />
                    if actual &lt; expected →{' '}
                    <strong style={{ color: STATUS_COLORS.behind }}>behind</strong>
                    <br />
                    else →{' '}
                    <strong style={{ color: STATUS_COLORS.on_track }}>on_track</strong>
                </div>
            </div>
        </div>
    );
}
