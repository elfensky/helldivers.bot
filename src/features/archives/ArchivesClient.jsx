'use client';
import './ArchivesLayout.css';
import { useMapPin } from '@/shared/hooks/useMapPin.mjs';
import ArchiveStats from '@/features/archives/ArchiveStats';
import ArchivesHeader from '@/features/archives/ArchivesHeader';
import FactionHealthChart from '@/features/archives/FactionHealthChartLoader';
import PlayerEngagementChart from '@/features/archives/PlayerEngagementChartLoader';
import FactionTabs from '@/shared/components/FactionTabs';
import StatGrid from '@/features/stats/StatGrid';
import EventLog from '@/features/timeline/EventLog';
import CascadeLog from '@/features/timeline/CascadeLog';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';
import ArchiveMap from '@/features/archives/ArchiveMap';
import SeasonSelector from '@/features/archives/SeasonSelector';
import RefreshSeasonButton from '@/features/archives/RefreshSeasonButton';
import { eventKey } from '@/shared/utils/game/eventKey.mjs';
import { useScrollEvent } from '@/shared/hooks/useScrollEvent.mjs';
import { useCascadeHighlight } from '@/shared/hooks/useCascadeHighlight.mjs';
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
    isAdmin = false,
    initialFaction = 'global',
    initialSortOrder = 'desc',
    initialCascadeSort,
}) {
    const events = data?.events ?? [];
    // Player-engagement data is snapshot-derived, so it exists for historical
    // seasons too — but guard the section anyway so a season with no event
    // player counts hides it entirely rather than showing an empty chart.
    const hasPlayerData = events.some((e) => (e.players_at_start ?? 0) > 0);
    const cascades = findAllCascades(events).map((c) => ({
        season: data?.season,
        ...c,
    }));
    // 'global' shows the whole-war overview; bugs/cyborgs/illuminate show a
    // per-faction breakdown. Either way the stats render through the shared
    // StatGrid plus the archives-only ArchiveStats extras. Persisted via
    // cookies and shared with the dashboard; SSR-read in the archives page.
    const [faction, setFaction] = usePersistedState(FACTION_KEY, initialFaction);
    // Mobile-only: toggle whether the archives map column is sticky
    // (pinned at the top as the user scrolls). Default ON here (unlike
    // the homepage) so the archives map is pinned from first paint —
    // the map is still in its natural flow position below the stats
    // until the user scrolls down to it, at which point native sticky
    // engages. The FAB can unpin. On desktop (lg+) the grid-based
    // sticky rules apply regardless of this state.
    const { isMapSticky, isAnimating, togglePin } = useMapPin(true);

    // Inline backdrop-filter workaround — see HomeClient.jsx / the
    // `useHeaderGlassFilter` hook for the reasoning (Lightning CSS
    // strips `backdrop-filter` from the built CSS).
    const glassFilter = useHeaderGlassFilter();
    const { selectedEvent, railRef } = useScrollEvent(events);
    const { highlightedKeys, pinCascade } = useCascadeHighlight(cascades, railRef);

    return (
        <>
            {/* Full-width stats section */}
            <div className="archives-stats-section">
                <ArchivesHeader />

                <section className="mt-4 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2>Statistics</h2>
                        <div className="flex flex-wrap items-center gap-2">
                            <FactionTabs active={faction} onChange={setFaction} />
                            <SeasonSelector
                                seasons={seasons}
                                currentSeason={currentSeason}
                            />
                            {isAdmin && (
                                <RefreshSeasonButton
                                    season={currentSeason}
                                    lastUpdated={data?.last_updated ?? null}
                                />
                            )}
                        </div>
                    </div>
                    <StatGrid
                        archived
                        live={data?.status}
                        faction={faction}
                        events={events}
                        seasonDuration={data?.season_duration}
                        warStart={data?.war_start}
                    />
                    <ArchiveStats
                        faction={faction}
                        events={events}
                        data={data}
                        live={data?.status}
                    />
                </section>

                <section className="mt-4 flex flex-col gap-2">
                    <h2>Conquest Progress</h2>
                    <FactionHealthChart
                        snapshots={data?.snapshots}
                        pointsMax={data?.points_max}
                    />
                </section>

                {hasPlayerData && (
                    <section className="mt-4 flex flex-col gap-2">
                        <h2>Player Engagement</h2>
                        <p className="text-small text-text-muted">
                            Helldivers mobilized at the start of each event, over the
                            course of the war — did the community rally for the final
                            battles?
                        </p>
                        <PlayerEngagementChart
                            events={events}
                            warStart={data?.war_start}
                        />
                    </section>
                )}
            </div>

            {cascades.length > 0 && (
                <CascadeLog
                    cascades={cascades}
                    initialSortOrder={initialCascadeSort}
                    onSelectCascade={pinCascade}
                />
            )}

            {/* Two-column scrollytelling: event log + sticky map */}
            <div className="archives-scrollytelling">
                <div className="archives-event-col">
                    <EventLog
                        events={events}
                        timeFormat="absolute"
                        title="Event Log"
                        id="archives-event-log"
                        initialSortOrder={initialSortOrder}
                        selectedEventKey={
                            /* EventLog compares this key by ===, so a string is the
                               real contract, but its prop default makes TS infer the
                               narrower null type — cast to pass the computed key. */
                            /** @type {null | undefined} */ (
                                selectedEvent ? eventKey(selectedEvent) : null
                            )
                        }
                        onHoverEvent={undefined}
                        railRef={railRef}
                        highlightedKeys={highlightedKeys}
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
