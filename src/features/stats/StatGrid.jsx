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
 * Format the "vs 24h ago" subtitle for the ONLINE card. Returns null if
 * no baseline (new season) or the delta is zero. Layout: coloured arrow,
 * muted number, smaller uppercase "Last 24h" caption on the same line.
 * inline-flex + items-center keeps glyphs of different sizes aligned.
 */
function playersDeltaSubtitle(currentPlayers, players24hAgo) {
    if (players24hAgo == null) return null;
    const delta = currentPlayers - players24hAgo;
    if (delta === 0) return null;
    const arrow = delta > 0 ? '▲' : '▼';
    const colorClass = delta > 0 ? 'text-success' : 'text-danger';
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={colorClass}>{arrow}</span>
            <span>{formatNumber(Math.abs(delta))}</span>
            <span className="text-[10px] tracking-[0.12em] uppercase opacity-60">
                Last 24h
            </span>
        </span>
    );
}

export default function StatGrid({ live, faction, events, players24hAgo = null }) {
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
        const onlineSubtitle = playersDeltaSubtitle(totals.players, players24hAgo);
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

    return (
        <div className="stat-grid">
            <StatCard label="ONLINE" value={formatNumber(stats.players)} />
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
