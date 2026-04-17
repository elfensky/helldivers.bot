import { useState, useEffect } from 'react';
import './EventCard.css';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { PACE_COLORS, FACTION_COLORS } from '@/shared/enums/colors.mjs';
import { SECTOR_COUNT, HOMEWORLD_REGION } from '@/shared/enums/worlds.mjs';
import { countCapturedRegions } from '@/shared/utils/game/countCapturedRegions.mjs';
import humanizeDuration from 'humanize-duration';

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

function EventCountdown({ endTime }) {
    const [remaining, setRemaining] = useState(
        () => endTime - Math.floor(Date.now() / 1000),
    );

    useEffect(() => {
        setRemaining(endTime - Math.floor(Date.now() / 1000));
        const id = setInterval(() => {
            setRemaining(endTime - Math.floor(Date.now() / 1000));
        }, 1000);
        return () => clearInterval(id);
    }, [endTime]);

    if (remaining <= 0) return <span className="sector-card-countdown">Expired</span>;
    const text = humanizeDuration(remaining * 1000, { largest: 2, round: true });
    return (
        <span className="sector-card-countdown" suppressHydrationWarning>
            {text} left
        </span>
    );
}

function SegmentCell({ seg, factionColor }) {
    const status = seg?.status;
    if (status === 'captured') {
        return <div className="sector-card-segment sector-card-segment--captured" />;
    }
    if (status === 'in_progress') {
        const pct = Math.max(0, Math.min(100, seg?.percent ?? 0));
        return (
            <div
                className="sector-card-segment sector-card-segment--in-progress"
                style={{ '--segment-percent': `${pct}%` }}
            />
        );
    }
    if (status === 'active') {
        // Homeworld attack in progress — uses danger color, matches defending aesthetic
        const pct = Math.max(0, Math.min(100, seg?.percent ?? 0));
        return (
            <div
                className="sector-card-segment sector-card-segment--active"
                style={{ '--segment-percent': `${pct}%` }}
            />
        );
    }
    return <div className="sector-card-segment" />;
}

export default function EventCard({
    action,
    region,
    percent,
    points,
    pointsMax,
    factionIndex,
    pace,
    endTime,
    barLabel,
    pulseDelay,
    view = 'sector',
    factionMap,
}) {
    const color = FACTION_COLORS[factionIndex] || 'var(--color-primary)';
    const isEvent = !!endTime;
    const isDefending = action === 'defending';
    const titleColor = isEvent ? 'var(--color-danger)' : undefined;
    const barColor = isDefending ? 'var(--color-danger)' : color;
    const safePct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;

    const isCampaign = view === 'campaign';
    const { captured, inProgressRegion } =
        isCampaign ?
            countCapturedRegions(factionMap)
        :   { captured: 0, inProgressRegion: null };

    const campaignTitle =
        isCampaign ?
            inProgressRegion === HOMEWORLD_REGION ?
                `Homeworld · ${captured}/11`
            :   `Campaign · ${captured}/11`
        :   region;

    const cardStyle = {
        '--accent-color': color,
        '--faction-color': color,
    };
    if (pulseDelay != null) cardStyle['--pulse-delay'] = `${pulseDelay}s`;

    return (
        <div className="sector-card" style={cardStyle}>
            <div className="sector-card-content">
                <div className="sector-card-header">
                    <img
                        src={`/icons/faction${factionIndex}.webp`}
                        alt=""
                        width={16}
                        height={16}
                    />
                    <span
                        className={
                            'sector-card-action' +
                            (isEvent ? ' sector-card-action-flash' : '')
                        }
                        style={titleColor ? { color: titleColor } : undefined}
                    >
                        {isDefending ? 'Defending' : 'Capturing'}
                    </span>
                    <span className="sector-card-title">{campaignTitle}</span>
                </div>
                {barLabel && (
                    <div className="sector-card-bar-label-row">
                        <span className="sector-card-bar-label">{barLabel}</span>
                        {pace && (
                            <>
                                <span className="sector-card-sep">&middot;</span>
                                <span
                                    className="sector-card-pace"
                                    style={{ color: PACE_COLORS[pace.status] }}
                                    suppressHydrationWarning
                                >
                                    {pace.label}
                                </span>
                            </>
                        )}
                    </div>
                )}
                <div className="sector-card-bar-wrap">
                    <div
                        className="sector-card-bar"
                        role="progressbar"
                        aria-valuenow={isCampaign ? captured : safePct}
                        aria-valuemin={0}
                        aria-valuemax={isCampaign ? 11 : 100}
                    >
                        {isCampaign ?
                            <div className="sector-card-segments">
                                {Array.from({ length: 11 }, (_, i) => {
                                    const r = i + 1;
                                    return (
                                        <SegmentCell
                                            key={r}
                                            seg={factionMap?.[r]}
                                            factionColor={barColor}
                                        />
                                    );
                                })}
                            </div>
                        :   <div
                                className="sector-card-bar-fill"
                                style={{ width: `${safePct}%`, background: barColor }}
                            />
                        }
                    </div>
                    <span className="sector-card-pct">
                        {isCampaign ? `${captured}/11` : `${safePct.toFixed(1)}%`}
                    </span>
                </div>
                <div className="sector-card-meta">
                    <span className="sector-card-points">
                        {formatNumber(points)} / {formatNumber(pointsMax)}
                    </span>
                    {endTime && (
                        <>
                            <span className="sector-card-sep">&middot;</span>
                            <EventCountdown endTime={endTime} />
                        </>
                    )}
                    {!barLabel && pace && (
                        <>
                            <span className="sector-card-sep">&middot;</span>
                            <span
                                className="sector-card-pace"
                                style={{ color: PACE_COLORS[pace.status] }}
                                suppressHydrationWarning
                            >
                                {pace.label}
                            </span>
                        </>
                    )}
                </div>
            </div>
            <div
                className={
                    'sector-card-accent' + (isEvent ? ' sector-card-accent-flash' : '')
                }
            />
        </div>
    );
}
