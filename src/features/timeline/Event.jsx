import factions from '@/shared/enums/factions.mjs';
import map from '@/shared/enums/map.mjs';
import humanizeDuration from 'humanize-duration';
import { EVENT_TYPE } from '@/shared/enums/events';

const STATUS_STYLES = {
    success: {
        bg: 'bg-success-tint/40',
        border: 'border-ghost',
        accent: 'bg-success',
    },
    fail: {
        bg: 'bg-danger-tint/50',
        border: 'border-ghost',
        accent: 'bg-danger',
    },
    active: {
        bg: 'bg-primary-tint/40',
        border: 'border-ghost',
        accent: 'bg-primary',
    },
};

/**
 * Event card with status-colored accent bar.
 * Three types: won (green), lost (red), active (gold).
 */
export default function Event({ event, onMouseEnter, onMouseLeave }) {
    const elapsed = Math.floor(Date.now() / 1000) - event.start_time;
    const percent = ((event.points / event.points_max) * 100).toFixed(2);
    const faction = factions[event.enemy];

    const timeText = `Started ${humanizeDuration(elapsed * 1000, { largest: 2, round: true })} ago`;

    const statusText =
        event.status === 'success' ? 'Won'
        : event.status === 'fail' ? 'Failed'
        : 'Active';

    const s = STATUS_STYLES[event.status] || STATUS_STYLES.active;

    return (
        <article
            className={`grid grid-cols-[minmax(0,1fr)_6px] border border-r-0 ${s.border} ${s.bg}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="flex flex-col gap-1 px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                    <span className="font-body text-xs font-bold text-text uppercase">
                        {statusText} {event.type} Event
                    </span>
                    {faction && (
                        <img src={faction.icon} alt={faction.name} className="size-5" />
                    )}
                </div>
                <span
                    className="text-[0.6875rem] text-text-muted"
                    suppressHydrationWarning
                >
                    {timeText}
                </span>
                <div className="font-mono text-[0.5rem] text-text-muted">
                    {event.points} / {event.points_max} ({percent}%)
                </div>
            </div>
            <div className={s.accent} />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(schema(event, event.type)),
                }}
            />
        </article>
    );
}

function schema(event, type) {
    if (type === EVENT_TYPE.ATTACK) {
        const capital = map[event.enemy][11].capital;
        return {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: `Attacking ${capital}`,
            image: ['https://helldivers.bot/icons/attack.webp'],
        };
    }
    if (type === EVENT_TYPE.DEFEND) {
        const enemy = event.region === 0 ? 3 : event.enemy;
        const capital = map[enemy][event.region].capital;
        const region = map[enemy][event.region].region;
        const faction = factions[enemy].name;

        return {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: `Defend ${capital}`,
            description: `Cowardly ${faction} has attacked the innocent city of ${capital} in the ${region}. Get together and defend against this xeno threat!`,
            startDate: new Date(event.start_time * 1000),
            endDate: new Date(event.end_time * 1000),
            image: ['https://helldivers.bot/icons/defend.webp'],
            organizer: {
                '@type': 'Organization',
                name: `${faction}`,
                url: `${factions[enemy].url}`,
            },
            offers: {
                '@type': 'Offer',
                url: 'https://helldivers.bot/campaign',
                price: 0,
                priceCurrency: 'EUR',
                availability: 'https://schema.org/InStock',
                validFrom: new Date(event.start_time * 1000),
            },
        };
    }
}
