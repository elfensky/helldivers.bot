'use client';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

/**
 * A small cross-season trend line for a single derived ratio (Friendly Fire,
 * Accuracy — see computeTelemetryStats). One point per telemetry-bearing
 * season; the X axis is the season number. Values arrive pre-computed as
 * percentages. The caller guards the empty state, so an absent/empty series
 * renders nothing.
 *
 * @param {object} props - Component props.
 * @param {Array<{season:number, value:number}>} props.data - Pre-computed {season, percentage} points.
 * @param {string} props.label - Tooltip series label.
 * @param {string} props.color - Line/dot color (faction hex, matches FactionHealthChart).
 * @param {number} [props.decimals] - Decimal places for the % formatter.
 */
export default function RatioTrendChart({ data, label, color, decimals = 1 }) {
    if (!data?.length) return null;
    const fmt = (v) => `${Number(v).toFixed(decimals)}%`;

    return (
        <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 8, right: 32, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ghost)" />
                <XAxis
                    dataKey="season"
                    tickFormatter={(s) => `S${s}`}
                    tick={{ fill: 'var(--color-text-muted)' }}
                />
                <YAxis
                    tickFormatter={fmt}
                    width={56}
                    tick={{ fill: 'var(--color-text-muted)' }}
                />
                <Tooltip
                    cursor={{ stroke: 'var(--color-ghost)' }}
                    contentStyle={{
                        backgroundColor: 'var(--color-surface-1)',
                        border: '1px solid var(--color-ghost)',
                    }}
                    labelFormatter={(s) => `Season ${s}`}
                    formatter={(value) => [fmt(value), label]}
                />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, r: 3 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
