'use client';

import { Fragment } from 'react';
import './EventLog.css';
import EventLogCard from '@/features/timeline/EventLogCard';
import EventLogSortToggle from '@/features/timeline/EventLogSortToggle';
import { useEventLogSort } from '@/features/timeline/useEventLogSort.mjs';
import { groupEventsByDay } from '@/features/timeline/groupEventsByDay.mjs';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';
import { eventKey } from '@/shared/utils/game/eventKey.mjs';

/**
 * Unified event log, shared between the homepage (`/`) and the archives
 * scrollytelling section (`/archives`). Groups events by day and renders
 * them as `EventLogCard`s. Does NOT render the vertical timeline rail —
 * that was removed; the archives page remains the place to go for
 * scrubbing a timeline visually.
 *
 * Props:
 * - `events`: full event list, unsorted
 * - `timeFormat`: `'live'` for homepage (ticking relative time) or
 *   `'absolute'` for archives (static absolute date/time)
 * - `title`: heading text (defaults to "Event Log")
 * - `id`: DOM id on the section wrapper, used by anchor-scroll
 * - `selectedEventKey` (optional): highlight the card matching this key
 * - `onHoverEvent` (optional): called with `(event)` on card hover
 * - `railRef` (optional): forwarded to the scrolling container so
 *   `useScrollEvent` on `/archives` can query `[data-event-key]` cards
 * - `layout` (optional, default `'grid'`): `'grid'` renders the
 *   desktop multi-column layout at ≥md. `'stack'` forces a single
 *   vertical column regardless of viewport width — required by the
 *   archives scrollytelling flow because `useScrollEvent`'s DOM-order
 *   optimization only works on a single column.
 */
export default function EventLog({
    events,
    timeFormat,
    title = 'Event Log',
    id = 'event-log',
    initialSortOrder,
    selectedEventKey = null,
    onHoverEvent,
    railRef,
    layout = 'grid',
}) {
    const [sortOrder, toggleSortOrder] = useEventLogSort(initialSortOrder);
    const groups = groupEventsByDay(events ?? [], { sortOrder });

    return (
        <section id={id} className="event-log-section">
            <div className="event-log-content">
                <div className="event-log-header">
                    <h2 className="event-log-heading">{title}</h2>
                    <EventLogSortToggle
                        sortOrder={sortOrder}
                        onToggle={toggleSortOrder}
                    />
                </div>

                {groups.length === 0 ?
                    <p className="event-log-empty">No events recorded yet.</p>
                :   <div
                        className={
                            layout === 'stack' ?
                                'event-log-days event-log-days--stack'
                            :   'event-log-days'
                        }
                        ref={railRef}
                    >
                        {groups.map((group) => {
                            const { wins, losses } = countOutcomes(group.events);
                            return (
                                <Fragment key={group.date}>
                                    <div className="event-log-day">
                                        <div className="event-log-day-header">
                                            <span className="event-log-day-label">
                                                {group.label}
                                            </span>
                                            {(wins > 0 || losses > 0) && (
                                                <span className="event-log-day-summary">
                                                    {wins}W / {losses}L
                                                </span>
                                            )}
                                        </div>
                                        <div className="event-log-day-grid">
                                            {group.events.map((event) => {
                                                const key = eventKey(event);
                                                return (
                                                    <div
                                                        key={`${group.date}-${event.event_id}`}
                                                        data-event-key={key}
                                                    >
                                                        <EventLogCard
                                                            event={event}
                                                            timeFormat={timeFormat}
                                                            isSelected={
                                                                key === selectedEventKey
                                                            }
                                                            onMouseEnter={
                                                                onHoverEvent ?
                                                                    () =>
                                                                        onHoverEvent(
                                                                            event,
                                                                        )
                                                                :   undefined
                                                            }
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Fragment>
                            );
                        })}
                    </div>
                }
            </div>
        </section>
    );
}
