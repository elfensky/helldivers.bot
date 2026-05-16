'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import './ArchivesLayout.css';
import ArchiveStats from '@/features/archives/ArchiveStats';
import ArchivesHeader, { EffectsToggle } from '@/features/archives/ArchivesHeader';
import FactionHealthChart from '@/features/archives/FactionHealthChart';
import FactionTabs from '@/features/dashboard/FactionTabs';
import FactionStats from '@/features/archives/FactionStats';
import EventLog from '@/features/timeline/EventLog';
import ArchiveMap from '@/features/archives/ArchiveMap';
import SeasonSelector from '@/features/archives/SeasonSelector';
import RefreshSeasonButton from '@/features/archives/RefreshSeasonButton';
import { eventKey } from '@/shared/utils/game/eventKey.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import { useCyberstanEffects } from '@/features/archives/useCyberstanEffects.mjs';
import { useScrollEvent } from '@/shared/hooks/useScrollEvent.mjs';
import { useHeaderGlassFilter } from '@/shared/hooks/useHeaderGlassFilter.mjs';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';
import { FACTION_KEY } from '@/shared/preferences/faction.mjs';

/**
 * Archives client — full-season retrospective view with a sticky
 * galaxy map pinned by default and a scrollytelling event log that
 * drives map time-travel via `useScrollEvent`.
 *
 * Layout mirrors `HomeClient` but with one key difference: the map
 * column is **pinned by default** (`useState(true)` instead of the
 * homepage's `useState(false)`). The rationale:
 *
 *   - /archives is a "look at historical campaign data" page — the
 *     map is the primary visual anchor, not a live dashboard beside
 *     a hero. Users scroll through the event log and the pinned map
 *     should already be in its stable top-of-viewport position by
 *     the time the scrollytelling begins.
 *   - Native `position: sticky` engages only when the user scrolls
 *     past the map's threshold, so defaulting to `isMapSticky: true`
 *     doesn't cause any visual jump on mount — the map is in its
 *     natural flow position below the stats section until the user
 *     scrolls down to it, at which point sticky pins it silently.
 *   - The FAB still works for unpinning (if the user wants to scroll
 *     the map away with the rest of the page).
 *
 * ## Pin state machine
 *
 * Mirrors `HomeClient`'s two-state pattern with the same semantics:
 *
 *   `isMapSticky` default **true** → the `.archives-map-col--sticky`
 *     class is applied from first paint, but the slide animation
 *     is NOT triggered on mount because...
 *
 *   `isAnimating` default **false** → the `.archives-map-col--pinning`
 *     class is only added inside `togglePin`'s `false → true` branch,
 *     so a user-initiated re-pin plays the animation, but the initial
 *     render does not.
 *
 * See `HomeClient.jsx`'s JSDoc for the full pin-state-machine
 * reasoning, class-layering explanation, and tablet backdrop-filter
 * workaround — they're shared between both pages.
 *
 * ## Scroll-sync event selection
 *
 * `useScrollEvent(events)` returns a `selectedEvent` derived from
 * the user's current scroll position in the event log rail, plus a
 * `railRef` the caller attaches to the log's container. The selected
 * event is passed into `ArchiveMap` which rebuilds the galaxy state
 * via `computeMapStateAtEvent` — clicking or scrolling to an event
 * rewinds the map to that historical moment.
 */
export default function ArchivesClient({
    data,
    seasons,
    currentSeason,
    defeatMessageIndex,
    isAdmin = false,
    initialFaction = 'global',
    initialSortOrder = 'desc',
}) {
    const events = data?.events ?? [];
    // 'global' shows the whole-war overview (ArchiveStats); bugs/cyborgs/illuminate
    // show a per-faction breakdown (FactionStats). Persisted via cookies and
    // shared with the dashboard; initial value is SSR-read in the archives page.
    const [faction, setFaction] = usePersistedState(FACTION_KEY, initialFaction);
    // Mobile-only: toggle whether the archives map column is sticky
    // (pinned at the top as the user scrolls). Default ON here (unlike
    // the homepage) so the archives map is pinned from first paint —
    // the map is still in its natural flow position below the stats
    // until the user scrolls down to it, at which point native sticky
    // engages. The FAB can unpin. On desktop (lg+) the grid-based
    // sticky rules apply regardless of this state.
    const [isMapSticky, setIsMapSticky] = useState(true);
    // Transient flag for the slide animation. Only true for 400ms after
    // togglePin flips the map from unpinned → pinned. Starts false on
    // mount so the default-pinned archives page does NOT play the
    // animation on first load.
    const [isAnimating, setIsAnimating] = useState(false);
    const animTimerRef = useRef(null);

    const togglePin = useCallback(() => {
        setIsMapSticky((v) => {
            const next = !v;
            clearTimeout(animTimerRef.current);
            if (next) {
                setIsAnimating(true);
                animTimerRef.current = setTimeout(() => setIsAnimating(false), 400);
            } else {
                setIsAnimating(false);
            }
            return next;
        });
    }, []);

    useEffect(() => () => clearTimeout(animTimerRef.current), []);

    // Inline backdrop-filter workaround — see HomeClient.jsx / the
    // `useHeaderGlassFilter` hook for the reasoning (Lightning CSS
    // strips `backdrop-filter` from the built CSS).
    const glassFilter = useHeaderGlassFilter();
    const isDefeat = getWarOutcome(data)?.outcome === 'defeat';
    const effects = useCyberstanEffects(isDefeat);
    const { selectedEvent, railRef } = useScrollEvent(events);

    // Synced glitch phase from ArchivesHeader → ArchiveStats
    const [glitchPhase, setGlitchPhase] = useState({
        phase: 'idle',
        takeoverMs: 800,
        restoreMs: 800,
    });
    const handlePhaseChange = useCallback((phase, takeoverMs, restoreMs) => {
        setGlitchPhase({ phase, takeoverMs, restoreMs });
    }, []);

    return (
        <>
            {/* Full-width stats section */}
            <div
                className={`archives-stats-section${isDefeat ? ' cyberstan-defeat' : ''}${effects.watermark ? ' cyberstan-watermark-active' : ''}`}
            >
                <ArchivesHeader
                    isDefeat={isDefeat}
                    effects={effects}
                    defeatMessageIndex={defeatMessageIndex}
                    onPhaseChange={handlePhaseChange}
                />

                <section className="mt-4 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2>Statistics</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <FactionTabs active={faction} onChange={setFaction} />
                            <SeasonSelector
                                seasons={seasons}
                                currentSeason={currentSeason}
                            />
                            {isDefeat && (
                                <EffectsToggle active={effects.headerScramble} />
                            )}
                            {isAdmin && (
                                <RefreshSeasonButton
                                    season={currentSeason}
                                    lastUpdated={data?.last_updated ?? null}
                                />
                            )}
                        </div>
                    </div>
                    {faction === 'global' ?
                        <ArchiveStats
                            events={events}
                            live={data?.status}
                            data={data}
                            effects={effects}
                            glitchPhase={glitchPhase}
                        />
                    :   <FactionStats
                            events={events}
                            snapshots={data?.snapshots}
                            pointsMax={data?.points_max}
                            faction={faction}
                        />
                    }
                </section>

                <section className="mt-4 flex flex-col gap-2">
                    <h2>Conquest Progress</h2>
                    <FactionHealthChart
                        snapshots={data?.snapshots}
                        pointsMax={data?.points_max}
                    />
                </section>
            </div>

            {/* Two-column scrollytelling: event log + sticky map */}
            <div className="archives-scrollytelling">
                <div className="archives-event-col">
                    <EventLog
                        events={events}
                        timeFormat="absolute"
                        title="Event Log"
                        id="archives-event-log"
                        initialSortOrder={initialSortOrder}
                        selectedEventKey={selectedEvent ? eventKey(selectedEvent) : null}
                        railRef={railRef}
                        includeToday={false}
                        layout="stack"
                    />
                </div>

                <div
                    className={[
                        'archives-map-col',
                        isMapSticky && 'archives-map-col--sticky',
                        isAnimating && 'archives-map-col--pinning',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    style={{
                        backdropFilter: glassFilter,
                        WebkitBackdropFilter: glassFilter,
                    }}
                >
                    <ArchiveMap data={data} selectedEvent={selectedEvent} />
                </div>
            </div>

            {/* Mobile FAB to toggle sticky pinning — hidden at lg: */}
            <button
                className="archives-map-toggle"
                onClick={togglePin}
                aria-label={isMapSticky ? 'Unpin map' : 'Pin map to top'}
                title={isMapSticky ? 'Unpin map' : 'Pin map to top'}
                data-umami-event="archive-map-toggle"
            >
                {isMapSticky ? '✕' : '📌'}
            </button>
        </>
    );
}
