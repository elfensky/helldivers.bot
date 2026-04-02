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
                        {groups.map((group, i) => {
                            const wins = group.events.filter(
                                (e) => e.status === 'success',
                            ).length;
                            const losses = group.events.filter(
                                (e) => e.status === 'fail',
                            ).length;

                            const dayMs = 86_400_000;
                            const thisMs = new Date(group.date).getTime();
                            const prevMs = groups[i - 1] && new Date(groups[i - 1].date).getTime();
                            const nextMs = groups[i + 1] && new Date(groups[i + 1].date).getTime();
                            const gapBefore = prevMs != null && prevMs - thisMs > dayMs;
                            const gapAfter = nextMs != null && thisMs - nextMs > dayMs;

                            return (
                                <div key={group.date} className="timeline-day">
                                    <div
                                        className="timeline-day-rail"
                                        aria-hidden="true"
                                    >
                                        {gapBefore && <div className="rail-separator" />}
                                        {group.events.map((event) => (
                                            <div
                                                key={event.event_id}
                                                className={`rail-dot rail-dot--${event.status}`}
                                            />
                                        ))}
                                        {gapAfter && <div className="rail-separator" />}
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
