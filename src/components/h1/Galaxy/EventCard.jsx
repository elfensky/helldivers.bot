import './EventCard.css';
import { formatNumber } from '@/utils/formatNumber.mjs';
import { PACE_COLORS } from '@/enums/colors.mjs';
import { SECTOR_COUNT } from '@/enums/worlds.mjs';

const FACTION_COLORS = {
    0: 'var(--color-faction-bugs)',
    1: 'var(--color-faction-cyborgs)',
    2: 'var(--color-faction-illuminate)',
};

/**
 * Compute frontier progress from campaign-level live data and map state.
 * Uses campaign points (not map sectors) so failed defends don't zero out progress.
 *
 * @param {object} campaignData - { points, points_max, status, enemy }
 * @param {object} factionMap - mapState[factionIndex] with sector data (for region names)
 * @returns {{ sector, region, percent, points, pointsMax, event }} | null
 */
export function computeFrontier(campaignData, factionMap) {
    if (!campaignData || !factionMap || campaignData.status !== 'active') return null;

    const pointsMax = campaignData.points_max > 0 ? campaignData.points_max : 1;
    const points = campaignData.points;
    const pointsPerSector = pointsMax / SECTOR_COUNT;
    const sectorsEarned = Math.trunc(points / pointsPerSector);
    const frontier = sectorsEarned + 1;

    if (frontier > SECTOR_COUNT) return null; // all sectors captured

    const pointsIntoFrontier = points - sectorsEarned * pointsPerSector;
    const percent = (pointsIntoFrontier / pointsPerSector) * 100;
    const sectorData = factionMap[frontier];

    return {
        sector: frontier,
        region: sectorData?.region || `Sector ${frontier}`,
        percent,
        points: Math.round(pointsIntoFrontier),
        pointsMax: Math.round(pointsPerSector),
        event: sectorData?.event || '',
    };
}

export default function EventCard({
    label,
    region,
    percent,
    points,
    pointsMax,
    factionIndex,
    pace,
}) {
    const color = FACTION_COLORS[factionIndex] || 'var(--color-primary)';
    const isEvent = label === 'DEFENDING' || label === 'ATTACKING';
    const labelColor = isEvent ? 'var(--color-danger)' : color;
    const safePct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;

    return (
        <div
            className={'sector-card' + (isEvent ? ' sector-card-event' : '')}
            style={{ '--accent-color': color }}
        >
            <div className="sector-card-content">
                <div className="sector-card-header">
                    <img
                        src={`/icons/faction${factionIndex}.webp`}
                        alt=""
                        width={16}
                        height={16}
                    />
                    <span className="sector-card-label" style={{ color: labelColor }}>
                        {label}
                    </span>
                    {isEvent && <span className="sector-card-alert">{'\u26A0'}</span>}
                    {pace && (
                        <span
                            className="sector-card-pace"
                            style={{ color: PACE_COLORS[pace.status] }}
                        >
                            {pace.label}
                        </span>
                    )}
                </div>
                <span className="sector-card-region">{region}</span>
                <div className="sector-card-bar-wrap">
                    <div
                        className="sector-card-bar"
                        role="progressbar"
                        aria-valuenow={safePct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="sector-card-bar-fill"
                            style={{ width: `${safePct}%` }}
                        />
                    </div>
                    <span className="sector-card-pct">{safePct.toFixed(1)}%</span>
                </div>
                <span className="sector-card-points">
                    {formatNumber(points)} / {formatNumber(pointsMax)}
                </span>
            </div>
            <div className="sector-card-accent" />
        </div>
    );
}
