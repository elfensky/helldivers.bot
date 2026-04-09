'use client';
import {
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

const FACTIONS = [
    { key: 'bugs', label: 'Bugs', stroke: '#e8822a', fill: 'rgba(232, 130, 42, 0.2)' },
    { key: 'cyborgs', label: 'Cyborgs', stroke: '#8b2d2d', fill: 'rgba(139, 45, 45, 0.2)' },
    { key: 'illuminate', label: 'Illuminate', stroke: '#7ec8e3', fill: 'rgba(126, 200, 227, 0.2)' },
];

function buildChartData(snapshots, pointsMax) {
    if (!snapshots?.length || !pointsMax?.points) return [];

    const maxPoints = pointsMax.points;
    const firstTime = snapshots[0].time;

    return snapshots.map((snap) => {
        const parsed =
            typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data;
        if (!parsed) return null;

        const entry = {
            day: Math.round((snap.time - firstTime) / 86400),
            time: snap.time,
        };

        for (let i = 0; i < 3; i++) {
            const faction = parsed[i];
            if (!faction || faction.status === 'hidden') {
                entry[FACTIONS[i].key] = null;
            } else {
                const pct = maxPoints[i] > 0 ? (faction.points / maxPoints[i]) * 100 : 0;
                entry[FACTIONS[i].key] = Math.round(pct * 10) / 10;
            }
        }

        return entry;
    }).filter(Boolean);
}

function ChartTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
        <div
            style={{
                background: 'var(--color-surface-1)',
                border: '1px solid var(--color-surface-3)',
                padding: '0.5rem 0.75rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
            }}
        >
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>
                Day {d.day}
            </div>
            {FACTIONS.map(
                (f) =>
                    d[f.key] != null && (
                        <div
                            key={f.key}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 16,
                                color: f.stroke,
                            }}
                        >
                            <span>{f.label}</span>
                            <span>{d[f.key]}%</span>
                        </div>
                    ),
            )}
        </div>
    );
}

export default function FactionHealthChart({ snapshots, pointsMax }) {
    const data = buildChartData(snapshots, pointsMax);
    if (!data.length) return null;

    return (
        <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
                data={data}
                margin={{ top: 10, right: 10, bottom: 5, left: 0 }}
            >
                <CartesianGrid
                    stroke="var(--color-surface-3)"
                    strokeDasharray="3 3"
                />
                <XAxis
                    dataKey="day"
                    stroke="var(--color-surface-4)"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `D${v}`}
                />
                <YAxis
                    stroke="var(--color-surface-4)"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                />
                <Tooltip content={<ChartTooltip />} />
                {FACTIONS.map((f) => (
                    <Area
                        key={`area-${f.key}`}
                        type="monotone"
                        dataKey={f.key}
                        fill={f.fill}
                        stroke="none"
                        fillOpacity={1}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
                {FACTIONS.map((f) => (
                    <Line
                        key={`line-${f.key}`}
                        type="monotone"
                        dataKey={f.key}
                        stroke={f.stroke}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                    />
                ))}
            </ComposedChart>
        </ResponsiveContainer>
    );
}
