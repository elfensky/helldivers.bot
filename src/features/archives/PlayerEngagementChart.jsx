'use client';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { buildEngagementSeries } from './buildEngagementSeries.mjs';

/**
 * Recharts-injected tooltip props.
 *
 * @param {{ active?: boolean, payload?: Array<{ payload?: {x:number, y:number, region:number, type:string} }> }} props - Tooltip props.
 */
function EngagementTooltip({ active, payload }) {
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
                Day {Math.round(d.x)}
            </div>
            <div>{formatNumber(d.y)} players</div>
            <div style={{ color: 'var(--color-text-muted)' }}>
                {d.type} · region {d.region}
            </div>
        </div>
    );
}

/**
 * Player Engagement — a scatter of player mobilization per event over the
 * course of one war. X is the day the event started; Y is `players_at_start`;
 * each faction is a colored series. Shows whether engagement grew, declined, or
 * surged for the final battles. Renders nothing when the season has no player
 * data (the caller hides the section in turn).
 *
 * @param {object} props - Component props.
 * @param {Array<object>} props.events - The season's events (with players_at_start).
 * @param {number|null|undefined} props.warStart - Unix-seconds anchor for day 0.
 */
export default function PlayerEngagementChart({ events, warStart }) {
    const series = buildEngagementSeries(events, warStart);
    if (series.length === 0) return null;

    return (
        <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 24, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ghost)" />
                <XAxis
                    type="number"
                    dataKey="x"
                    name="Day"
                    tickFormatter={(d) => `D${Math.round(d)}`}
                    tick={{ fill: 'var(--color-text-muted)' }}
                    label={{
                        value: 'Day into war',
                        position: 'insideBottom',
                        offset: -12,
                        fill: 'var(--color-text-muted)',
                    }}
                />
                <YAxis
                    type="number"
                    dataKey="y"
                    name="Players"
                    width={56}
                    tickFormatter={formatNumber}
                    tick={{ fill: 'var(--color-text-muted)' }}
                />
                <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={<EngagementTooltip />}
                />
                <Legend />
                {series.map((s) => (
                    <Scatter key={s.enemy} name={s.name} data={s.points} fill={s.color} />
                ))}
            </ScatterChart>
        </ResponsiveContainer>
    );
}
