import { useEffect, useRef } from 'react';
import '@/features/timeline/TimelineSection.css';
import ArchiveEvent from '@/features/archives/ArchiveEvent';
import { groupEventsByDay } from '@/features/timeline/groupEventsByDay.mjs';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';
import { eventKey } from '@/features/archives/eventKey.mjs';

export default function ArchiveEventRail({ events, selectedEventKey, onSelect }) {
    const railRef = useRef(null);

    useEffect(() => {
        const active = railRef.current?.querySelector('.border-l-primary');
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedEventKey]);

    if (!events?.length) return null;

    const groups = groupEventsByDay(events, { includeToday: false });

    return (
        <div ref={railRef}>
            <h2 className="timeline-heading mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Event Log
            </h2>
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
                                    <ArchiveEvent
                                        key={`${group.date}-${event.event_id ?? idx}`}
                                        event={event}
                                        isActive={eventKey(event) === selectedEventKey}
                                        onClick={() => onSelect(event)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
