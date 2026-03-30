import './TimelineSection.css';
import Event from '@/components/h1/Event/Event';
import { groupEventsByDay } from '@/utils/groupEventsByDay.mjs';

export default function TimelineSection({ events }) {
    const groups = groupEventsByDay(events);

    if (groups.length === 0) return null;

    return (
        <section className="timeline-section">
            <div className="timeline-content gutters">
                <h2 className="timeline-heading">Event Log</h2>
                <div className="timeline-rail">
                    <div className="rail-line" aria-hidden="true">
                        {events
                            .sort((a, b) => b.start_time - a.start_time)
                            .map((event) => (
                                <span
                                    key={event.event_id}
                                    className={`rail-dot rail-dot--${event.status}`}
                                />
                            ))}
                    </div>
                    <div className="timeline-groups">
                        {groups.map((group) => (
                            <div key={group.date} className="timeline-day">
                                <h3 className="timeline-day-label">{group.label}</h3>
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
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
