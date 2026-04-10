import '@/features/timeline/TimelineSection.css';
import ArchiveEvent from '@/features/archives/ArchiveEvent';
import { groupEventsByDay } from '@/features/timeline/groupEventsByDay.mjs';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';
import { eventKey } from '@/features/archives/eventKey.mjs';

export default function ArchiveEventRail({ events, selectedEventKey, railRef }) {
    if (!events?.length) return null;

    const groups = groupEventsByDay(events, { includeToday: false });

    return (
        <div ref={railRef}>
            <div className="timeline-days">
                {groups.map((group) => {
                    const { wins, losses } = countOutcomes(group.events);
                    return (
                        <div key={group.date} className="timeline-day">
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
                                {group.events.map((event, idx) => (
                                    <div
                                        key={`${group.date}-${event.event_id ?? idx}`}
                                        data-event-key={eventKey(event)}
                                    >
                                        <ArchiveEvent
                                            event={event}
                                            isActive={eventKey(event) === selectedEventKey}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
