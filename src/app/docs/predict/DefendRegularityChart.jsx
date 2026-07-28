'use client';
import {
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// Quartiles (hours), hardcoded — this is a static report, not a live view.
//
// "Pooled defend gaps" = hoursSincePrevEventEnd measured AT ALL DEFENDS,
// n=4639, from `node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs`
// (Phase 1, "EVENT TYPE: DEFEND" section): p25=0.016 p50=0.017 p75=36.117.
//
// "Train-start gaps" = the train-start-to-train-start gap marginal, n=1817,
// from `node --env-file=.env.development scripts/analysis/04-train-baseline.mjs`
// ("Phase 4: train-start baseline — pure self-checks OK" section):
// p25=33.6 p50=44.1 p75=56.0.
//
// Each row is stacked as base (=p25, invisible) + lower (p50-p25) + upper
// (p75-p50), so the bar spans the full interquartile range and the color
// seam between the two visible segments marks the median.
const RAW = [
    { name: 'Pooled defend gaps', n: 4639, p25: 0.016, p50: 0.017, p75: 36.117 },
    { name: 'Train-start gaps', n: 1817, p25: 33.6, p50: 44.1, p75: 56.0 },
];

const data = RAW.map((row) => ({
    ...row,
    base: row.p25,
    lower: row.p50 - row.p25,
    upper: row.p75 - row.p50,
}));

/**
 * @param {{ active?: boolean, payload?: Array<{ payload: (typeof data)[number] }> }} props - Recharts-injected tooltip props.
 */
function RegularityTooltip({ active, payload }) {
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
            <div style={{ marginBottom: 4 }}>{row.name}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>
                p25 {row.p25.toFixed(1)}h · median {row.p50.toFixed(1)}h · p75{' '}
                {row.p75.toFixed(1)}h
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>n={row.n}</div>
        </div>
    );
}

/**
 * Regularity contrast — pooled defend-to-defend gaps versus defend
 * train-start-to-train-start gaps, each shown as an interquartile box
 * (p25-p75) split at the median. The pooled series' box starts at ~0h
 * (dominated by ~2.5h mechanical chain gaps between failed-defend
 * follow-ups) with a long tail past p75; the train-start series clusters
 * tightly around a ~44h cycle. Source: see the two script references above
 * each data row.
 */
export default function DefendRegularityChart() {
    return (
        <ResponsiveContainer width="100%" height={180}>
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
                        value: 'Hours between events',
                        position: 'insideBottom',
                        offset: -12,
                        fill: 'var(--color-text-muted)',
                    }}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={<RegularityTooltip />}
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
