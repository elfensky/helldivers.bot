import './Event.css';
import factions from '@/enums/factions.mjs';
import map from '@/enums/map.mjs';
import { evaluateProgress } from '@/utils/evaluateProgress.mjs';
import humanizeDuration from 'humanize-duration';

export default function Event({ event }) {
    const remaining = event.end_time - Math.floor(Date.now() / 1000);
    const percent = ((event.points / event.points_max) * 100).toFixed(2);
    const progress = evaluateProgress(event);
    const faction = factions[event.enemy];
    const isDefend = event.type === 'defend';

    const timeText =
        remaining > 0 ?
            `Due in ${humanizeDuration(remaining * 1000, { largest: 2, round: true })}`
        :   `Finished ${humanizeDuration(Math.abs(remaining) * 1000, { largest: 2, round: true })} ago`;

    const statusText =
        event.status === 'success' ? 'Won'
        : event.status === 'fail' ? 'Failed'
        : 'Active';

    return (
        <article
            className={`event-card ${isDefend ? 'event-card--defend' : 'event-card--attack'} event-card--${event.status}`}
        >
            <div className="event-card-content">
                <div className="event-card-header">
                    <span className="event-card-meta">
                        {statusText} {event.type} Event
                    </span>
                    {faction && (
                        <img
                            src={faction.icon}
                            alt={faction.name}
                            className="event-card-faction-icon"
                        />
                    )}
                </div>
                <div className="event-card-time">{timeText}</div>
                {progress && <div className="event-card-progress-text">{progress}</div>}
                <div className="event-card-bar-track">
                    <div
                        className="event-card-bar-fill"
                        style={{ width: `${Math.min(100, percent)}%` }}
                    />
                </div>
                <div className="event-card-points">
                    {event.points} / {event.points_max} ({percent}%)
                </div>
            </div>
            <div className="event-card-accent" />
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
    if (type === 'attack') {
        const capital = map[event.enemy][11].capital;
        return {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: `Attacking ${capital}`,
            image: ['https://helldivers.bot/icons/attack.webp'],
        };
    }
    if (type === 'defend') {
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
