import './Alerts.css';
import factions from '@/enums/factions.mjs';
import { evaluateProgress } from '@/utils/evaluateProgress.mjs';
import humanizeDuration from 'humanize-duration';

export default function Alerts({ data }) {
    const active = data?.events
        ?.filter((e) => e.status === 'active')
        ?.sort((a, b) => a.end_time - b.end_time);

    if (!active?.length) return null;

    return (
        <ul className="alerts list-none p-0">
            {active.map((event) => (
                <li key={event.event_id}>
                    <Alert event={event} />
                </li>
            ))}
        </ul>
    );
}

function Alert({ event }) {
    const remaining = event.end_time - Math.floor(Date.now() / 1000);
    const percent = ((event.points / event.points_max) * 100).toFixed(1);
    const faction = factions[event.enemy];
    const progress = evaluateProgress(event)?.label;
    const timeText =
        remaining > 0 ?
            `Due in ${humanizeDuration(remaining * 1000, { largest: 2, round: true })}`
        :   'Expired';

    return (
        <div className="alert-banner">
            <div className="alert-banner-header">
                <span className="alert-banner-type">Active {event.type} Event</span>
                {faction && (
                    <img
                        src={faction.icon}
                        alt={faction.name}
                        className="alert-banner-icon"
                    />
                )}
            </div>
            <div className="alert-banner-body">
                {faction?.name}: {event.points}/{event.points_max} ({percent}%)
                {progress && ` — ${progress}`}
            </div>
            <div className="alert-banner-time">{timeText}</div>
            <div
                className="alert-banner-bar"
                role="progressbar"
                aria-valuenow={Math.min(100, parseFloat(percent))}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="alert-banner-bar-fill"
                    style={{ width: `${Math.min(100, percent)}%` }}
                />
            </div>
        </div>
    );
}
