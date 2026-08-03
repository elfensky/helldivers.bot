'use client';
import {
    ComposedChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceArea,
} from 'recharts';

// Verdict accuracy (margin 0) by elapsed decile, warm-up included — static
// report, not a live view. Source: `node --env-file=.env.development
// scripts/analysis/14-event-verdict-margin.mjs`, "accuracy by elapsed
// decile" table, run 2026-08-03 (130 events / 3,006 no-skip moments, S157+).
const RAW = [
    { x: 5, accuracy: 71.8, n: 337 },
    { x: 15, accuracy: 72.4, n: 326 },
    { x: 25, accuracy: 84.3, n: 325 },
    { x: 35, accuracy: 86.2, n: 325 },
    { x: 45, accuracy: 85.4, n: 343 },
    { x: 55, accuracy: 86.6, n: 322 },
    { x: 65, accuracy: 96.2, n: 287 },
    { x: 75, accuracy: 97.8, n: 278 },
    { x: 85, accuracy: 98.0, n: 249 },
    { x: 95, accuracy: 98.6, n: 214 },
];

// The shipped render gate: cards stay silent below this elapsed share
// (MIN_ELAPSED_FRACTION in src/features/dashboard/eventForecast.mjs).
const GATE_PERCENT = 25;

/**
 * @param {{ active?: boolean, payload?: Array<{ payload: (typeof RAW)[number] }> }} props - Recharts-injected tooltip props.
 */
function AccuracyTooltip({ active, payload }) {
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
            <div style={{ marginBottom: 4 }}>
                {row.x - 5}–{row.x + 5}% elapsed
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>
                verdict correct {row.accuracy.toFixed(1)}% · n={row.n}
            </div>
        </div>
    );
}

/**
 * How often the outcome verdict called the final result correctly, by how
 * far into the event it was asked. The shaded band is the shipped 25%
 * render gate: in there the since-start rate is still dominated by the
 * opening minutes, and the cards say nothing instead of guessing.
 */
export default function VerdictAccuracyChart() {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={RAW} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ghost)" />
                <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    label={{
                        value: 'Event time elapsed',
                        position: 'insideBottom',
                        offset: -12,
                        fill: 'var(--color-text-muted)',
                    }}
                />
                <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    width={44}
                />
                <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={<AccuracyTooltip />}
                />
                <ReferenceArea
                    x1={0}
                    x2={GATE_PERCENT}
                    fill="var(--color-text-muted)"
                    fillOpacity={0.12}
                    label={{
                        value: 'hidden on cards',
                        position: 'insideTopLeft',
                        fill: 'var(--color-text-muted)',
                        fontSize: 11,
                    }}
                />
                <ReferenceLine
                    x={GATE_PERCENT}
                    stroke="var(--color-text-muted)"
                    strokeDasharray="4 4"
                />
                <Bar dataKey="accuracy" isAnimationActive={false} barSize={18}>
                    {RAW.map((row) => (
                        <Cell
                            key={row.x}
                            fill={
                                row.x < GATE_PERCENT ?
                                    'var(--color-text-muted)'
                                :   'var(--color-primary)'
                            }
                        />
                    ))}
                </Bar>
            </ComposedChart>
        </ResponsiveContainer>
    );
}
