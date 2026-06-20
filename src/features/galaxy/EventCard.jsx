import { useState, useEffect } from 'react';
import Image from 'next/image';
import './EventCard.css';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { PACE_COLORS, FACTION_COLORS } from '@/shared/enums/colors.mjs';
import { SECTOR_COUNT } from '@/shared/enums/worlds.mjs';
import { countCapturedRegions } from '@/shared/utils/game/countCapturedRegions.mjs';
import AnimatedStat from '@/shared/components/AnimatedStat/AnimatedStat';
import { CAMPAIGN_STATUS, EVENT_STATUS, MAP_STATUS } from '@/shared/enums/events.mjs';
import { formatDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

const passThrough = (v) => (v == null ? '—' : String(v));
const formatSectorPct = (v) =>
    Number.isFinite(v) ? `${Math.max(0, Math.min(100, v)).toFixed(1)}%` : '—';

/**
 * Compute frontier progress from campaign-level live data and map state.
 * Uses campaign points (not map sectors) so failed defends don't zero out progress.
 *
 * @param {object} campaignData - { points, points_max, status, enemy }
 * @param {object} factionMap - mapState[factionIndex] with sector data (for region names)
 * @returns {{ sector: number, region: string, percent: number, points: number, pointsMax: number, event: string } | null}
 */
export function computeFrontier(campaignData, factionMap) {
    if (!campaignData || !factionMap || campaignData.status !== CAMPAIGN_STATUS.ACTIVE)
        return null;

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
    const text = formatDuration(remaining);
    return (
        <span className="sector-card-countdown" suppressHydrationWarning>
            {text} left
        </span>
    );
}

function SegmentCell({ seg, factionColor: _factionColor }) {
    const status = seg?.status;
    if (status === MAP_STATUS.CAPTURED) {
        return <div className="sector-card-segment sector-card-segment--captured" />;
    }
    if (status === MAP_STATUS.IN_PROGRESS) {
        const pct = Math.max(0, Math.min(100, seg?.percent ?? 0));
        return (
            <div
                className="sector-card-segment sector-card-segment--in-progress"
                style={
                    /** @type {React.CSSProperties} */ ({
                        '--segment-percent': `${pct}%`,
                    })
                }
            />
        );
    }
    if (status === EVENT_STATUS.ACTIVE) {
        // Homeworld attack in progress — uses danger color, matches defending aesthetic
        const pct = Math.max(0, Math.min(100, seg?.percent ?? 0));
        return (
            <div
                className="sector-card-segment sector-card-segment--active"
                style={
                    /** @type {React.CSSProperties} */ ({
                        '--segment-percent': `${pct}%`,
                    })
                }
            />
        );
    }
    return <div className="sector-card-segment" />;
}

const PACE_GLYPH = { ahead: '▲', behind: '▼', on_track: '▪' };

/**
 * Pace status indicator — a ▲/▼/▪ glyph plus the points delta, colour-coded
 * by status. Mirrors the StatGrid delta-subtitle pattern. The glyph and the
 * number are separate inline-flex children, so the slot counter animates only
 * the digits and the gap between glyph and number is never compressed (the
 * spacing bug the old "175,259 behind" single-string label suffered from).
 *
 * @param {object} props - Component props
 * @param {{ status: 'ahead'|'behind'|'on_track', delta: number }} props.pace - Evaluated event pace
 */
function PaceIndicator({ pace }) {
    const glyph = PACE_GLYPH[pace.status] ?? '▪';
    // ▲/▼ glyphs sit below their optical centre — lift them; ▪ is centred.
    const nudge = pace.status === 'on_track' ? '' : '-translate-y-[1.5px]';
    return (
        <span
            className="sector-card-pace inline-flex items-center gap-1"
            style={{ color: PACE_COLORS[pace.status] }}
            suppressHydrationWarning
        >
            <span className={nudge}>{glyph}</span>
            {pace.status === 'on_track' ?
                <span>On track</span>
            :   <AnimatedStat value={pace.delta} />}
        </span>
    );
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
    const { captured } = isCampaign ? countCapturedRegions(factionMap) : { captured: 0 };

    const cardStyle = /** @type {React.CSSProperties} */ ({
        '--accent-color': color,
        '--faction-color': color,
    });
    if (pulseDelay != null) cardStyle['--pulse-delay'] = `${pulseDelay}s`;

    return (
        <div className="sector-card" style={cardStyle}>
            <div className="sector-card-content">
                <div className="sector-card-header">
                    <Image
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
                    <span className="sector-card-title">{region}</span>
                </div>
                {barLabel && (
                    <div className="sector-card-bar-label-row">
                        <span className="sector-card-bar-label">{barLabel}</span>
                        {pace && (
                            <>
                                <span className="sector-card-sep">&middot;</span>
                                <PaceIndicator pace={pace} />
                            </>
                        )}
                    </div>
                )}
                <div className="sector-card-bar-wrap">
                    <div
                        className="sector-card-bar"
                        role="progressbar"
                        aria-label={`${region} ${action} progress`}
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
                        {isCampaign ?
                            <>
                                <AnimatedStat value={captured} format={passThrough} />
                                /11
                            </>
                        :   <AnimatedStat value={safePct} format={formatSectorPct} />}
                    </span>
                </div>
                <div className="sector-card-meta">
                    <span className="sector-card-points">
                        <AnimatedStat value={points} /> / {formatNumber(pointsMax)}
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
                            <PaceIndicator pace={pace} />
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
