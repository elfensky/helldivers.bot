'use client';

import { Fragment, useState } from 'react';
import './TimelineSection.css';
import Event from '@/features/timeline/Event';
import {
    groupEventsByDay,
    formatDayLabel,
} from '@/features/timeline/groupEventsByDay.mjs';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

const SECONDS_PER_DAY = 86400;
const DAY_MS = 86_400_000;
/** Max visual height (px) for a rail block representing a full 24h event */
const RAIL_MAX_HEIGHT = 120;

/** Generate date strings for empty days between two date strings (exclusive). */
function getEmptyDaysBetween(newerDate, olderDate) {
    const days = [];
    const start = new Date(olderDate).getTime();
    let cursor = new Date(newerDate).getTime() - DAY_MS;
    while (cursor > start) {
        const dateStr = new Date(cursor).toISOString().slice(0, 10);
        days.push(dateStr);
        cursor -= DAY_MS;
    }
    return days;
}

/**
 * Event log with vertical timeline rail (desktop only).
 * Groups events by calendar day with empty days filling gaps for proportional spacing.
 * Renders status-colored duration blocks on a rail with proportional vertical positioning.
 * Hovering an event card highlights its corresponding rail block.
 *
 * Reads events from LiveDataContext — updates live as polling delivers new data.
 */
export default function TimelineSection() {
    const { data } = useLiveDataContext();
    const events = data?.events;
    const [hoveredEventId, setHoveredEventId] = useState(null);
    const groups = groupEventsByDay(events ?? []);

    return (
        <section id="event-log" className="timeline-section">
            <div className="timeline-content gutters">
                <h2 className="timeline-heading">Event Log</h2>
                {groups.length === 0 ?
                    <p className="timeline-empty">No events recorded yet.</p>
                :   <div className="timeline-days">
                        {groups.map((group, i) => {
                            const { wins, losses } = countOutcomes(group.events);

                            const thisMs = new Date(group.date).getTime();
                            const nextGroup = groups[i + 1];
                            const gapDays = nextGroup
                                ? Math.round(
                                      (thisMs -
                                          new Date(
                                              nextGroup.date,
                                          ).getTime()) /
                                          DAY_MS,
                                  )
                                : 0;

                            // Block positioning: map time-of-day to vertical %, inverted so top = most recent
                            const chronological = [...group.events].sort(
                                (a, b) => a.start_time - b.start_time,
                            );
                            const times = chronological.map(
                                (e) => e.start_time % 86400,
                            );
                            const minT = Math.min(...times);
                            const maxT = Math.max(...times);
                            const range = maxT - minT;

                            return (
                                <Fragment key={group.date}>
                                    <div
                                        className={`timeline-day${group.events.length === 0 ? ' timeline-day--no-events' : ''}`}
                                    >
                                        <div className="rail" aria-hidden="true">
                                            <div className="rail-circle" />
                                            {chronological.map((event) => {
                                                const t =
                                                    event.start_time % 86400;
                                                const pct =
                                                    range > 0 ?
                                                        ((maxT - t) / range) *
                                                        100
                                                    :   0;
                                                const now = Math.floor(
                                                    Date.now() / 1000,
                                                );
                                                const duration =
                                                    event.status === 'active' ?
                                                        now - event.start_time
                                                    :   event.end_time -
                                                        event.start_time;
                                                const blockHeight = Math.max(
                                                    12,
                                                    (duration /
                                                        SECONDS_PER_DAY) *
                                                        RAIL_MAX_HEIGHT,
                                                );
                                                return (
                                                    <div
                                                        key={event.event_id}
                                                        className={`rail-block rail-block--${event.status}`}
                                                        style={{
                                                            top: `calc(${pct}% - ${(pct * 12) / 100}px)`,
                                                            height: `${blockHeight}px`,
                                                        }}
                                                        data-highlighted={
                                                            (
                                                                hoveredEventId ===
                                                                event.event_id
                                                            ) ?
                                                                ''
                                                            :   undefined
                                                        }
                                                        suppressHydrationWarning
                                                    />
                                                );
                                            })}
                                        </div>
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
                                                    onMouseEnter={() =>
                                                        setHoveredEventId(
                                                            event.event_id,
                                                        )
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredEventId(null)
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    {nextGroup &&
                                        gapDays > 1 &&
                                        getEmptyDaysBetween(
                                            group.date,
                                            nextGroup.date,
                                        ).map((dateStr) => (
                                            <div
                                                key={`empty-${dateStr}`}
                                                className="timeline-day timeline-day--empty"
                                            >
                                                <div
                                                    className="rail"
                                                    aria-hidden="true"
                                                >
                                                    <div className="rail-circle rail-circle--empty" />
                                                </div>
                                                <div className="timeline-day-header">
                                                    <span className="timeline-day-label timeline-day-label--empty">
                                                        {formatDayLabel(
                                                            dateStr,
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </Fragment>
                            );
                        })}
                    </div>
                }
            </div>
        </section>
    );
}
