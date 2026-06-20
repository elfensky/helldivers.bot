import Image from 'next/image';
import './EventCard.css';
import factions from '@/shared/enums/factions.mjs';
import { formatDuration } from '@/shared/utils/format/formatCompactDuration.mjs';
import { FACTION_COLORS } from '@/shared/enums/colors.mjs';

export default function DefeatedCard({
    factionIndex,
    startTime,
    endTime,
    view = 'sector',
}) {
    const faction = factions[factionIndex];
    const color = FACTION_COLORS[factionIndex] || 'var(--color-primary)';
    const isCampaign = view === 'campaign';

    let timing = '—';
    if (startTime && endTime) {
        const duration = formatDuration(endTime - startTime);
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
            style={
                /** @type {React.CSSProperties} */ ({
                    '--accent-color': color,
                    '--faction-color': color,
                })
            }
        >
            <div className="sector-card-content">
                <div className="sector-card-header">
                    <Image src={faction.icon} alt="" width={16} height={16} />
                    <span
                        className="sector-card-action"
                        style={{ color: 'var(--color-gold-muted)' }}
                    >
                        Defeated
                    </span>
                    <span className="sector-card-title">{faction.name}</span>
                </div>
                <div className="sector-card-bar-label-row">
                    <span className="sector-card-bar-label">ALL_SECTORS_CAPTURED</span>
                </div>
                <div className="sector-card-bar-wrap">
                    <div
                        className="sector-card-bar"
                        role="progressbar"
                        aria-label={`${faction.name} defeat progress`}
                        aria-valuenow={isCampaign ? 11 : 100}
                        aria-valuemin={0}
                        aria-valuemax={isCampaign ? 11 : 100}
                    >
                        {isCampaign ?
                            <div className="sector-card-segments">
                                {Array.from({ length: 11 }, (_, i) => (
                                    <div
                                        key={i}
                                        className="sector-card-segment sector-card-segment--captured"
                                    />
                                ))}
                            </div>
                        :   <div
                                className="sector-card-bar-fill"
                                style={{ width: '100%', background: color }}
                            />
                        }
                    </div>
                    <span className="sector-card-pct">
                        {isCampaign ? '11/11' : '100%'}
                    </span>
                </div>
                <div className="sector-card-meta">
                    <span className="sector-card-points">{timing}</span>
                </div>
            </div>
            <div className="sector-card-accent" />
        </div>
    );
}
