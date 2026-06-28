import Link from 'next/link';
import Image from 'next/image';
import factions from '@/shared/enums/factions.mjs';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';
import { eventKey } from '@/shared/utils/game/eventKey.mjs';

/**
 * One cascade rendered as a card inside a CascadeLog season group.
 * Wraps the whole card in a Link to /archives?season=N#cascade.
 *
 * @param {object} props - Component props
 * @param {object} props.cascade - Cascade record with season + findAllCascades output
 * @param {Function} [props.onSelectCascade] - Called with the cascade when the card is clicked.
 */
export default function CascadeLogCard({ cascade, onSelectCascade }) {
    const faction = factions[cascade.factionIndex];
    const start = formatAbsolute(cascade.startTime);
    const end = formatAbsolute(cascade.endTime);
    const duration = formatCompactDuration(cascade.durationSec);

    return (
        <Link
            href={`/archives?season=${cascade.season}#${eventKey(cascade.lastEvent)}`}
            onClick={() => onSelectCascade?.(cascade)}
            data-umami-event="cascade-card-click"
            className="event-log-card-link"
        >
            <div className="event-log-card event-log-card--cascade">
                <div className="event-log-card-row">
                    <span className="event-log-card-title">
                        {faction && (
                            <Image
                                src={faction.icon}
                                alt=""
                                width={16}
                                height={16}
                                className="event-log-card-icon"
                            />
                        )}
                        Defend cascade · {cascade.length} regions
                    </span>
                    <span className="event-log-card-pill">{duration}</span>
                </div>
                <span className="event-log-card-time">
                    Started {start} — Ended {end}
                </span>
                <span
                    className="event-log-card-chain"
                    data-faction={String(cascade.factionIndex)}
                >
                    {cascade.regions.join(' → ')}
                </span>
            </div>
        </Link>
    );
}

function formatAbsolute(unixSeconds) {
    return new Date(unixSeconds * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
    });
}
