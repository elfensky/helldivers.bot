'use client';

import { Fragment, useState } from 'react';
import './TimelineSection.css';
import Event from '@/components/h1/Event/Event';
import { groupEventsByDay } from '@/utils/groupEventsByDay.mjs';

/**
 * Event log with vertical timeline rail (desktop only).
 * Groups events by calendar day, renders status-colored dots on a rail
 * with proportional vertical positioning (top = most recent, bottom = oldest).
 * Hovering an event card highlights its corresponding rail dot.
 *
 * @param {{ events: Array<{ event_id: number, start_time: number, end_time: number, status: string, type: string, enemy: number, region: number, points: number, points_max: number }> }} props
 */
export default function TimelineSection({ events }) {
    const [hoveredEventId, setHoveredEventId] = useState(null);
    const groups = groupEventsByDay(events);

    return (
        <section id="event-log" className="timeline-section">
            <div className="timeline-content gutters">
                <h2 className="timeline-heading">Event Log</h2>
                {groups.length === 0 ?
                    <p className="timeline-empty">No events recorded yet.</p>
                :   <div className="timeline-days">
                        {groups.map((group, i) => {
                            const wins = group.events.filter(
                                (e) => e.status === 'success',
                            ).length;
                            const losses = group.events.filter(
                                (e) => e.status === 'fail',
                            ).length;

                            const dayMs = 86_400_000;
                            const thisMs = new Date(group.date).getTime();
                            const prevMs =
                                groups[i - 1] && new Date(groups[i - 1].date).getTime();
                            const nextMs =
                                groups[i + 1] && new Date(groups[i + 1].date).getTime();
                            const gapBefore = prevMs != null && prevMs - thisMs > dayMs;
                            const gapAfter = nextMs != null && thisMs - nextMs > dayMs;

                            // Dot positioning: map time-of-day to vertical %, inverted so top = most recent
                            const chronological = [...group.events].sort(
                                (a, b) => a.start_time - b.start_time,
                            );
                            const times = chronological.map((e) => e.start_time % 86400);
                            const minT = Math.min(...times);
                            const maxT = Math.max(...times);
                            const range = maxT - minT;

                            return (
                                <Fragment key={group.date}>
                                    {gapBefore && (
                                        <div
                                            className="rail-separator"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <div className="timeline-day">
                                        <div className="rail" aria-hidden="true">
                                            <div className="rail-circle" />
                                            {chronological.map((event) => {
                                                const t = event.start_time % 86400;
                                                const pct =
                                                    range > 0 ?
                                                        ((maxT - t) / range) * 100
                                                    :   0;
                                                return (
                                                    <div
                                                        key={event.event_id}
                                                        className={`rail-dot rail-dot--${event.status}`}
                                                        style={{
                                                            top: `calc(${pct}% - ${(pct * 8) / 100}px)`,
                                                        }}
                                                        data-highlighted={
                                                            (
                                                                hoveredEventId ===
                                                                event.event_id
                                                            ) ?
                                                                ''
                                                            :   undefined
                                                        }
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
                                                        setHoveredEventId(event.event_id)
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredEventId(null)
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    {gapAfter && (
                                        <div
                                            className="rail-separator"
                                            aria-hidden="true"
                                        />
                                    )}
                                </Fragment>
                            );
                        })}
                    </div>
                }
            </div>
        </section>
    );
}
