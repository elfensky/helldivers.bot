import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';
import './StatGrid.css';

const factionMap = { bugs: 0, cyborgs: 1, illuminate: 2 };

/**
 * Format an accidental-death rate: accidentals / deaths as a percentage.
 * Returns '—' if deaths is zero (can't divide) — covers cold-start and edge cases.
 */
function formatAccidentalRate(accidentals, deaths) {
    const a = Number(accidentals || 0);
    const d = Number(deaths || 0);
    if (d <= 0) return '—';
    return `${((a / d) * 100).toFixed(1)}%`;
}

function accidentalRateTooltip(accidentals, deaths) {
    const a = Number(accidentals || 0);
    const d = Number(deaths || 0);
    return `${formatNumber(a)} accidental / ${formatNumber(d)} total deaths`;
}

/**
 * Format the "LAST 24H" delta subtitle for the ONLINE card. Compares
 * the current player count to the 24h rolling average baseline.
 * Three states: ▲ (growth, success) / ▼ (decline, danger) / ▪ (flat,
 * ghost). Returns null only when there's no baseline yet (new season).
 * Whole line is uppercase and ghost-coloured; only the arrow carries
 * a tinted override, and only when non-zero.
 */
function playersDeltaSubtitle(currentPlayers, avgPlayers) {
    if (avgPlayers == null) return null;
    const delta = currentPlayers - avgPlayers;
    const indicator =
        delta > 0 ? '▲'
        : delta < 0 ? '▼'
        : '▪';
    const colorClass =
        delta > 0 ? 'text-success'
        : delta < 0 ? 'text-danger'
        : '';
    // The ▲/▼ triangle glyphs sit below their optical centre — lift them.
    // ▪ is already centred in its em box, so no nudge.
    const nudgeClass = delta !== 0 ? '-translate-y-[1.5px]' : '';
    return (
        <span className="inline-flex items-center gap-1.5 tracking-wide text-ghost uppercase">
            <span className={`${nudgeClass} ${colorClass}`}>{indicator}</span>
            <span>{formatNumber(Math.abs(delta))}</span>
            <span>Last 24h</span>
        </span>
    );
}

/**
 * Format the "+N LAST 24H" subtitle for cumulative counters (kills,
 * deaths, etc. — monotonically increasing). Unlike the instantaneous
 * delta, direction is always "up" so no arrow is shown; the number is
 * prefixed with "+" to read as an addition over the last 24h. Ghost
 * colour throughout — growth is not semantically good or bad here.
 */
function cumulativeAddedSubtitle(current, baseline) {
    if (baseline == null) return null;
    // `current` may be a Prisma BigInt (kills/deaths/etc. are BIGINT in schema)
    // while `baseline` is a plain JS number from `AVG(...)::int` — coerce
    // both to Number before subtracting to avoid the "Cannot mix BigInt and
    // other types" runtime error during SSR.
    const added = Number(current) - Number(baseline);
    if (added <= 0) return null;
    return (
        <span className="inline-flex items-center gap-1.5 tracking-wide text-ghost uppercase">
            <span>+{formatNumber(added)}</span>
            <span>Last 24h</span>
        </span>
    );
}

/**
 * Subtitle for the HELLDIVERS_LOST card — shows the absolute number
 * of accidental deaths with a small `backstab` icon in place of a
 * text label, plus the rate as a percentage of total deaths. Returns
 * null when there are no accidentals to report (either deaths or
 * accidentals is 0). The full count + rate is also surfaced via the
 * card's tooltip.
 */
function accidentalSubtitle(accidentals, deaths) {
    const count = Number(accidentals || 0);
    if (!(Number(deaths) > 0) || count <= 0) return null;
    return (
        <span className="inline-flex items-center gap-1.5 tracking-wide text-ghost uppercase">
            <img src="/icons/backstab.png" alt="" width={14} height={14} />
            <span>{formatNumber(count)}</span>
            <span>{formatAccidentalRate(accidentals, deaths)}</span>
        </span>
    );
}

/**
 * Value for the merged EVENTS card — renders `W : L` with the wins
 * tinted success-green and the losses tinted danger-red. Reads as a
 * scoreline (Super Earth vs the enemy) rather than a fraction.
 */
function eventsScoreValue(wins, losses) {
    return (
        <>
            <span className="text-success">{wins}</span>
            <span className="mx-1 text-ghost">:</span>
            <span className="text-danger">{losses}</span>
        </>
    );
}

export default function StatGrid({
    live,
    faction,
    events,
    playersAvg24h = null,
    kills24hAgo = null,
}) {
    if (!live?.length) return null;

    const factionIndex = faction !== 'global' ? factionMap[faction] : null;

    const resolved =
        events?.filter((e) => {
            if (factionIndex !== null && e.enemy !== factionIndex) return false;
            return e.status === 'success' || e.status === 'fail';
        }) ?? [];

    const { wins, losses } = countOutcomes(resolved);

    if (faction === 'global') {
        // Per-faction `players`, `kills`, `deaths`, and `accidentals` are disjoint
        // (a helldiver engages one faction at a time), so summing them is correct.
        // `total_unique_players` is a season-wide count replicated across all three
        // rows — never sum it; use live[0] if you ever display it.
        const totals = live.reduce(
            (acc, s) => ({
                players: acc.players + Number(s.players || 0),
                kills: acc.kills + Number(s.kills || 0),
                deaths: acc.deaths + Number(s.deaths || 0),
                accidentals: acc.accidentals + Number(s.accidentals || 0),
            }),
            { players: 0, kills: 0, deaths: 0, accidentals: 0 },
        );
        const onlineSubtitle = playersDeltaSubtitle(
            totals.players,
            playersAvg24h?.global,
        );
        const killsSubtitle = cumulativeAddedSubtitle(totals.kills, kills24hAgo?.global);
        return (
            <div className="stat-grid">
                <StatCard
                    label="HELLDIVERS_ONLINE"
                    value={formatNumber(totals.players)}
                    subtitle={onlineSubtitle}
                />
                <StatCard
                    label="ENEMIES_KILLED"
                    value={formatNumber(totals.kills)}
                    subtitle={killsSubtitle}
                />
                <StatCard
                    label="HELLDIVERS_LOST"
                    value={formatNumber(totals.deaths)}
                    subtitle={accidentalSubtitle(totals.accidentals, totals.deaths)}
                    title={accidentalRateTooltip(totals.accidentals, totals.deaths)}
                />
                <StatCard label="EVENTS" value={eventsScoreValue(wins, losses)} />
            </div>
        );
    }

    const stats = live.find((s) => s.enemy === factionIndex);
    if (!stats) return null;

    const onlineSubtitle = playersDeltaSubtitle(stats.players, playersAvg24h?.[faction]);
    const killsSubtitle = cumulativeAddedSubtitle(stats.kills, kills24hAgo?.[faction]);

    return (
        <div className="stat-grid">
            <StatCard
                label="HELLDIVERS_ONLINE"
                value={formatNumber(stats.players)}
                subtitle={onlineSubtitle}
            />
            <StatCard
                label="ENEMIES_KILLED"
                value={formatNumber(stats.kills)}
                subtitle={killsSubtitle}
            />
            <StatCard
                label="HELLDIVERS_LOST"
                value={formatNumber(stats.deaths)}
                subtitle={accidentalSubtitle(stats.accidentals, stats.deaths)}
                title={accidentalRateTooltip(stats.accidentals, stats.deaths)}
            />
            <StatCard
                label="MISSIONS_WON"
                value={formatNumber(stats.successful_missions)}
            />
            <StatCard label="EVENTS" value={eventsScoreValue(wins, losses)} />
        </div>
    );
}

export function StatCard({
    label,
    value,
    subtitle,
    accentColor,
    valueColor,
    onClick,
    title,
}) {
    const accentClass =
        accentColor === 'success' ? 'stat-card-accent-success'
        : accentColor === 'danger' ? 'stat-card-accent-danger'
        : 'stat-card-accent';

    const valueColorClass =
        valueColor === 'success' ? 'text-success'
        : valueColor === 'danger' ? 'text-danger'
        : '';

    return (
        <div
            className={`stat-card${onClick ? ' stat-card-clickable' : ''}`}
            onClick={onClick}
            title={title}
        >
            <div className="stat-card-content">
                <span className="stat-card-label">{label}</span>
                <span className={`stat-card-value ${valueColorClass}`}>{value}</span>
                {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
            </div>
            <div className={accentClass} />
        </div>
    );
}
