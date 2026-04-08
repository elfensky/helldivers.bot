import './EventCard.css';
import factions from '@/shared/enums/factions';
import humanizeDuration from 'humanize-duration';

export default function DefeatedCard({ factionIndex, seasonDuration }) {
    const faction = factions[factionIndex];
    const duration = seasonDuration
        ? humanizeDuration(seasonDuration * 1000, { largest: 2, round: true })
        : '—';

    return (
        <div
            className="sector-card sector-card-defeated"
            style={{ '--accent-color': 'var(--color-gold-muted)' }}
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
                            style={{ width: '100%', background: 'var(--color-gold-muted)' }}
                        />
                    </div>
                    <span className="sector-card-pct">100%</span>
                </div>
                <div className="sector-card-meta">
                    <span className="sector-card-points">{duration}</span>
                </div>
            </div>
            <div className="sector-card-accent" />
        </div>
    );
}
