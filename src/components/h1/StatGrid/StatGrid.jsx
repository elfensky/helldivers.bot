import './StatGrid.css';

function formatNumber(n) {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return num.toLocaleString();
    return String(num);
}

export default function StatGrid({ live, faction }) {
    if (!live?.length) return null;

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
            </div>
        );
    }

    const factionIndex = { bugs: 0, cyborgs: 1, illuminate: 2 }[faction];
    const stats = live.find((s) => s.enemy === factionIndex);
    if (!stats) return null;

    return (
        <div className="stat-grid">
            <StatCard label="ONLINE" value={formatNumber(stats.players)} />
            <StatCard label="MISSIONS" value={formatNumber(stats.successful_missions)} />
            <StatCard label="DEATHS" value={formatNumber(stats.deaths)} />
            <StatCard label="ACCIDENTALS" value={formatNumber(stats.accidentals)} />
        </div>
    );
}

function StatCard({ label, value }) {
    return (
        <div className="stat-card">
            <div className="stat-card-content">
                <span className="stat-card-label">{label}</span>
                <span className="stat-card-value">{value}</span>
            </div>
            <div className="stat-card-accent" />
        </div>
    );
}
