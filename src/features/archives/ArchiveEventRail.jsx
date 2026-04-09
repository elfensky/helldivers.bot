import { useEffect, useRef } from 'react';
import '@/features/timeline/TimelineSection.css';
import ArchiveEvent from '@/features/archives/ArchiveEvent';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';

function groupByDay(events) {
    const sorted = [...events].sort((a, b) => a.start_time - b.start_time);
    const groups = [];
    let currentDate = null;
    let currentGroup = null;

    for (const event of sorted) {
        const date = new Date(event.start_time * 1000).toISOString().slice(0, 10);
        if (date !== currentDate) {
            currentDate = date;
            currentGroup = { date, events: [] };
            groups.push(currentGroup);
        }
        currentGroup.events.push(event);
    }
    return groups;
}

function formatDayLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
    }).toUpperCase();
}

export default function ArchiveEventRail({ events, selectedEventId, onSelect }) {
    const railRef = useRef(null);

    useEffect(() => {
        const active = railRef.current?.querySelector('.border-l-primary');
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedEventId]);

    if (!events?.length) return null;

    const groups = groupByDay(events);

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
                                    {formatDayLabel(group.date)}
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
                                        key={`${group.date}-${event.id ?? idx}`}
                                        event={event}
                                        isActive={event.id === selectedEventId}
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
