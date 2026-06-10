'use client';
import {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LabelList,
} from 'recharts';

// Faction colors mirror the existing FactionHealthChart palette so the
// /stats page reads as part of the same visual language as the live
// dashboard's per-faction views.
const FACTIONS = [
    { enemy: 0, name: 'Bugs', color: '#e8822a' },
    { enemy: 1, name: 'Cyborgs', color: '#8b2d2d' },
    { enemy: 2, name: 'Illuminate', color: '#7ec8e3' },
];

/**
 * Compute the overall HD win rate per faction across every war and sort
 * ascending — most-threatening (lowest HD win rate) at the top of the
 * ranking. Always returns three rows, zero-filled if a faction is absent
 * from `factionTotals`.
 */
export function computeThreatData(factionTotals) {
    const byEnemy = new Map((factionTotals ?? []).map((t) => [t.enemy, t]));
    const rows = FACTIONS.map(({ enemy, name, color }) => {
        const t = byEnemy.get(enemy);
        const events = (t?.defends ?? 0) + (t?.attacks ?? 0);
        const wins = (t?.defend_wins ?? 0) + (t?.attack_wins ?? 0);
        const winRate = events > 0 ? Math.round((wins / events) * 100) : 0;
        return { enemy, name, color, winRate, events, wins };
    });
    return rows.sort((a, b) => a.winRate - b.winRate);
}

/**
 * Faction Threat Ranking — one horizontal bar per faction, length =
 * Helldivers' overall win rate against that faction across all wars. Bars
 * are sorted ascending so the most-threatening faction is on top; each bar
 * is painted in the faction's signature color.
 */
export default function FactionThreatRanking({ factionTotals }) {
    if (!factionTotals) return null;
    const data = computeThreatData(factionTotals);

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 8, right: 32, bottom: 8, left: 24 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-ghost)" />
                <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fill: 'var(--color-text-muted)' }}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: 'var(--color-text-muted)' }}
                />
                <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{
                        backgroundColor: 'var(--color-surface-1)',
                        border: '1px solid var(--color-ghost)',
                    }}
                    formatter={(value) => [`${value}%`, 'HD win rate']}
                />
                <Bar dataKey="winRate">
                    {data.map((entry) => (
                        <Cell key={entry.enemy} fill={entry.color} />
                    ))}
                    <LabelList
                        dataKey="winRate"
                        position="right"
                        formatter={(v) => `${v}%`}
                        fill="var(--color-text)"
                    />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
