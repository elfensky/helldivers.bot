'use client';
import {
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

// Lull length (hours since the previous train ended) stratified by the
// previous train's length, hardcoded — this is a static report, not a live
// view. Source: `node --env-file=.env.development scripts/analysis/04-train-baseline.mjs`,
// "Previous-train features vs. the following lull" section, the
// `prevTrainLength` stratification table.
const RAW = [
    { name: '1 defend', n: 671, p25: 23.0, p50: 34.7, p75: 47.0 },
    { name: '2 defends', n: 209, p25: 29.9, p50: 38.5, p75: 46.8 },
    { name: '3 defends', n: 222, p25: 29.3, p50: 37.7, p75: 45.2 },
    { name: '4 defends', n: 209, p25: 28.7, p50: 37.2, p75: 45.3 },
    { name: '5 defends', n: 102, p25: 28.5, p50: 33.6, p75: 43.0 },
    { name: '6+ defends', n: 115, p25: 30.7, p50: 38.4, p75: 43.2 },
];

const data = RAW.map((row) => ({
    ...row,
    base: row.p25,
    lower: row.p50 - row.p25,
    upper: row.p75 - row.p50,
}));

// Overall train-start lull median (36.8h, from 02-baseline.mjs's "Given NO
// chain, lull length" line, n=1816) — plotted as a reference line so the
// flatness across strata reads against a fixed anchor, not just against
// each other.
const OVERALL_MEDIAN = 36.8;

/**
 * @param {{ active?: boolean, payload?: Array<{ payload: (typeof data)[number] }> }} props - Recharts-injected tooltip props.
 */
function LullTooltip({ active, payload }) {
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
            <div style={{ marginBottom: 4 }}>Previous train: {row.name}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>
                lull p25 {row.p25.toFixed(1)}h · median {row.p50.toFixed(1)}h · p75{' '}
                {row.p75.toFixed(1)}h
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>n={row.n}</div>
        </div>
    );
}

/**
 * Lull length (end of previous train -> next train start), stratified by
 * how long the previous train ran. Every stratum's box sits in roughly the
 * same place — the dashed reference line marks the overall median (36.8h) —
 * which is the visual form of the null result: a longer previous train does
 * not predict a longer or shorter wait for the next one.
 */
export default function LullByTrainLengthChart() {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
                layout="vertical"
                data={data}
                margin={{ top: 8, right: 32, bottom: 24, left: 8 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ghost)" />
                <XAxis
                    type="number"
                    domain={[0, 60]}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `${v}h`}
                    label={{
                        value: 'Lull length (hours)',
                        position: 'insideBottom',
                        offset: -12,
                        fill: 'var(--color-text-muted)',
                    }}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={<LullTooltip />}
                />
                <ReferenceLine
                    x={OVERALL_MEDIAN}
                    stroke="var(--color-danger)"
                    strokeDasharray="4 4"
                    label={{
                        value: `overall median ${OVERALL_MEDIAN}h`,
                        position: 'top',
                        fill: 'var(--color-danger)',
                        fontSize: 11,
                    }}
                />
                <Bar
                    dataKey="base"
                    stackId="box"
                    fill="transparent"
                    isAnimationActive={false}
                />
                <Bar
                    dataKey="lower"
                    stackId="box"
                    fill="var(--color-text-muted)"
                    isAnimationActive={false}
                />
                <Bar
                    dataKey="upper"
                    stackId="box"
                    fill="var(--color-primary)"
                    isAnimationActive={false}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}
