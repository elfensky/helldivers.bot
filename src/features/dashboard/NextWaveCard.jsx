'use client';

import Image from 'next/image';
import Link from 'next/link';
import '@/features/galaxy/EventCard.css';
import { dayOf } from '@/shared/utils/game/warClock.mjs';

/**
 * @param {number} p25 hours
 * @param {number} p75 hours
 * @returns {string} e.g. "14–32h"
 */
function formatRange(p25, p75) {
    return `${Math.round(p25)}–${Math.round(p75)}h`;
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
 * Live likelihood window for the next defend wave, rendered in the same
 * sector-card skeleton as the faction cards (EventCard.css — imported
 * directly so the classes don't depend on an EventCard rendering first).
 * Band, never a countdown: the range is the calibrated 50% band and the
 * meta row carries the reliability-checked within-24h/48h probabilities
 * from waveModel.mjs.
 *
 * @param {object} props
 * @param {ReturnType<typeof import('./waveForecast.mjs').waveForecast>} props.forecast
 * @param {number | null} props.warStart unix seconds anchor for war-day labels
 * @param {number} props.now unix seconds
 */
export default function NextWaveCard({ forecast, warStart, now }) {
    if (forecast?.mode !== 'window') return null;

    const { p25, p75, p24, p48, imminent, runningLong } = forecast;
    const from = now + p25 * 3600;
    const to = now + p75 * 3600;
    const warDays =
        warStart != null ?
            ` · War Day ${dayOf(from, warStart)}–${dayOf(to, warStart)}`
        :   '';
    const title =
        `${localTime(from)} – ${localTime(to)} (your time)${warDays}` +
        ` · likely window (50% band) · typical miss ±8h` +
        (runningLong ?
            ' · a faction is 1 sector from homeworld assault — waves pause in this window'
        :   '');

    const axisHours = Math.max(48, Math.ceil(p75 / 12) * 12);
    const range = formatRange(p25, p75);
    const state =
        [runningLong && 'RUNNING LONG', imminent && 'IMMINENT']
            .filter(Boolean)
            .join(' · ') || null;

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
                    <Image src="/icons/superearth.webp" alt="" width={16} height={16} />
                    <span
                        className="sector-card-action"
                        style={{ color: 'var(--color-primary)' }}
                    >
                        Predicted
                    </span>
                    <span className="sector-card-title">Wave</span>
                    <Link
                        href="/docs/predict"
                        data-umami-event="dashboard-wave-window-docs"
                        aria-label="How is this computed?"
                        title="How is this computed?"
                        className="ml-auto font-mono text-small text-text-muted no-underline"
                    >
                        ⓘ
                    </Link>
                </div>
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
                        aria-label={`Next wave likely in ${range}`}
                    >
                        <div
                            className="sector-card-bar-fill"
                            style={{
                                marginLeft: `${(p25 / axisHours) * 100}%`,
                                width: `${((p75 - p25) / axisHours) * 100}%`,
                                background: 'var(--color-primary)',
                            }}
                        />
                    </div>
                    <span
                        className="sector-card-pct"
                        title={title}
                        suppressHydrationWarning
                    >
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
            </div>
            <div className="sector-card-accent" />
        </div>
    );
}
