'use client';

import Link from 'next/link';
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
 * Live likelihood window for the next defend wave. Band, never a countdown:
 * copy always says "likely", numbers are the calibrated 50% band and the
 * reliability-checked within-24h probability from waveModel.mjs.
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
    const title = `${localTime(from)} – ${localTime(to)} (your time)${warDays} · ${Math.round(p48 * 100)}% within 48h · typical miss ±8h`;

    const axisHours = Math.max(48, Math.ceil(p75 / 12) * 12);
    const left = `${(p25 / axisHours) * 100}%`;
    const width = `${((p75 - p25) / axisHours) * 100}%`;

    // Inline: the unlayered .card border rule beats Tailwind's layered border utilities, so border-r-* classes silently lose the cascade here.
    return (
        <div
            className="card p-3"
            style={{ borderRight: 'var(--card-accent-width) solid var(--color-primary)' }}
            suppressHydrationWarning
        >
            <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-small tracking-widest text-text-muted">
                    NEXT DEFEND WAVE
                </span>
                <span className="flex items-center gap-2">
                    {imminent && (
                        <span className="border border-primary px-1 font-mono text-small text-primary">
                            IMMINENT
                        </span>
                    )}
                    {runningLong && (
                        <span className="border border-warning px-1 font-mono text-small text-warning">
                            RUNNING LONG
                        </span>
                    )}
                    <Link
                        href="/docs/predict"
                        data-umami-event="dashboard-wave-window-docs"
                        className="font-mono text-small text-text-muted underline"
                    >
                        how?
                    </Link>
                </span>
            </div>
            <p className="mt-1 mb-1! text-body">
                likely in{' '}
                <b
                    className="font-mono text-primary"
                    title={title}
                    suppressHydrationWarning
                >
                    {formatRange(p25, p75)}
                </b>{' '}
                <span className="text-text-muted">
                    · {Math.round(p24 * 100)}% within 24h
                </span>
            </p>
            <div className="relative h-2 bg-surface-3">
                <span
                    className="absolute inset-y-0 bg-primary opacity-85"
                    style={{ left, width }}
                />
            </div>
            {runningLong && (
                <p className="mt-1 mb-0! font-mono text-small text-text-muted">
                    A faction is 1 sector from homeworld assault — waves pause in this
                    window
                </p>
            )}
        </div>
    );
}
