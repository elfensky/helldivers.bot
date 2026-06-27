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
 * Tooltip driven by the LINE — the hovered day + player count — with event
 * details added when an event sits on that day. Reading the line's data point
 * (not a scatter dot) is what makes the tooltip track the cursor instead of
 * sticking on one event: the Line and the dots Scatter have different data
 * arrays, so a dot-based payload doesn't follow the mouse. Recharts injects
 * `active`/`label`/`payload`; `dots` is preserved through cloneElement.
 *
 * @param {{ active?: boolean, label?: number, payload?: Array<{ value?: number, payload?: {x:number, y:number, enemy?:number} }>, dots?: Array<{x:number, enemy:number, type:string, region:number, status:string}> }} props - Recharts-injected props plus `dots`.
 */
function PlayerTooltip({ active, label, payload, dots }) {
    if (!active || !payload?.length) return null;
    // The line's data point carries no `enemy`; its y is the player count here.
    const lineEntry = payload.find((p) => p?.payload && p.payload.enemy == null);
    const players = lineEntry?.value ?? lineEntry?.payload?.y;
    if (players == null) return null;

    const day = Math.round(label ?? lineEntry?.payload?.x ?? 0);
    const dot = dots?.find((d) => Math.round(d.x) === day);

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
            <div style={{ color: 'var(--color-text-muted)', marginBottom: dot ? 4 : 0 }}>
                Day {day} · {formatNumber(players)} players
            </div>
            {dot && (
                <>
                    <div style={{ textTransform: 'capitalize' }}>
                        {dot.type} · region {dot.region}
                    </div>
                    <div style={{ color: 'var(--color-text-muted)' }}>
                        {FACTION_SLUG_BY_ID[dot.enemy] ?? 'unknown'} ·{' '}
                        {OUTCOME_LABEL[dot.status] ?? dot.status}
                    </div>
                </>
            )}
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
 * @param {number} [props.warStart] - Unix-seconds anchor for day 0 (continuous x-axis).
 * @param {number} [props.domainMax] - Shared last-day so the x-scale matches Conquest Progress.
 */
export default function PlayersOverTimeChart({
    playerTimeseries,
    events,
    faction,
    warStart,
    domainMax,
}) {
    const { points, dots } = buildPlayerLine(playerTimeseries, events, faction, warStart);
    if (points.length === 0) return null;

    const stroke = LINE_COLOR[faction] ?? 'var(--color-primary)';

    // All-day ticks (D0, D1, …, D<last>) so the x-axis lines up tick-for-tick
    // with Conquest Progress (FactionHealthChart) for side-by-side comparison.
    const lastDay = Math.round(points.reduce((m, p) => Math.max(m, p.x), 0));
    const dayTicks = Array.from({ length: lastDay + 1 }, (_, i) => i);

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
                    domain={[0, domainMax ?? lastDay]}
                    ticks={dayTicks}
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
                <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={<PlayerTooltip dots={dots} />}
                />
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
