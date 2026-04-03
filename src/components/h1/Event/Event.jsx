import factions from '@/enums/factions.mjs';
import map from '@/enums/map.mjs';
import { evaluateProgress } from '@/utils/evaluateProgress.mjs';
import humanizeDuration from 'humanize-duration';
import { EVENT_TYPE } from '@/enums/events';

const STATUS_STYLES = {
    success: {
        bg: 'bg-[rgba(0,20,0,0.4)]',
        border: 'border-ghost',
        accent: 'bg-success',
    },
    fail: {
        bg: 'bg-[rgba(40,0,0,0.5)]',
        border: 'border-ghost',
        accent: 'bg-danger',
    },
    active: {
        bg: 'bg-surface-1',
        border: 'border-primary',
        accent: 'bg-primary',
    },
};

const TYPE_BG = {
    [EVENT_TYPE.DEFEND]: 'bg-[rgba(40,0,0,0.4)]',
    [EVENT_TYPE.ATTACK]: 'bg-[rgba(0,20,0,0.3)]',
};

const PACE_COLORS = {
    ahead: 'var(--color-success)',
    behind: 'var(--color-danger)',
    on_track: '#ffffff',
};

/**
 * Event card with status-colored accent bar and optional progress display.
 * Compact mode hides the progress bar for resolved events in the timeline.
 *
 * @param {{ event: object, compact?: boolean, onMouseEnter?: () => void, onMouseLeave?: () => void }} props
 */
export default function Event({ event, compact = false, onMouseEnter, onMouseLeave }) {
    const remaining = event.end_time - Math.floor(Date.now() / 1000);
    const percent = ((event.points / event.points_max) * 100).toFixed(2);
    const progress = evaluateProgress(event);
    const faction = factions[event.enemy];

    const timeText =
        remaining > 0 ?
            `Due in ${humanizeDuration(remaining * 1000, { largest: 2, round: true })}`
        :   `Finished ${humanizeDuration(Math.abs(remaining) * 1000, { largest: 2, round: true })} ago`;

    const statusText =
        event.status === 'success' ? 'Won'
        : event.status === 'fail' ? 'Failed'
        : 'Active';

    const isResolved = event.status !== 'active';
    const showCompact = compact && isResolved;
    const s = STATUS_STYLES[event.status] || STATUS_STYLES.active;
    const typeBg = TYPE_BG[event.type] || '';

    return (
        <article
            className={`grid grid-cols-[1fr_6px] border border-r-0 ${s.border} ${s.bg || typeBg}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div
                className={`flex flex-col gap-1 ${showCompact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
            >
                <div className="flex items-center justify-between">
                    <span className="font-body text-xs font-bold text-text uppercase">
                        {statusText} {event.type} Event
                    </span>
                    {faction && (
                        <img src={faction.icon} alt={faction.name} className="size-5" />
                    )}
                </div>
                <div className="flex items-baseline justify-between text-[0.6875rem]">
                    <span className="text-text-muted">{timeText}</span>
                    {!showCompact && progress && (
                        <span style={{ color: PACE_COLORS[progress.status] }}>
                            {progress.label}
                        </span>
                    )}
                </div>
                {!showCompact && (
                    <div className="h-1.5 w-full bg-danger">
                        <div
                            className="h-full bg-primary"
                            style={{ width: `${Math.min(100, percent)}%` }}
                        />
                    </div>
                )}
                <div
                    className={`font-mono text-text-muted ${showCompact ? 'text-[0.5rem]' : 'text-[0.5625rem]'}`}
                >
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
