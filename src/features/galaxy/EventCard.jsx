import { useState, useEffect } from 'react';
import Image from 'next/image';
import './EventCard.css';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { PACE_COLORS, FACTION_COLORS } from '@/shared/enums/colors.mjs';
import { SECTOR_COUNT } from '@/shared/enums/worlds.mjs';
import { countCapturedRegions } from '@/shared/utils/game/countCapturedRegions.mjs';
import AnimatedStat from '@/shared/components/AnimatedStat/AnimatedStat';
import { CAMPAIGN_STATUS, EVENT_STATUS, MAP_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

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
    // Compact ("56m20s", not "56 minutes, 20 seconds") — the long form wraps
    // the meta row onto a second line on a narrow card.
    const text = formatCompactDuration(remaining);
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

/**
 * Pace status indicator — a ▲/▼/▪ glyph plus the points delta, colour-coded
 * by status. Mirrors the StatGrid delta-subtitle pattern. The glyph and the
 * number are separate inline-flex children, so the slot counter animates only
 * the digits and the gap between glyph and number is never compressed (the
 * spacing bug the old "175,259 behind" single-string label suffered from).
 *
 * The delta always renders; ▪ means dead-on (zero points either way), so the
 * glyph tracks the number rather than the buffered status band.
 *
 * @param {object} props - Component props
 * @param {{ status: 'ahead'|'behind'|'on_track', delta: number }} props.pace - Evaluated event pace
 */
function PaceIndicator({ pace }) {
    // Glyph and colour both follow the number, not the buffered status band:
    // an 'on_track' event is still ahead by its delta, and a green ▲ with a
    // grey colour read as a contradiction on the card.
    const key =
        pace.delta === 0 ? 'on_track'
        : pace.status === 'behind' ? 'behind'
        : 'ahead';
    const glyph = { ahead: '▲', behind: '▼', on_track: '▪' }[key];
    // ▲/▼ glyphs sit below their optical centre — lift them; ▪ is centred.
    const nudge = key === 'on_track' ? '' : '-translate-y-[1.5px]';
    return (
        <span
            className="sector-card-pace inline-flex items-center gap-1"
            style={{ color: PACE_COLORS[key] }}
            suppressHydrationWarning
        >
            <span className={nudge}>{glyph}</span>
            <AnimatedStat value={pace.delta} />
        </span>
    );
}

/**
 * The discriminated result of `attackForecast` or `sectorForecast`. Declared
 * locally rather than imported so this presentational component keeps no
 * dependency on the dashboard feature that computes it. Covers both the
 * percentile-window shape (attack/homeworld assaults) and the median-only
 * shape (sector ETAs, whose range hasn't shipped yet — see script 13).
 *
 * @typedef {{mode: 'window', p25: number, p50: number, p75: number, imminent: boolean}
 *   | {mode: 'median', p50: number, remaining: number, imminent: boolean}
 *   | {mode: 'hidden', reason: string}} AssaultForecast
 */

/**
 * @param {number} h hours
 * @returns {string} whole days at >=48h ("5d"), whole hours at >=1h, whole
 *   minutes below ("40m")
 */
function formatEtaHours(h) {
    const clamped = Math.max(0, h);
    if (clamped < 1) return `${Math.round(clamped * 60)}m`;
    if (clamped < 48) return `${Math.round(clamped)}h`;
    return `${Math.round(clamped / 24)}d`;
}

/**
 * Range with the unit written once when both bounds share it: `4-16h`,
 * `30-55m` — and per-bound only when mixed: `30m-2h`.
 *
 * @param {number} lo hours
 * @param {number} hi hours
 * @returns {string}
 */
function formatEtaRange(lo, hi) {
    const a = formatEtaHours(lo);
    const b = formatEtaHours(hi);
    return a.slice(-1) === b.slice(-1) ? `${a.slice(0, -1)}-${b}` : `${a}-${b}`;
}

/**
 * ETA line, rendered as one more middot-separated item in the meta row.
 *
 * Median-first with the range in parens for window forecasts: `~9h (4-16h)`.
 * The `~` and the range keep the single number honest — still not a
 * countdown. NOT a `±` form: the window is asymmetric (near campaign
 * completion p75 runs up to 2x the median, see /docs/predict), and a
 * symmetric spread would understate the late side. Median-only forecasts
 * (sector ETAs) render without a range — an unmeasured spread would be
 * worse than none.
 *
 * @param {object} props
 * @param {{mode: 'window', p25: number, p50: number, p75: number, imminent: boolean}
 *   | {mode: 'median', p50: number, remaining: number, imminent: boolean}} props.forecast
 */
function EtaLine({ forecast }) {
    const med = formatEtaHours(forecast.p50);
    const range =
        forecast.mode === 'window' ?
            ` (${formatEtaRange(forecast.p25, forecast.p75)})`
        :   ''; // mode 'median' — no unmeasured parens (sector ETA, see spec ruling)
    // Beyond the validated 48h window the figures are the same arithmetic and
    // measured ratios, but were never separately validated out there — say so.
    const rough = forecast.p50 >= 48 ? ' Rough at multi-day range.' : '';
    const title =
        (forecast.mode === 'window' ?
            `Assault ETA — median ${forecast.p50.toFixed(1)}h. Range is the 25th-75th percentile.`
        :   `Median estimate ${forecast.p50.toFixed(1)}h. Range ships once calibrated (script 13).`) +
        rough;
    return (
        <span
            className={
                'sector-card-assault' +
                (forecast.imminent ? ' sector-card-assault--imminent' : '')
            }
            title={title}
            suppressHydrationWarning
        >
            ETA ~{med}
            {range}
        </span>
    );
}

/**
 * How an active event is going to END, in the same left-aligned style as the
 * campaign/sector `EtaLine`.
 *
 * Behind, the bar never fills, so there is no ETA to show and the word carries
 * it in danger red — the `EventCountdown` beside this already holds the loss
 * time, so no second copy of the duration.
 *
 * On track or ahead, the fill ETA is the whole message: no word, just the
 * number — primary yellow on track, success green when the pace is ahead.
 *
 * @param {object} props
 * @param {{etaHours: number|null, onTrack: boolean, stalled: boolean}} props.eta
 * @param {{status: 'ahead'|'behind'|'on_track'}} [props.pace]
 */
function EventEta({ eta, pace }) {
    if (!eta.onTrack) {
        return (
            <span
                className="sector-card-assault sector-card-assault--imminent"
                title={
                    'At the average pace since the event started, the bar will not fill ' +
                    'before the timer runs out. The countdown is the time left.'
                }
                suppressHydrationWarning
            >
                Behind
            </span>
        );
    }
    const hours = /** @type {number} */ (eta.etaHours);
    return (
        <span
            className={
                'sector-card-assault' +
                (pace?.status === 'ahead' ? ' sector-card-assault--ahead' : '')
            }
            title={
                'At the average pace since the event started, the bar fills before the ' +
                'timer runs out — this is when.'
            }
            suppressHydrationWarning
        >
            ~{formatEtaHours(hours)}
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
    etaForecast = /** @type {AssaultForecast|null} */ (null),
    eventEta = /** @type {{mode: 'verdict', etaHours: number|null, remainingHours: number, onTrack: boolean, stalled: boolean}|{mode: 'hidden'}|null} */ (
        null
    ),
    alert = false,
}) {
    // Every verdict renders now, stalled included: a stalled event is behind by
    // definition, and the behind branch needs no ETA to say so.
    const showEventEta = eventEta?.mode === 'verdict';
    const color = FACTION_COLORS[factionIndex] || 'var(--color-primary)';
    const isEvent = !!endTime;
    const isDefending = action === 'defending';
    const titleColor = isEvent ? 'var(--color-danger)' : undefined;
    const barColor = isDefending ? 'var(--color-danger)' : color;
    const safePct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;

    const isCampaign = view === 'campaign';
    const { captured } = isCampaign ? countCapturedRegions(factionMap) : { captured: 0 };

    // Faction view's bar spans the whole campaign, so the header is just the
    // faction name — no "Capturing", which belongs to a single sector. Active
    // events keep their action word and place name; they're about a place.
    const isFactionTitle = isCampaign && !isEvent;
    const title = isFactionTitle ? factions[factionIndex]?.name || region : region;

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
                    {!isFactionTitle && (
                        <span
                            className={
                                'sector-card-action' +
                                (isEvent ? ' sector-card-action-flash' : '')
                            }
                            style={titleColor ? { color: titleColor } : undefined}
                        >
                            {isDefending ? 'Defending' : 'Capturing'}
                        </span>
                    )}
                    {alert && (
                        <span
                            className="sector-card-event-alert sector-card-action-flash"
                            title="Event in progress in this faction's territory"
                            aria-label="Event in progress"
                        >
                            !
                        </span>
                    )}
                    <span className="sector-card-title">{title}</span>
                </div>
                {(barLabel ||
                    etaForecast?.mode === 'window' ||
                    etaForecast?.mode === 'median' ||
                    showEventEta) && (
                    <div className="sector-card-bar-label-row">
                        {/* Label and forecast are grouped so the row's
                            space-between still pushes the pace indicator to the
                            right edge rather than spreading three items evenly. */}
                        <span className="sector-card-bar-label-group">
                            {barLabel && (
                                <span className="sector-card-bar-label">{barLabel}</span>
                            )}
                            {(etaForecast?.mode === 'window' ||
                                etaForecast?.mode === 'median') && (
                                <>
                                    {barLabel && (
                                        <span className="sector-card-sep">&middot;</span>
                                    )}
                                    <EtaLine forecast={etaForecast} />
                                </>
                            )}
                            {showEventEta && (
                                <>
                                    {barLabel && (
                                        <span className="sector-card-sep">&middot;</span>
                                    )}
                                    <EventEta eta={eventEta} pace={pace} />
                                </>
                            )}
                        </span>
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
                        aria-label={`${title} ${action} progress`}
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
                    {endTime && <EventCountdown endTime={endTime} />}
                    {!barLabel && pace && (
                        <>
                            <span className="sector-card-sep">&middot;</span>
                            <PaceIndicator pace={pace} />
                        </>
                    )}
                </div>
            </div>
            {/* Accent stays solid faction color — the flashing state signal
                lives in the title's action word, not here. */}
            <div className="sector-card-accent" />
        </div>
    );
}
