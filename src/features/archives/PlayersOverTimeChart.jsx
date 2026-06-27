'use client';
import {
    ComposedChart,
    Line,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { FACTION_SLUG_BY_ID } from '@/shared/enums/factions.mjs';
import { buildPlayerLine } from './buildPlayerLine.mjs';

// One line at a time, colored by the active faction toggle. `global` uses the
// brand primary; a faction uses its own --color-faction-* token. Mirrors
// FactionHealthChart's palette so /archives reads as one visual language.
const LINE_COLOR = {
    global: 'var(--color-primary)',
    bugs: 'var(--color-faction-bugs)',
    cyborgs: 'var(--color-faction-cyborgs)',
    illuminate: 'var(--color-faction-illuminate)',
};

// Event-dot color by faction id, matching the line palette.
const DOT_COLOR = [
    'var(--color-faction-bugs)',
    'var(--color-faction-cyborgs)',
    'var(--color-faction-illuminate)',
];

// Human-readable event outcome for the tooltip.
const OUTCOME_LABEL = {
    active: 'ongoing',
    success: 'won',
    fail: 'lost',
};

/**
 * Tooltip for an event dot: type · region · faction · outcome. Recharts injects
 * `active`/`payload` via cloneElement, so both are optional at the call site.
 *
 * @param {{ active?: boolean, payload?: Array<{ payload?: {x:number, y:number, enemy:number, type:string, region:number, status:string} }> }} props - Recharts-injected tooltip props.
 */
function DotTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    // The dots Scatter is the only series with a tooltip target; find its entry.
    const d = payload.find((p) => p?.payload?.enemy != null)?.payload;
    if (!d) return null;

    const faction = FACTION_SLUG_BY_ID[d.enemy] ?? 'unknown';
    const outcome = OUTCOME_LABEL[d.status] ?? d.status;

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
                Day {Math.round(d.x)} · {formatNumber(d.y)} players
            </div>
            <div style={{ textTransform: 'capitalize' }}>
                {d.type} · region {d.region}
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>
                {faction} · {outcome}
            </div>
        </div>
    );
}

/**
 * Custom dot for the event Scatter — a faction-colored ring so events stand out
 * against the line. Recharts passes the datum on `payload`.
 *
 * @param {{ cx?: number, cy?: number, payload?: {enemy:number} }} props - Recharts scatter-shape props.
 */
function EventDotShape({ cx, cy, payload }) {
    if (cx == null || cy == null || !payload) return null;
    return (
        <circle
            cx={cx}
            cy={cy}
            r={4}
            fill={DOT_COLOR[payload.enemy] ?? 'var(--color-text)'}
            stroke="var(--color-surface-0)"
            strokeWidth={1.5}
        />
    );
}

/**
 * Players over time — one player-count line per the active faction toggle, with
 * event dots overlaid at each event's start day. `global` shows the total line
 * and every event; a faction shows that faction's line and only its events.
 * Renders nothing when the season has no player timeseries (historical seasons
 * predating telemetry), so the caller's section hides in turn.
 *
 * @param {object} props - Component props.
 * @param {Array<object>} props.playerTimeseries - Per-bucket player counts from getCampaign.
 * @param {Array<object>} props.events - The season's events.
 * @param {string} props.faction - 'global' | 'bugs' | 'cyborgs' | 'illuminate'.
 * @param {number} [props.warStart] - Unix-seconds anchor for day 1 (continuous x-axis).
 */
export default function PlayersOverTimeChart({
    playerTimeseries,
    events,
    faction,
    warStart,
}) {
    const { points, dots } = buildPlayerLine(playerTimeseries, events, faction, warStart);
    if (points.length === 0) return null;

    const stroke = LINE_COLOR[faction] ?? 'var(--color-primary)';

    return (
        <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
                data={points}
                margin={{ top: 10, right: 10, bottom: 24, left: 0 }}
            >
                <CartesianGrid stroke="var(--color-surface-3)" strokeDasharray="3 3" />
                <XAxis
                    type="number"
                    dataKey="x"
                    stroke="var(--color-surface-4)"
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickFormatter={(v) => `D${Math.round(v)}`}
                    domain={['dataMin', 'dataMax']}
                    label={{
                        value: 'Day into war',
                        position: 'insideBottom',
                        offset: -12,
                        fill: 'var(--color-text-muted)',
                    }}
                />
                <YAxis
                    stroke="var(--color-surface-4)"
                    width={56}
                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                    tickFormatter={formatNumber}
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<DotTooltip />} />
                <Line
                    type="linear"
                    dataKey="y"
                    stroke={stroke}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                />
                <Scatter
                    data={dots}
                    dataKey="y"
                    shape={<EventDotShape />}
                    isAnimationActive={false}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}
