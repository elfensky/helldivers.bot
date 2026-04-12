'use client';

import EventLog from '@/features/timeline/EventLog';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import { useScrollEvent } from '@/features/archives/useScrollEvent.mjs';
import { useHomeMapPinned } from '@/features/dashboard/useHomeMapPinned.mjs';
import { eventKey } from '@/features/archives/eventKey.mjs';
import HomeGalaxyOverlay from '@/features/dashboard/HomeGalaxyOverlay';
import './HomeScrollytelling.css';

/**
 * Scrollytelling section below the homepage hero.
 *
 * Layout: 2-col grid at `lg:` — event log (stack) on the left, empty
 * sticky map slot on the right. The `HomeGalaxyOverlay` is rendered here
 * too (not inside the grid) because it's `position: fixed` and needs to
 * exist as a sibling, not a grid child.
 *
 * Scroll-sync: reuses the archives `useScrollEvent` hook to pick the
 * card currently in the scroll focal anchor. The selected event drives
 * both the card highlight (`selectedEventKey`) and the pinned map's
 * time-travel state (via `HomeGalaxyOverlay`).
 *
 * On mobile (<lg:) there's no pinned map, no 2-col grid — just the
 * event log stacked below whatever the hero rendered inline.
 */
export default function HomeScrollytelling({ heroRef }) {
    const { data } = useLiveDataContext();
    const events = data?.events ?? [];
    const { selectedEvent, railRef } = useScrollEvent(events);
    const isPinned = useHomeMapPinned(heroRef);

    return (
        <>
            <HomeGalaxyOverlay isPinned={isPinned} selectedEvent={selectedEvent} />
            <div className="home-scrollytelling">
                <div className="home-event-col">
                    <EventLog
                        events={events}
                        timeFormat="live"
                        title="Event Log"
                        id="event-log"
                        layout="stack"
                        selectedEventKey={selectedEvent ? eventKey(selectedEvent) : null}
                        railRef={railRef}
                    />
                </div>
                <div className="home-map-col" aria-hidden="true" />
            </div>
        </>
    );
}
