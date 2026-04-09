import { useEffect, useRef } from 'react';
import './ArchiveEventRail.css';
import map from '@/shared/enums/map.mjs';

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

function durationHours(event) {
    return Math.max(1, (event.end_time - event.start_time) / 3600);
}

export default function ArchiveEventRail({ events, selectedEventId, onSelect }) {
    if (!events?.length) return null;

    const railRef = useRef(null);
    const maxDuration = Math.max(...events.map(durationHours));
    const groups = groupByDay(events);

    useEffect(() => {
        const active = railRef.current?.querySelector('.archive-rail-event--active');
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedEventId]);

    return (
        <div ref={railRef}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Event Log
            </div>
            {groups.map((group) => (
                <div key={group.date}>
                    <div className="archive-rail-day-label">{formatDayLabel(group.date)}</div>
                    {group.events.map((event) => {
                        const isActive = event.id === selectedEventId;
                        const regionName = map[event.enemy]?.[event.region]?.region ?? 'Unknown';
                        const widthPercent = (durationHours(event) / maxDuration) * 100;
                        const isWon = event.status === 'success';

                        return (
                            <button
                                key={event.id}
                                type="button"
                                className={`archive-rail-event ${isActive ? 'archive-rail-event--active' : ''}`}
                                onClick={() => onSelect(event)}
                                data-umami-event="archive-event-select"
                            >
                                <div
                                    className={`archive-rail-bar archive-rail-bar--${event.type}`}
                                    style={{
                                        width: `max(24px, ${widthPercent.toFixed(1)}%)`,
                                    }}
                                />
                                <span
                                    className={`archive-rail-label ${isActive ? 'archive-rail-label--active' : ''}`}
                                >
                                    {regionName}
                                </span>
                                <span
                                    className={`archive-rail-result ${isWon ? 'archive-rail-result--won' : 'archive-rail-result--lost'}`}
                                >
                                    {isWon ? 'W' : 'L'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
