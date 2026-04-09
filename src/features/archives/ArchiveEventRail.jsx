import { useEffect, useRef } from 'react';
import ArchiveEvent from '@/features/archives/ArchiveEvent';

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
    });
}

export default function ArchiveEventRail({ events, selectedEventId, onSelect }) {
    const railRef = useRef(null);

    useEffect(() => {
        const active = railRef.current?.querySelector('.outline-primary');
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedEventId]);

    if (!events?.length) return null;

    const groups = groupByDay(events);

    return (
        <div ref={railRef}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Event Log
            </div>
            <div className="flex flex-col">
                {groups.map((group) => (
                    <div key={group.date}>
                        <div className="mt-2 border-t border-ghost pt-1 font-mono text-[11px] font-bold text-text-muted first:mt-0 first:border-t-0">
                            {formatDayLabel(group.date)}
                        </div>
                        <div className="flex flex-col">
                            {group.events.map((event, idx) => (
                                <div
                                    key={`${group.date}-${event.id ?? idx}`}
                                    className="mt-[-1px]"
                                    data-umami-event="archive-event-select"
                                >
                                    <ArchiveEvent
                                        event={event}
                                        isActive={event.id === selectedEventId}
                                        onClick={() => onSelect(event)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
