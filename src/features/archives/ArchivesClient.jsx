'use client';
import './ArchivesLayout.css';
import { useMapPin } from '@/shared/hooks/useMapPin.mjs';
import { warDaySpan } from '@/shared/utils/game/warClock.mjs';
import ArchiveStats from '@/features/archives/ArchiveStats';
import ArchivesHeader from '@/features/archives/ArchivesHeader';
import FactionHealthChart from '@/features/archives/FactionHealthChartLoader';
import PlayersOverTimeChart from '@/features/archives/PlayersOverTimeChartLoader';
import NarrativeSection from '@/features/archives/NarrativeSection';
import FactionTabs from '@/shared/components/FactionTabs';
import StatGrid from '@/features/stats/StatGrid';
import EventLog from '@/features/timeline/EventLog';
import CascadeLog from '@/features/timeline/CascadeLog';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';
import { buildIntroMarkers } from '@/features/timeline/buildIntroMarkers.mjs';
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
    narrativeBeats,
    seasons,
    currentSeason,
    isAdmin = false,
    initialFaction = 'global',
    initialSortOrder = 'desc',
    initialCascadeSort,
}) {
    const events = data?.events ?? [];
    // Per-bucket player counts (telemetry-only). Seasons predating stat
    // collection have no timeseries, so the "Players over time" section hides
    // entirely rather than showing an empty chart.
    const playerTimeseries = data?.playerTimeseries ?? [];
    const hasPlayerData = playerTimeseries.length > 0;
    // Shared day-domain so Conquest Progress and Players Over Time use the SAME
    // x-scale and line up day-for-day. Span = the latest data point of either
    // series, in whole days since war start.
    const warDayMax =
        data?.war_start != null ?
            warDaySpan(
                data.war_start,
                Math.max(
                    data?.snapshots?.[data.snapshots.length - 1]?.time ?? data.war_start,
                    playerTimeseries[playerTimeseries.length - 1]?.time ?? data.war_start,
                ),
            )
        :   undefined;
    const cascades = findAllCascades(events).map((c) => ({
        season: data?.season,
        ...c,
    }));
    // Synthetic "faction enters the war" markers, interleaved chronologically
    // into the archives Event Log only. Empty when intro/first_seen data is
    // missing, in which case EventLog renders exactly as it does on the
    // homepage (which passes no markers at all).
    const introMarkers = buildIntroMarkers(data);
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
                        warStart={data?.war_start}
                        domainMax={warDayMax}
                    />
                </section>

                {hasPlayerData && (
                    <section className="mt-4 flex flex-col gap-2">
                        <h2>Players Over Time</h2>
                        <p className="text-small text-text-muted">
                            Helldivers online over the course of the war. Dots mark where
                            each event kicked off — switch factions above to isolate a
                            single front.
                        </p>
                        <PlayersOverTimeChart
                            playerTimeseries={playerTimeseries}
                            events={events}
                            faction={faction}
                            warStart={data?.war_start}
                            domainMax={warDayMax}
                        />
                    </section>
                )}

                <NarrativeSection beats={narrativeBeats} />
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
                        selectedEventKey={selectedEvent ? eventKey(selectedEvent) : null}
                        onHoverEvent={undefined}
                        railRef={railRef}
                        highlightedKeys={highlightedKeys}
                        layout="stack"
                        introMarkers={introMarkers}
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
