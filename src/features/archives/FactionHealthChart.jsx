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
import { CAMPAIGN_STATUS } from '@/shared/enums/events.mjs';
import { dayFraction, resolveWarStart } from '@/shared/utils/game/warClock.mjs';

const FACTIONS = [
    { key: 'bugs', label: 'Bugs', stroke: '#e8822a', fill: 'rgba(232, 130, 42, 0.2)' },
    {
        key: 'cyborgs',
        label: 'Cyborgs',
        stroke: '#8b2d2d',
        fill: 'rgba(139, 45, 45, 0.2)',
    },
    {
        key: 'illuminate',
        label: 'Illuminate',
        stroke: '#7ec8e3',
        fill: 'rgba(126, 200, 227, 0.2)',
    },
];

function buildChartData(snapshots, pointsMax, warStart) {
    if (!snapshots?.length || !pointsMax?.points) return [];

    const maxPoints = pointsMax.points;
    // Continuous, 0-based days since war start (falls back to the earliest
    // snapshot). Fractional — not rounded — so intra-day snapshots stay distinct
    // and the x-axis is time-proportional, matching PlayersOverTimeChart so the
    // two charts can be read against each other day-for-day.
    const anchor = resolveWarStart(
        warStart,
        snapshots.map((s) => s.time),
    );

    return snapshots
        .map((snap) => {
            const parsed = snap.data;
            if (!parsed) return null;

            const entry = {
                day: dayFraction(snap.time, anchor),
                time: snap.time,
            };

            for (let i = 0; i < 3; i++) {
                const faction = parsed[i];
                if (!faction || faction.status === CAMPAIGN_STATUS.HIDDEN) {
                    entry[FACTIONS[i].key] = null;
                } else if (faction.status === CAMPAIGN_STATUS.DEFEATED) {
                    // Homeworld captured — full conquest
                    entry[FACTIONS[i].key] = 100;
                } else {
                    // Sector progress scaled to 10/11 of chart (sectors 1-10).
                    // The last 1/11 (90.9% → 100%) represents the homeworld attack.
                    // A faction at max sector points shows ~91% — "at the gates".
                    const sectorPct =
                        maxPoints[i] > 0 ? faction.points / maxPoints[i] : 0;
                    entry[FACTIONS[i].key] =
                        Math.round(sectorPct * (10 / 11) * 1000) / 10;
                }
            }

            return entry;
        })
        .filter(Boolean);
}

/**
 * Recharts injects `active` and `payload` via cloneElement when the tooltip
 * renders, so both are optional at the JSX call site.
 *
 * @param {{ active?: boolean, payload?: Array<{ payload?: {[key: string]: number | null} }> }} props - Recharts-injected tooltip props.
 */
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
                Day {Math.round(d.day ?? 0)}
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

export default function FactionHealthChart({
    snapshots,
    pointsMax,
    warStart,
    domainMax,
}) {
    const data = buildChartData(snapshots, pointsMax, warStart);
    if (!data.length) return null;

    // All-day ticks (D0…D<last>) on a time-proportional axis so this chart lines
    // up day-for-day with PlayersOverTimeChart for side-by-side comparison.
    const lastDay = Math.round(data.reduce((m, d) => Math.max(m, d.day ?? 0), 0));
    const dayTicks = Array.from({ length: lastDay + 1 }, (_, i) => i);

    return (
        <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
                data={data}
                margin={{ top: 10, right: 10, bottom: 5, left: 0 }}
            >
                <CartesianGrid stroke="var(--color-surface-3)" strokeDasharray="3 3" />
                <XAxis
                    type="number"
                    dataKey="day"
                    stroke="var(--color-surface-4)"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `D${Math.round(v)}`}
                    domain={[0, domainMax ?? lastDay]}
                    ticks={dayTicks}
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
