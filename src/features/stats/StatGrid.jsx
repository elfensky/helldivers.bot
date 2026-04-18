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
 * Returns null if no baseline (new season) or the delta is zero.
 * Whole line is uppercase and ghost-coloured (matching label styling)
 * except the arrow, which keeps its success/danger tint.
 */
function playersDeltaSubtitle(currentPlayers, avgPlayers) {
    if (avgPlayers == null) return null;
    const delta = currentPlayers - avgPlayers;
    if (delta === 0) return null;
    const arrow = delta > 0 ? '▲' : '▼';
    const colorClass = delta > 0 ? 'text-success' : 'text-danger';
    return (
        <span className="inline-flex items-center gap-1.5 tracking-wide text-ghost uppercase">
            <span className={`-translate-y-[1.5px] ${colorClass}`}>{arrow}</span>
            <span>{formatNumber(Math.abs(delta))}</span>
            <span>Last 24h</span>
        </span>
    );
}

export default function StatGrid({ live, faction, events, playersAvg24h = null }) {
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
        return (
            <div className="stat-grid">
                <StatCard
                    label="HELLDIVERS_ONLINE"
                    value={formatNumber(totals.players)}
                    subtitle={onlineSubtitle}
                />
                <StatCard label="ENEMIES_KILLED" value={formatNumber(totals.kills)} />
                <StatCard label="HELLDIVERS_LOST" value={formatNumber(totals.deaths)} />
                <StatCard
                    label="ACCIDENTAL_RATE"
                    value={formatAccidentalRate(totals.accidentals, totals.deaths)}
                    title={accidentalRateTooltip(totals.accidentals, totals.deaths)}
                />
                <StatCard label="WON" value={wins} accentColor="success" />
                <StatCard label="LOST" value={losses} accentColor="danger" />
            </div>
        );
    }

    const stats = live.find((s) => s.enemy === factionIndex);
    if (!stats) return null;

    const onlineSubtitle = playersDeltaSubtitle(stats.players, playersAvg24h?.[faction]);

    return (
        <div className="stat-grid">
            <StatCard
                label="HELLDIVERS_ONLINE"
                value={formatNumber(stats.players)}
                subtitle={onlineSubtitle}
            />
            <StatCard label="ENEMIES_KILLED" value={formatNumber(stats.kills)} />
            <StatCard label="DEATHS" value={formatNumber(stats.deaths)} />
            <StatCard
                label="MISSIONS_WON"
                value={formatNumber(stats.successful_missions)}
            />
            <StatCard
                label="ACCIDENTAL_RATE"
                value={formatAccidentalRate(stats.accidentals, stats.deaths)}
                title={accidentalRateTooltip(stats.accidentals, stats.deaths)}
            />
            <StatCard label="WON" value={wins} accentColor="success" />
            <StatCard label="LOST" value={losses} accentColor="danger" />
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
