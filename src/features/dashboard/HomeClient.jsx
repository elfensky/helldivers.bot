'use client';

import { useState } from 'react';
import './HomeClient.css';
import ComponentErrorBoundary from '@/shared/components/ComponentErrorBoundary';
import Galaxy from '@/features/galaxy/Galaxy';
import DashboardClient from '@/features/dashboard/DashboardClient';
import EventLog from '@/features/timeline/EventLog';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import { useScrollEvent } from '@/features/archives/useScrollEvent.mjs';
import { eventKey } from '@/features/archives/eventKey.mjs';
import { computeMapStateAtEvent } from '@/shared/utils/game/computeMapStateAtEvent.mjs';
import { computePulseDelays } from '@/shared/utils/game/pulseDelays.mjs';

/**
 * Homepage client — owns the two-row grid that spans the hero and the
 * scrollytelling event log, with a single sticky galaxy map that lives
 * in the right column across both rows.
 *
 * Desktop (lg+):
 *   ┌──────────────┬─────────┐
 *   │ hero sidebar │         │
 *   ├──────────────┤   map   │  ← sticky, same size in both rows
 *   │ event log    │         │
 *   └──────────────┴─────────┘
 *
 * Mobile (<lg): everything stacks — map inline in the hero, event log
 * below. No sticky behavior, no scroll-sync visual (though
 * `useScrollEvent` still highlights the focal card harmlessly).
 *
 * The map's `mapState` source switches based on whether `useScrollEvent`
 * has latched onto an event:
 *   - `selectedEvent` present → time-travel via `computeMapStateAtEvent`
 *     (same mechanic `ArchiveMap` uses)
 *   - null → live `mapState` from `useLiveDataContext`
 *
 * There's no size transition and no pinned/hero state distinction —
 * the map stays the same size throughout. Visually the map just
 * "scrolls with the user" because `position: sticky` on the grid cell
 * keeps it pinned at top:80px while the user scrolls through both the
 * hero and the event log.
 */
export default function HomeClient() {
    const { data, mapState: liveMapState } = useLiveDataContext();
    const events = data?.events ?? [];
    const pulseDelays = computePulseDelays(events);
    const { selectedEvent, railRef } = useScrollEvent(events);
    // Mobile-only: toggle whether the galaxy map is `position: sticky` so
    // it pins at the top as the user scrolls. Default off — map scrolls
    // away with the hero like normal flow; user pins it via the FAB.
    // On desktop (lg+) the CSS applies its own grid-based sticky rules
    // regardless of this state.
    const [isMapSticky, setIsMapSticky] = useState(false);

    const mapState =
        selectedEvent ? computeMapStateAtEvent(selectedEvent, data) : liveMapState;

    return (
        <div className="home-grid gutters">
            <div className="home-hero-sidebar">
                <ComponentErrorBoundary name="Dashboard">
                    <DashboardClient />
                </ComponentErrorBoundary>
            </div>

            <div className={isMapSticky ? 'home-map home-map--sticky' : 'home-map'}>
                <ComponentErrorBoundary name="Galaxy Map">
                    {mapState && <Galaxy mapState={mapState} pulseDelays={pulseDelays} />}
                </ComponentErrorBoundary>
            </div>

            <div className="home-scrolly-log">
                <ComponentErrorBoundary name="Event Log">
                    <EventLog
                        events={events}
                        timeFormat="live"
                        title="Event Log"
                        id="event-log"
                        layout="stack"
                        selectedEventKey={selectedEvent ? eventKey(selectedEvent) : null}
                        railRef={railRef}
                    />
                </ComponentErrorBoundary>
            </div>

            {/* Mobile FAB to toggle sticky pinning — hidden at lg: */}
            <button
                className="home-map-toggle"
                onClick={() => setIsMapSticky((v) => !v)}
                aria-label={isMapSticky ? 'Unpin map' : 'Pin map to top'}
                title={isMapSticky ? 'Unpin map' : 'Pin map to top'}
                data-umami-event="home-map-toggle"
            >
                {isMapSticky ? '✕' : '📌'}
            </button>
        </div>
    );
}
