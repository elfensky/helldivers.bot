import { useState, useEffect } from 'react';
import humanizeDuration from 'humanize-duration';
import factions from '@/shared/enums/factions.mjs';
import map from '@/shared/enums/map.mjs';
import { EVENT_TYPE } from '@/shared/enums/events';
import EventCardLayout, { STATUS_STYLES } from '@/features/timeline/EventCardLayout';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';
import { getEventActionLabel } from '@/shared/utils/game/getEventActionLabel.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';

/**
 * Unified event log card. Replaces both the live dashboard `Event.jsx` and
 * the historical `ArchiveEvent.jsx`.
 *
 * `timeFormat` controls the secondary time line:
 * - `'live'`    → ticking relative text ("Started 2 hours ago" / "Ended 3 days ago")
 * - `'absolute'` → static absolute date/time ("Mar 3, 2026 · 14:23")
 *
 * Everything else (region, action label, points progress, duration pill,
 * faction icon, status styling, JSON-LD) is identical across both modes.
 */
export default function EventLogCard({
    event,
    timeFormat,
    isSelected = false,
    onMouseEnter,
    onMouseLeave,
}) {
    const isCompleted = event.status === 'success' || event.status === 'fail';
    const actionLabel = getEventActionLabel(event);
    const regionLabel = getEventRegionLabel(event);
    const percent = ((event.points / event.points_max) * 100).toFixed(2);
    const faction = factions[event.enemy];
    const s = STATUS_STYLES[event.status] || STATUS_STYLES.active;
    const jsonLdString = JSON.stringify(schema(event, event.type));

    return (
        <EventCardLayout
            status={event.status}
            className={
                isSelected ? 'border-l-[4px] border-l-primary !bg-primary-tint' : ''
            }
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="flex flex-col gap-1 px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-body text-small font-bold text-text uppercase">
                        {actionLabel} {regionLabel}
                    </span>
                    <DurationPill event={event} styles={s} timeFormat={timeFormat} />
                    {faction && (
                        <img src={faction.icon} alt={faction.name} className="size-5" />
                    )}
                </div>
                <TimeLine
                    event={event}
                    timeFormat={timeFormat}
                    isCompleted={isCompleted}
                />
                <div className="font-mono text-small text-text-muted">
                    {event.points} / {event.points_max} ({percent}%)
                </div>
            </div>
            <JsonLdSchema jsonLd={jsonLdString} />
        </EventCardLayout>
    );
}

/**
 * Compact duration pill. In `live` mode the duration ticks for active
 * events; in `absolute` mode it shows the final duration (end − start)
 * even for active events, since there's no clock to tick against.
 */
function DurationPill({ event, styles, timeFormat }) {
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
    const isCompleted = event.status === 'success' || event.status === 'fail';
    const shouldTick = timeFormat === 'live' && !isCompleted;

    useEffect(() => {
        if (!shouldTick) return;
        const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(id);
    }, [shouldTick]);

    const duration =
        isCompleted || timeFormat === 'absolute' ?
            event.end_time - event.start_time
        :   now - event.start_time;

    return (
        <span
            className={`px-1.5 py-px font-mono text-[10px] ${styles.pill}`}
            suppressHydrationWarning
        >
            {formatCompactDuration(duration)}
        </span>
    );
}

/**
 * Secondary time line — either live "Started/Ended X ago" (ticks every
 * second) or a static absolute date/time like "Mar 3, 2026 · 14:23".
 */
function TimeLine({ event, timeFormat, isCompleted }) {
    if (timeFormat === 'absolute') {
        const ts = isCompleted ? event.end_time : event.start_time;
        const formatted = new Date(ts * 1000).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const prefix = isCompleted ? 'Ended' : 'Started';
        return (
            <span className="text-small text-text-muted">
                {prefix} {formatted}
            </span>
        );
    }

    return <LiveTimeLine event={event} isCompleted={isCompleted} />;
}

function LiveTimeLine({ event, isCompleted }) {
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

    useEffect(() => {
        const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(id);
    }, []);

    const elapsed = isCompleted ? now - event.end_time : now - event.start_time;
    const text =
        isCompleted ?
            `Ended ${humanizeDuration(elapsed * 1000, { largest: 2, round: true })} ago`
        :   `Started ${humanizeDuration(elapsed * 1000, { largest: 2, round: true })} ago`;

    return (
        <span className="text-small text-text-muted" suppressHydrationWarning>
            {text}
        </span>
    );
}

// Structured data <script> rendered via a stub that gets its innerHTML
// replaced on insertion. Trusted content (JSON.stringify of DB fields);
// no user input, no XSS surface. Extracted into its own component purely
// to keep the main render tree free of dangerouslySetInnerHTML noise.
function JsonLdSchema({ jsonLd }) {
    return (
        <script
            type="application/ld+json"
            suppressHydrationWarning
            ref={(el) => {
                if (el && el.textContent !== jsonLd) el.textContent = jsonLd;
            }}
        />
    );
}

function schema(event, type) {
    if (type === EVENT_TYPE.ATTACK) {
        const { capital, region } = map[event.enemy][11];
        const faction = factions[event.enemy].name;
        return {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: `Attacking ${capital}`,
            description: `The Helldivers have launched an assault on ${capital} in the ${region}. Join the fight to liberate this sector from ${faction} control!`,
            startDate: new Date(event.start_time * 1000),
            endDate: new Date(event.end_time * 1000),
            image: ['https://helldivers.bot/icons/attack.webp'],
            location: {
                '@type': 'VirtualLocation',
                url: 'https://helldivers.bot',
                name: `${capital}, ${region}`,
            },
            eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
            eventStatus: 'https://schema.org/EventScheduled',
            performer: { '@type': 'PerformingGroup', name: 'Helldivers' },
            organizer: {
                '@type': 'Organization',
                name: factions[3].name,
                url: factions[3].url,
            },
            offers: {
                '@type': 'Offer',
                url: 'https://helldivers.bot',
                price: 0,
                priceCurrency: 'EUR',
                availability: 'https://schema.org/InStock',
                validFrom: new Date(event.start_time * 1000),
            },
        };
    }
    if (type === EVENT_TYPE.DEFEND) {
        const enemy = event.region === 0 ? 3 : event.enemy;
        const { capital, region } = map[enemy][event.region];
        const faction = factions[enemy].name;
        return {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: `Defend ${capital}`,
            description: `Cowardly ${faction} has attacked the innocent city of ${capital} in the ${region}. Get together and defend against this xeno threat!`,
            startDate: new Date(event.start_time * 1000),
            endDate: new Date(event.end_time * 1000),
            image: ['https://helldivers.bot/icons/defend.webp'],
            location: {
                '@type': 'VirtualLocation',
                url: 'https://helldivers.bot',
                name: `${capital}, ${region}`,
            },
            eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
            eventStatus: 'https://schema.org/EventScheduled',
            performer: { '@type': 'PerformingGroup', name: faction },
            organizer: {
                '@type': 'Organization',
                name: faction,
                url: factions[enemy].url,
            },
            offers: {
                '@type': 'Offer',
                url: 'https://helldivers.bot',
                price: 0,
                priceCurrency: 'EUR',
                availability: 'https://schema.org/InStock',
                validFrom: new Date(event.start_time * 1000),
            },
        };
    }
}
