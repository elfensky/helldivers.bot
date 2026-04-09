import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';
import './StatGrid.css';

const factionMap = { bugs: 0, cyborgs: 1, illuminate: 2 };

export default function StatGrid({ live, faction, events }) {
    if (!live?.length) return null;

    const factionIndex = faction !== 'global' ? factionMap[faction] : null;

    const resolved =
        events?.filter((e) => {
            if (factionIndex !== null && e.enemy !== factionIndex) return false;
            return e.status === 'success' || e.status === 'fail';
        }) ?? [];

    const { wins, losses } = countOutcomes(resolved);

    if (faction === 'global') {
        const totals = live.reduce(
            (acc, s) => ({
                players: acc.players + Number(s.players || 0),
                kills: acc.kills + Number(s.kills || 0),
                deaths: acc.deaths + Number(s.deaths || 0),
                accidentals: acc.accidentals + Number(s.accidentals || 0),
            }),
            { players: 0, kills: 0, deaths: 0, accidentals: 0 },
        );
        return (
            <div className="stat-grid">
                <StatCard
                    label="HELLDIVERS_ONLINE"
                    value={formatNumber(totals.players)}
                />
                <StatCard label="ENEMIES_KILLED" value={formatNumber(totals.kills)} />
                <StatCard label="HELLDIVERS_LOST" value={formatNumber(totals.deaths)} />
                <StatCard label="ACCIDENTALS" value={formatNumber(totals.accidentals)} />
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
            <StatCard label="MISSIONS" value={formatNumber(stats.successful_missions)} />
            <StatCard label="DEATHS" value={formatNumber(stats.deaths)} />
            <StatCard label="ACCIDENTALS" value={formatNumber(stats.accidentals)} />
            <StatCard label="WON" value={wins} accentColor="success" />
            <StatCard label="LOST" value={losses} accentColor="danger" />
        </div>
    );
}

export function StatCard({ label, value, accentColor, valueColor }) {
    const accentClass =
        accentColor === 'success' ? 'stat-card-accent-success'
        : accentColor === 'danger' ? 'stat-card-accent-danger'
        : 'stat-card-accent';

    const valueColorClass =
        valueColor === 'success' ? 'text-success'
        : valueColor === 'danger' ? 'text-danger'
        : '';

    return (
        <div className="stat-card">
            <div className="stat-card-content">
                <span className="stat-card-label">{label}</span>
                <span className={`stat-card-value ${valueColorClass}`}>{value}</span>
            </div>
            <div className={accentClass} />
        </div>
    );
}
