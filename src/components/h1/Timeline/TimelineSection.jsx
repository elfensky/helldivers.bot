import './TimelineSection.css';
import Event from '@/components/h1/Event/Event';
import { groupEventsByDay } from '@/utils/groupEventsByDay.mjs';

export default function TimelineSection({ events }) {
    const groups = groupEventsByDay(events);

    return (
        <section id="event-log" className="timeline-section">
            <div className="timeline-content gutters">
                <h2 className="timeline-heading">Event Log</h2>
                {groups.length === 0 ? (
                    <p className="timeline-empty">No events recorded yet.</p>
                ) : (
                    <div className="timeline-days">
                        {groups.map((group) => {
                            const wins = group.events.filter(
                                (e) => e.status === 'success',
                            ).length;
                            const losses = group.events.filter(
                                (e) => e.status === 'fail',
                            ).length;

                            return (
                                <div key={group.date} className="timeline-day">
                                    <div
                                        className="timeline-day-rail"
                                        aria-hidden="true"
                                    >
                                        <div className="rail-circle" />
                                        {group.events.map((event) => (
                                            <div
                                                key={event.event_id}
                                                className={`rail-block rail-block--${event.status}`}
                                            />
                                        ))}
                                        <div className="rail-connector" />
                                    </div>
                                    <div className="timeline-day-content">
                                        <div className="timeline-day-header">
                                            <span className="timeline-day-label">
                                                {group.label}
                                            </span>
                                            {(wins > 0 || losses > 0) && (
                                                <span className="timeline-day-summary">
                                                    {wins}W / {losses}L
                                                </span>
                                            )}
                                        </div>
                                        <div className="timeline-day-grid">
                                            {group.events.map((event) => (
                                                <Event
                                                    key={event.event_id}
                                                    event={event}
                                                    compact
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
