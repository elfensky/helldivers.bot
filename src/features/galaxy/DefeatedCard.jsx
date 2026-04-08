import './EventCard.css';
import factions from '@/shared/enums/factions';
import humanizeDuration from 'humanize-duration';

const FACTION_COLORS = {
    0: 'var(--color-faction-bugs)',
    1: 'var(--color-faction-cyborgs)',
    2: 'var(--color-faction-illuminate)',
};

export default function DefeatedCard({ factionIndex, startTime, endTime }) {
    const faction = factions[factionIndex];
    const color = FACTION_COLORS[factionIndex] || 'var(--color-primary)';

    let timing = '—';
    if (startTime && endTime) {
        const duration = humanizeDuration((endTime - startTime) * 1000, {
            largest: 2,
            round: true,
        });
        const date = new Date(endTime * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
        timing = `${duration} · ${date}`;
    }

    return (
        <div
            className="sector-card sector-card-defeated"
            style={{ '--accent-color': color }}
        >
            <div className="sector-card-content">
                <div className="sector-card-header">
                    <img
                        src={faction.icon}
                        alt=""
                        width={16}
                        height={16}
                    />
                    <span
                        className="sector-card-action"
                        style={{ color: 'var(--color-gold-muted)' }}
                    >
                        Defeated
                    </span>
                    <span className="sector-card-title">{faction.name}</span>
                </div>
                <div className="sector-card-bar-label-row">
                    <span className="sector-card-bar-label">ALL SECTORS CAPTURED</span>
                </div>
                <div className="sector-card-bar-wrap">
                    <div
                        className="sector-card-bar"
                        role="progressbar"
                        aria-valuenow={100}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="sector-card-bar-fill"
                            style={{ width: '100%', background: color }}
                        />
                    </div>
                    <span className="sector-card-pct">100%</span>
                </div>
                <div className="sector-card-meta">
                    <span className="sector-card-points">{timing}</span>
                </div>
            </div>
            <div className="sector-card-accent" />
        </div>
    );
}
