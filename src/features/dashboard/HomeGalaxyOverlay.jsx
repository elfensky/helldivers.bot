'use client';

import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import Galaxy from '@/features/galaxy/Galaxy';
import { computeMapStateAtEvent } from '@/shared/utils/game/computeMapStateAtEvent.mjs';
import './HomeGalaxyOverlay.css';

/**
 * Desktop-only (`lg:` / ≥1024px) galaxy map overlay.
 *
 * The same `<Galaxy>` instance lives inside this fixed-position wrapper
 * for the entire homepage lifecycle. Two CSS modifier classes flip it
 * between the hero state (big, right side of hero column) and the pinned
 * state (small, top-right corner of viewport, scrolls with user).
 *
 * `isPinned` comes from `useHomeMapPinned` (scroll threshold).
 * `selectedEvent` comes from `useScrollEvent` wired up inside
 * `HomeScrollytelling`. When both pinned AND an event is selected, we
 * time-travel the map state via `computeMapStateAtEvent` so the pinned
 * map reflects what the galaxy looked like at that event's moment —
 * same mechanic as `ArchiveMap` on `/archives`. Otherwise we render
 * the live `mapState` from `useLiveDataContext`.
 *
 * The overlay is hidden on mobile via CSS (`display: none` below `lg:`);
 * the mobile flow renders an inline `<Galaxy>` inside `DashboardClient`
 * instead.
 */
export default function HomeGalaxyOverlay({ isPinned, selectedEvent }) {
    const { data, mapState: liveMapState } = useLiveDataContext();

    const mapState =
        isPinned && selectedEvent ?
            computeMapStateAtEvent(selectedEvent, data)
        :   liveMapState;

    if (!mapState) return null;

    return (
        <div
            className={
                'home-galaxy-overlay' +
                (isPinned ? ' home-galaxy-overlay--pinned' : ' home-galaxy-overlay--hero')
            }
            aria-hidden={isPinned ? 'false' : 'false'}
        >
            <Galaxy mapState={mapState} />
        </div>
    );
}
