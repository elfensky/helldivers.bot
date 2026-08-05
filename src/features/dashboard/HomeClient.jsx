'use client';

import './HomeClient.css';
import { useMapPin } from '@/shared/hooks/useMapPin.mjs';
import ComponentErrorBoundary from '@/shared/components/ComponentErrorBoundary';
import Galaxy from '@/features/galaxy/Galaxy';
import DashboardClient from '@/features/dashboard/DashboardClient';
import EventLog from '@/features/timeline/EventLog';
import NextWaveCard from '@/features/dashboard/NextWaveCard';
import { waveForecast } from '@/features/dashboard/waveForecast.mjs';
import { counterattackForecast } from '@/features/dashboard/counterattackForecast.mjs';
import { buildIntroMarkers } from '@/features/timeline/buildIntroMarkers.mjs';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import { useScrollEvent } from '@/shared/hooks/useScrollEvent.mjs';
import { eventKey } from '@/shared/utils/game/eventKey.mjs';
import { computeMapStateAtEvent } from '@/shared/utils/game/computeMapStateAtEvent.mjs';
import { computePulseDelays } from '@/shared/utils/game/pulseDelays.mjs';
import { useHeaderGlassFilter } from '@/shared/hooks/useHeaderGlassFilter.mjs';

/**
 * Homepage client — owns a two-column grid: one sidebar that stacks
 * the dashboard (season heading, region cards, stats) and the event
 * log, and a single sticky galaxy map column that can be pinned
 * (mobile/tablet) or lives in its own grid cell (desktop).
 *
 * Layout:
 *
 *   Desktop (lg+):               Mobile/Tablet (<lg, unpinned):
 *   ┌──────────────┬─────────┐   ┌──────────────────┐
 *   │   sidebar    │         │   │    ┌────────┐    │  map in normal
 *   │  (dashboard  │   map   │   │    │  map   │    │  flow, scrolls
 *   │  + event log)│ sticky  │   │    └────────┘    │  away
 *   └──────────────┴─────────┘   ├──────────────────┤
 *     map sticky at                │   sidebar        │
 *     top:80px in                  │   (dashboard     │
 *     right column                 │   + event log)   │
 *                                  └──────────────────┘
 *
 *   Mobile/Tablet (<lg, pinned via FAB):
 *   ┌──────────────────┐
 *   │  map (sticky,    │  ← `.home-map--sticky`, full-bleed bg,
 *   │  at top:49/79px) │    1px overlap with header bottom border,
 *   ├──────────────────┤    z-index:50 above header
 *   │   hero sidebar   │
 *   │   event log      │
 *   └──────────────────┘
 *
 * ## Map state
 *
 * The map's `mapState` source switches based on whether `useScrollEvent`
 * has latched onto an event:
 *   - `selectedEvent` present → time-travel via `computeMapStateAtEvent`
 *     (same mechanic `ArchiveMap` uses on /archives)
 *   - null → live `mapState` from `useLiveDataContext`
 *
 * ## Pin state machine (mobile/tablet only)
 *
 * Two pieces of React state drive three CSS modifier classes:
 *
 *   `isMapSticky` (boolean, default false on /):
 *     - Controls the persistent `.home-map--sticky` class
 *     - When true: `position: sticky; top: 49/79px`, background,
 *       border, full-bleed margins, `--header-offset` transform
 *       tracking, and descendant `#map > svg` max-height cap
 *     - Flipped by the FAB click (`togglePin`)
 *
 *   `isAnimating` (boolean, default false, timer-gated):
 *     - Controls the transient `.home-map--pinning` class for
 *       exactly 400ms after `togglePin` flips `isMapSticky` from
 *       `false` → `true` (not on unpin, not on first mount)
 *     - When true: drops `z-index` to 10 so the header's `z-40`
 *       occludes the map during the slide animation, and applies
 *       the `home-map-pin-in` keyframe
 *
 * The split keeps the slide animation from re-triggering on mount
 * (important for /archives where `isMapSticky` defaults to true) —
 * only an explicit user toggle fires the animation.
 *
 * ## Background mirror on tablet (md+)
 *
 * `useHeaderGlassFilter` reads the `--header-glass-filter` CSS var
 * published by `public/scripts/headerGPU.js` and applies
 * `backdrop-filter: blur(8.8px)` as an inline `style={{}}` on the
 * map element. Inline is required because Lightning CSS strips
 * `backdrop-filter` declarations from the built CSS — see the hook
 * file and `CHANGELOG.md#0.39.14` for the full story. The matching
 * `background` uses `var(--header-bg)` directly from CSS (surviving
 * Lightning CSS's optimizer since it's a simpler `background: var(...)`
 * usage, not stripped).
 *
 * ## Desktop (lg+) layout
 *
 * At lg+ the FAB is hidden via CSS and `isMapSticky` becomes
 * irrelevant — the map lives in a real grid cell with its own
 * `position: sticky; top: 80px` rule defined in `HomeClient.css`.
 * Stale mobile state classes (from a viewport resize) are explicitly
 * reset in the lg+ media block to avoid cross-breakpoint leakage.
 *
 * @param {object} props - Component props.
 * @param {string} [props.initialFaction] - Server-read active faction tab.
 * @param {string} [props.initialRegionsView] - Server-read regions view mode.
 * @param {string} [props.initialSortOrder] - Server-read event-log sort order.
 * @param {import('@/features/stats/StatGrid').PlayersAvg24h | null} [props.playersAvg24h] - 24h player baselines.
 * @param {import('@/features/stats/StatGrid').KillsTrend | null} [props.killsTrend] - 24h/48h kill baselines.
 */
export default function HomeClient({
    initialFaction = 'global',
    initialRegionsView = 'sector',
    initialSortOrder = 'desc',
    playersAvg24h = null,
    killsTrend = null,
}) {
    const { data, mapState: liveMapState } = useLiveDataContext();
    const events = data?.events ?? [];
    const pulseDelays = computePulseDelays(events);
    const { selectedEvent, railRef } = useScrollEvent(events);
    // Two STANDALONE forecasts, recomputed every poll-driven render, each
    // owning its regime (see NextWaveCard): the free-wave band while the
    // scheduler's dice roll, the counteroffensive clock while an assault
    // gates them. Renders as the event log's "FUTURE" group (neither active
    // → no group at all).
    const nowSeconds = Math.floor(Date.now() / 1000);
    const forecast = waveForecast(data, nowSeconds);
    const counter = counterattackForecast(data, nowSeconds);
    // Mobile-only: toggle whether the galaxy map is `position: sticky` so
    // it pins at the top as the user scrolls. Default off — map scrolls
    // away with the hero like normal flow; user pins it via the FAB.
    // On desktop (lg+) the CSS applies its own grid-based sticky rules
    // regardless of this state.
    const { isMapSticky, isAnimating, togglePin } = useMapPin(false);

    // Backdrop-filter on the pinned map at md+ is applied inline because
    // Lightning CSS strips `backdrop-filter: var(--header-glass-filter)`
    // from the built stylesheet. See `useHeaderGlassFilter` for the
    // workaround details.
    const glassFilter = useHeaderGlassFilter();

    const mapState =
        selectedEvent ? computeMapStateAtEvent(selectedEvent, data) : liveMapState;

    return (
        <div className="home-grid gutters">
            <div className="home-sidebar gap-8">
                <ComponentErrorBoundary name="Dashboard">
                    <DashboardClient
                        initialFaction={initialFaction}
                        initialRegionsView={initialRegionsView}
                        playersAvg24h={playersAvg24h}
                        killsTrend={killsTrend}
                    />
                </ComponentErrorBoundary>
                <ComponentErrorBoundary name="Event Log">
                    <EventLog
                        events={events}
                        timeFormat="live"
                        title="Event Log"
                        id="event-log"
                        layout="stack"
                        initialSortOrder={initialSortOrder}
                        selectedEventKey={
                            // EventLog infers this prop as `null` from its
                            // default; the real value is a string key or null.
                            // Cast keeps the runtime value while satisfying the
                            // call site until EventLog's prop type is widened.
                            /** @type {null} */ (
                                selectedEvent ? eventKey(selectedEvent) : null
                            )
                        }
                        railRef={railRef}
                        introMarkers={buildIntroMarkers(data)}
                        futureSlot={
                            forecast.mode === 'window' || counter.mode === 'clock' ?
                                <NextWaveCard
                                    forecast={forecast}
                                    counter={counter}
                                    warStart={data?.war_start ?? null}
                                    now={nowSeconds}
                                />
                            :   null
                        }
                        // Documented-optional in EventLog but has no default in
                        // its destructuring, so its inferred type marks it
                        // required; pass undefined explicitly (no behavior change).
                        onHoverEvent={undefined}
                    />
                </ComponentErrorBoundary>
            </div>

            <div
                className={[
                    'home-map',
                    isMapSticky && 'home-map--sticky',
                    isAnimating && 'home-map--pinning',
                ]
                    .filter(Boolean)
                    .join(' ')}
                style={{
                    backdropFilter: glassFilter,
                    WebkitBackdropFilter: glassFilter,
                }}
            >
                <ComponentErrorBoundary name="Galaxy Map">
                    {mapState && <Galaxy mapState={mapState} pulseDelays={pulseDelays} />}
                </ComponentErrorBoundary>
            </div>

            {/* Mobile FAB to toggle sticky pinning — hidden at lg: */}
            <button
                className="home-map-toggle"
                onClick={togglePin}
                aria-label={isMapSticky ? 'Unpin map' : 'Pin map to top'}
                title={isMapSticky ? 'Unpin map' : 'Pin map to top'}
                data-umami-event="home-map-toggle"
            >
                {isMapSticky ? '✕' : '📌'}
            </button>
        </div>
    );
}
