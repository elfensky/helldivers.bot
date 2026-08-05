'use client';

import Image from 'next/image';
import Link from 'next/link';
import '@/features/galaxy/EventCard.css';
import { dayOf } from '@/shared/utils/game/warClock.mjs';

/**
 * Hours formatter — mirrors EventCard.jsx's `formatEtaHours` (module-private
 * there; galaxy and dashboard features stay decoupled) so the wave ETA reads
 * exactly like the assault ETA: minutes below 1h, whole hours below 48h,
 * whole days beyond.
 *
 * @param {number} h hours
 * @returns {string}
 */
function formatEtaHours(h) {
    const clamped = Math.max(0, h);
    if (clamped < 1) return `${Math.round(clamped * 60)}m`;
    if (clamped < 48) return `${Math.round(clamped)}h`;
    return `${Math.round(clamped / 24)}d`;
}

/**
 * Range with the unit written once when both bounds share it — mirrors
 * EventCard.jsx's `formatEtaRange`: `14-32h`, `30m-2h` when mixed.
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
 * @param {number} t unix seconds
 * @returns {string} short local time, e.g. "Tue 14:00"
 */
function localTime(t) {
    return new Date(t * 1000).toLocaleString([], {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * The counteroffensive clock line — pace-conditional phrasing around the
 * deterministic timeout (counterattackForecast.mjs). The pace wording is a
 * projection of the assault's own on-track/behind verdict (the same ▲/▼ the
 * event card shows), never a probability: the verdict-to-outcome link is
 * deliberately unquantified until enough progress-tracked assaults exist
 * (#487).
 *
 * @param {object} props
 * @param {{at: number, pace: 'on_track'|'behind'|'stalled'|null}} props.counter
 * @param {number} props.now unix seconds
 */
function CounterattackLine({ counter, now }) {
    const when =
        counter.at > now ?
            `${localTime(counter.at)} (in ~${formatEtaHours((counter.at - now) / 3600)})`
        :   'imminent';
    const lead =
        counter.pace === 'on_track' ? 'assault on pace to succeed'
        : counter.pace === 'behind' || counter.pace === 'stalled' ? 'assault behind pace'
        : 'if the assault fails';
    const tail =
        counter.pace === 'on_track' ?
            ` · counterattack ${when} only if pace collapses`
        :   ` · counterattack ${when}`;
    return (
        <div className="sector-card-meta">
            <span
                className="sector-card-points"
                title="Deterministic mechanic, not a model: every failed homeworld assault in recorded history ran exactly 48h and its counterattack landed within minutes of the timeout. Only fires if the assault fails — a won assault removes the faction instead. Pace wording projects the assault's current rate (the same on-track/behind verdict as the event card)."
                suppressHydrationWarning
            >
                {lead}
                {tail}
            </span>
        </div>
    );
}

/**
 * The dashboard's prediction card, driven by two STANDALONE forecasts that
 * own different regimes (see /docs/predict/defend, rules 7-8):
 *
 *  - `forecast` (waveForecast.mjs) — the FREE-wave likelihood band, present
 *    only while the scheduler's dice are actually rolling (no assault, no
 *    active defend). Band, never a countdown.
 *  - `counter` (counterattackForecast.mjs) — the counteroffensive clock,
 *    present only while an assault runs (when the free clock is gated).
 *    Deterministic, so it IS allowed to be a clock, phrased conditionally
 *    on the assault failing.
 *
 * The two are never shown from the same regime: an active assault hides the
 * band and shows the clock; otherwise the band shows and the clock is
 * hidden. Rendered in the same sector-card skeleton as the faction cards
 * (EventCard.css — imported directly so the classes don't depend on an
 * EventCard rendering first).
 *
 * @param {object} props
 * @param {ReturnType<typeof import('./waveForecast.mjs').waveForecast>} props.forecast
 * @param {ReturnType<typeof import('./counterattackForecast.mjs').counterattackForecast>} [props.counter]
 * @param {number | null} props.warStart unix seconds anchor for war-day labels
 * @param {number} props.now unix seconds
 */
export default function NextWaveCard({ forecast, counter, warStart, now }) {
    const hasWindow = forecast?.mode === 'window';
    const hasClock = counter?.mode === 'clock';
    if (!hasWindow && !hasClock) return null;

    return (
        <div
            className="sector-card"
            style={
                /** @type {React.CSSProperties} */ ({
                    '--accent-color': 'var(--color-primary)',
                })
            }
            suppressHydrationWarning
        >
            <div className="sector-card-content">
                <div className="sector-card-header">
                    {/* 14x16, not 16x16: superearth.webp is 1000x1142, so a square box
                        forces the browser to stretch height to preserve the ratio
                        (next/image warns, and the icon renders 16x18.5). These
                        dimensions match the source ratio and the 16px height of the
                        square faction icons in the sibling cards. */}
                    <Image src="/icons/superearth.webp" alt="" width={14} height={16} />
                    <span
                        className="sector-card-action"
                        style={{ color: 'var(--color-primary)' }}
                    >
                        Predicted
                    </span>
                    <span className="sector-card-title">Wave</span>
                    <Link
                        href="/docs/predict/defend"
                        data-umami-event="dashboard-wave-window-docs"
                        aria-label="How is this computed?"
                        title="How is this computed?"
                        className="ml-auto font-mono text-small text-text-muted no-underline"
                    >
                        ⓘ
                    </Link>
                </div>
                {hasWindow ?
                    <WaveWindow forecast={forecast} warStart={warStart} now={now} />
                :   <div className="sector-card-bar-label-row">
                        <span className="sector-card-bar-label">COUNTERATTACK_CLOCK</span>
                        <span
                            className="sector-card-bar-label"
                            style={{ color: 'var(--color-warning)' }}
                        >
                            ASSAULT RUNNING
                        </span>
                    </div>
                }
                {hasClock && <CounterattackLine counter={counter} now={now} />}
            </div>
            <div className="sector-card-accent" />
        </div>
    );
}

/**
 * The free-wave band: label row, median-tick bar, and the within-24h/48h
 * meta row. Split out so the clock-only regime renders without it.
 *
 * @param {object} props
 * @param {{p25: number, p50: number, p75: number, p24: number, p48: number,
 *   imminent: boolean, runningLong: boolean}} props.forecast
 * @param {number | null} props.warStart
 * @param {number} props.now
 */
function WaveWindow({ forecast, warStart, now }) {
    const { p25, p50, p75, p24, p48, imminent, runningLong } = forecast;
    const from = now + p25 * 3600;
    const to = now + p75 * 3600;
    const warDays =
        warStart != null ?
            ` · War Day ${dayOf(from, warStart)}–${dayOf(to, warStart)}`
        :   '';
    const title =
        `median ${localTime(now + p50 * 3600)} · window ${localTime(from)} – ${localTime(to)} (your time)${warDays}` +
        ` · likely window (50% band) · typical miss ±8h` +
        (runningLong ?
            ' · a faction is 1 sector from homeworld assault — waves pause in this window'
        :   '');

    const axisHours = Math.max(48, Math.ceil(p75 / 12) * 12);
    const range = `~${formatEtaHours(p50)} (${formatEtaRange(p25, p75)})`;
    const state =
        [runningLong && 'RUNNING LONG', imminent && 'IMMINENT']
            .filter(Boolean)
            .join(' · ') || null;

    return (
        <>
            <div className="sector-card-bar-label-row">
                <span className="sector-card-bar-label">LIKELIHOOD_WINDOW</span>
                {state && (
                    <span
                        className="sector-card-bar-label"
                        style={{
                            color:
                                runningLong ? 'var(--color-warning)' : (
                                    'var(--color-primary)'
                                ),
                        }}
                    >
                        {state}
                    </span>
                )}
            </div>
            <div className="sector-card-bar-wrap">
                <div
                    className="sector-card-bar"
                    role="img"
                    aria-label={`Next wave ETA ${range}`}
                    style={{ position: 'relative' }}
                >
                    {/* p25-p75 band, deliberately subtle — the median tick
                        below carries the accent, matching the assault
                        line's median-first reading. */}
                    <div
                        className="sector-card-bar-fill"
                        style={{
                            marginLeft: `${(p25 / axisHours) * 100}%`,
                            width: `${((p75 - p25) / axisHours) * 100}%`,
                            background: 'var(--color-primary)',
                            opacity: 0.35,
                        }}
                    />
                    <div
                        aria-hidden="true"
                        className="sector-card-bar-median"
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${(p50 / axisHours) * 100}%`,
                            width: '2px',
                            background: 'var(--color-primary)',
                        }}
                    />
                </div>
                <span className="sector-card-pct" title={title} suppressHydrationWarning>
                    {range}
                </span>
            </div>
            <div className="sector-card-meta">
                <span className="sector-card-points">
                    {Math.round(p24 * 100)}% within 24h
                </span>
                <span className="sector-card-sep">&middot;</span>
                <span className="sector-card-points">
                    {Math.round(p48 * 100)}% within 48h
                </span>
            </div>
        </>
    );
}
