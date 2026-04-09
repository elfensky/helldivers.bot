import factions from '@/shared/enums/factions.mjs';
import map from '@/shared/enums/map.mjs';
import humanizeDuration from 'humanize-duration';
import { EVENT_TYPE } from '@/shared/enums/events';
import EventCardLayout, { STATUS_STYLES } from '@/features/timeline/EventCardLayout';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

/**
 * Live event card for the dashboard timeline.
 * Shows live elapsed time, points progress, and JSON-LD structured data.
 */
export default function Event({ event, onMouseEnter, onMouseLeave }) {
    const now = Math.floor(Date.now() / 1000);
    const isCompleted = event.status === 'success' || event.status === 'fail';
    const elapsed = isCompleted ? now - event.end_time : now - event.start_time;
    const duration =
        isCompleted ? event.end_time - event.start_time : now - event.start_time;
    const percent = ((event.points / event.points_max) * 100).toFixed(2);
    const faction = factions[event.enemy];

    const timeText =
        isCompleted ?
            `Ended ${humanizeDuration(elapsed * 1000, { largest: 2, round: true })} ago`
        :   `Started ${humanizeDuration(elapsed * 1000, { largest: 2, round: true })} ago`;

    const statusText =
        event.status === 'success' ? 'Won'
        : event.status === 'fail' ? 'Failed'
        : 'Active';

    const s = STATUS_STYLES[event.status] || STATUS_STYLES.active;

    return (
        <EventCardLayout
            status={event.status}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="flex flex-col gap-1 px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                    <span className="font-body text-small font-bold text-text uppercase">
                        {statusText} {event.type} Event
                    </span>
                    <span
                        className={`px-1.5 py-px font-mono text-[10px] ${s.pill}`}
                        suppressHydrationWarning
                    >
                        {formatCompactDuration(duration)}
                    </span>
                    {faction && (
                        <img src={faction.icon} alt={faction.name} className="size-5" />
                    )}
                </div>
                <span className="text-small text-text-muted" suppressHydrationWarning>
                    {timeText}
                </span>
                <div className="font-mono text-small text-text-muted">
                    {event.points} / {event.points_max} ({percent}%)
                </div>
            </div>
            {/* JSON-LD structured data — content is derived from trusted DB fields, not user input */}
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger -- trusted server-side DB data
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(schema(event, event.type)),
                }}
            />
        </EventCardLayout>
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
