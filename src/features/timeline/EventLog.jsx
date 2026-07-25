'use client';

import { Fragment } from 'react';
import './EventLog.css';
import EventLogCard from '@/features/timeline/EventLogCard';
import SortToggle from '@/features/timeline/SortToggle';
import { useEventLogSort } from '@/features/timeline/useEventLogSort.mjs';
import { groupEventsByDay } from '@/features/timeline/groupEventsByDay.mjs';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';
import { eventKey } from '@/shared/utils/game/eventKey.mjs';
import { FACTION_SLUG_BY_ID } from '@/shared/enums/factions.mjs';

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
 * - `highlightedKeys` (optional): a `Set` of `eventKey` strings; matching
 *   cards get `data-highlighted` for the cascade deep-link faction tint
 * - `onHoverEvent` (optional): called with `(event)` on card hover
 * - `railRef` (optional): forwarded to the scrolling container so
 *   `useScrollEvent` on `/archives` can query `[data-event-key]` cards
 * - `layout` (optional, default `'grid'`): `'grid'` renders the
 *   desktop multi-column layout at ≥md. `'stack'` forces a single
 *   vertical column regardless of viewport width — required by the
 *   archives scrollytelling flow because `useScrollEvent`'s DOM-order
 *   optimization only works on a single column.
 * - `introMarkers` (optional, default `[]`): archives-only synthetic
 *   "faction enters the war" rows (`buildIntroMarkers`). They're
 *   interleaved chronologically with the event rows and rendered as a
 *   distinct faction-colored divider. The homepage passes nothing, so
 *   with the default empty array the output is byte-for-byte identical
 *   to before — the live dashboard is unaffected.
 *
 * @param {object} props - Component props.
 * @param {Array} [props.events] - Full event list, unsorted.
 * @param {'live' | 'absolute'} [props.timeFormat] - Time display mode.
 * @param {string} [props.title] - Heading text.
 * @param {string} [props.id] - DOM id on the section wrapper.
 * @param {string} [props.initialSortOrder] - Initial sort preference (`'desc'` or `'asc'`).
 * @param {string | null} [props.selectedEventKey] - Highlight the card matching this key.
 * @param {Set<string> | null} [props.highlightedKeys] - Cascade deep-link highlight set; matching cards get `data-highlighted` for the faction tint.
 * @param {(event: object) => void} [props.onHoverEvent] - Called on card hover.
 * @param {object} [props.railRef] - Forwarded to the scrolling container.
 * @param {string} [props.layout] - Layout mode (`'grid'` or `'stack'`).
 * @param {Array<{kind:'intro', enemy:number, name:string, time:number, day:number, isWarStart:boolean}>} [props.introMarkers] - Intro markers (`buildIntroMarkers`).
 */
export default function EventLog({
    events,
    timeFormat,
    title = 'Event Log',
    id = 'event-log',
    initialSortOrder,
    selectedEventKey = /** @type {string | null} */ (null),
    highlightedKeys = /** @type {Set<string> | null} */ (null),
    onHoverEvent,
    railRef,
    layout = 'grid',
    introMarkers = [],
}) {
    const [sortOrder, toggleSortOrder] = useEventLogSort(initialSortOrder);
    // Tag intro markers with `start_time` (their `time`) so they flow through
    // the same day-grouping/sort path as events; `__intro` distinguishes them
    // at render time. Empty `introMarkers` → the rows array is just `events`,
    // preserving the homepage's exact output.
    const rows =
        introMarkers.length === 0 ?
            (events ?? [])
        :   [
                ...(events ?? []),
                ...introMarkers.map((m) => ({ ...m, __intro: true, start_time: m.time })),
            ];
    const groups = groupEventsByDay(rows, {
        // useEventLogSort constrains sortOrder to 'desc' | 'asc'
        sortOrder: /** @type {'desc' | 'asc'} */ (sortOrder),
    });

    return (
        <section id={id} className="event-log-section">
            <div className="event-log-content">
                <div className="event-log-header">
                    <h2 className="event-log-heading">{title}</h2>
                    <SortToggle
                        descending={sortOrder === 'desc'}
                        onToggle={toggleSortOrder}
                        label={
                            sortOrder === 'desc' ? 'Sort oldest first' : (
                                'Sort newest first'
                            )
                        }
                        umamiEvent="event-log-sort-toggle"
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
                            // Intro markers carry no win/loss outcome; count
                            // only real events for the day summary.
                            const { wins, losses } = countOutcomes(
                                group.events.filter((row) => !row.__intro),
                            );
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
                                            {group.events.map((row) => {
                                                if (row.__intro) {
                                                    return (
                                                        <IntroMarker
                                                            key={`intro-${row.enemy}`}
                                                            marker={row}
                                                        />
                                                    );
                                                }
                                                const event = row;
                                                const key = eventKey(event);
                                                return (
                                                    <div
                                                        key={`${group.date}-${event.event_id}`}
                                                        data-event-key={key}
                                                        data-faction={String(event.enemy)}
                                                        data-highlighted={
                                                            highlightedKeys?.has(key) ? ''
                                                            :   undefined
                                                        }
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

/**
 * A synthetic "faction enters the war" divider, interleaved among the event
 * rows on both the homepage and /archives. Faction-colored via the
 * `--color-faction-*` theme tokens (resolved from the enemy id's slug). The
 * war-start faction (`isWarStart`, HD1 introduction_order 0) gets distinct
 * wording — it opens the war rather than joining an ongoing one. Static — no
 * interactivity, so no umami tracking is needed.
 *
 * @param {object} props - Component props.
 * @param {{enemy:number, name:string, day:number, isWarStart:boolean}} props.marker - One `buildIntroMarkers` entry.
 */
function IntroMarker({ marker }) {
    const slug = FACTION_SLUG_BY_ID[marker.enemy] ?? 'bugs';
    return (
        <div
            className="event-log-intro"
            style={
                // CSS custom property — cast past React.CSSProperties' typed keys.
                /** @type {React.CSSProperties} */ ({
                    '--intro-color': `var(--color-faction-${slug})`,
                })
            }
        >
            <span className="event-log-intro-day">Day {marker.day}</span>
            <span className="event-log-intro-label">
                {marker.name} {marker.isWarStart ? 'declare war' : 'enter the war'}
            </span>
        </div>
    );
}
