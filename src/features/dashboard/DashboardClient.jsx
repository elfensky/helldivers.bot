'use client';
import { startTransition } from 'react';
import './DashboardClient.css';
import Hijackable from '@/features/ministry/Hijackable';
import NotificationToggle from '@/features/notifications/NotificationToggle';
import LastUpdated from '@/shared/components/LastUpdated';
import EventCard, { computeFrontier } from '@/features/galaxy/EventCard';
import { attackForecast, sectorForecast } from '@/features/dashboard/attackForecast.mjs';
import { eventForecast } from '@/features/dashboard/eventForecast.mjs';
import DefeatedCard from '@/features/galaxy/DefeatedCard';
import { highlightSector, clearSectorHighlight } from '@/features/galaxy/sectorLink.mjs';
import FactionTabs from '@/shared/components/FactionTabs';
import RegionsViewToggle from '@/features/dashboard/RegionsViewToggle';
import StatGrid from '@/features/stats/StatGrid';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import { evaluateProgress } from '@/features/stats/evaluateProgress.mjs';
import { sortEventsByRecent } from '@/shared/utils/game/eventFilters.mjs';
import { HOMEWORLD_REGION } from '@/shared/enums/worlds.mjs';
import { CAMPAIGN_STATUS, EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import { computePulseDelays } from '@/shared/utils/game/pulseDelays.mjs';
import ComponentErrorBoundary from '@/shared/components/ComponentErrorBoundary';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';
import { FACTION_KEY } from '@/shared/preferences/faction.mjs';
import { REGIONS_VIEW_KEY } from '@/shared/preferences/regionsView.mjs';

const factionIndices = [0, 1, 2];

/**
 * Shape of a single live event as returned by `getCampaign()`'s
 * `h1_event.findMany` select. `sortEventsByRecent` is typed to its sort
 * key alone (`{ start_time }`), so we restate the full shape here to read
 * the other fields off each event without losing them to that narrow type.
 * Unlike the optional-field `Event` typedef in enums/events.mjs, the live
 * select always returns these columns as concrete values.
 *
 * @typedef {object} LiveEvent
 * @property {import('@/shared/enums/events.mjs').EventType} type - Event type (`defend` or `attack`).
 * @property {number} start_time - Unix-seconds event start.
 * @property {number} end_time - Unix-seconds event end.
 * @property {number} region - Galaxy-map region (sector 1-10, or 11 for homeworld).
 * @property {number} enemy - Faction index (0-2).
 * @property {number} points - Current event progress points.
 * @property {number} points_max - Points required to complete the event.
 * @property {import('@/shared/enums/events.mjs').EventStatus} status - Event status (active/success/fail).
 */

/**
 * Hover props for a region card's `<li>`: `data-*` attributes that key the
 * card to its galaxy-map sector, plus handlers that light the matching map
 * area on hover (faction territory faint, active sector strong). The `data-*`
 * attributes also leave the card findable for a future map → card reverse
 * highlight (#185).
 *
 * @param {number} factionIndex - 0-2 faction, or 3 for Super Earth
 * @param {number | null} [sector] - Active sector (1-11; 0 for Super Earth);
 *   omitted for a defeated faction with no single active sector
 * @returns {object} Props to spread onto the card's `<li>`
 */
function sectorHoverProps(factionIndex, sector = null) {
    return {
        'data-faction-index': factionIndex,
        ...(sector != null && { 'data-sector': sector }),
        onMouseEnter: () => highlightSector(factionIndex, sector),
        onMouseLeave: clearSectorHighlight,
    };
}

/**
 * @param {object} props - Component props.
 * @param {string} [props.initialFaction] - Server-read active faction tab.
 * @param {string} [props.initialRegionsView] - Server-read regions view mode.
 * @param {import('@/features/stats/StatGrid').PlayersAvg24h | null} [props.playersAvg24h] - 24h player baselines.
 * @param {import('@/features/stats/StatGrid').KillsTrend | null} [props.killsTrend] - 24h/48h kill baselines.
 */
export default function DashboardClient({
    initialFaction = 'global',
    initialRegionsView = 'sector',
    playersAvg24h = null,
    killsTrend = null,
}) {
    const { data, mapState } = useLiveDataContext();
    const [faction, setFaction] = usePersistedState(FACTION_KEY, initialFaction);
    const [regionsView, setRegionsView] = usePersistedState(
        REGIONS_VIEW_KEY,
        initialRegionsView,
    );

    if (!data) {
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                <Hijackable as="h1" category="heading" text="SIGNAL LOST" />
                <p>
                    Communication with Super Earth High Command has been disrupted. This
                    is not cause for alarm. Remain calm and await further instructions.
                </p>
            </div>
        );
    }

    const events = /** @type {LiveEvent[]} */ (sortEventsByRecent(data?.events));
    const pulseDelays = computePulseDelays(data?.events);
    const isCampaignView = regionsView === 'campaign';

    const superEarthDefendEvent = events?.find(
        (e) =>
            e.type === EVENT_TYPE.DEFEND &&
            e.region === 0 &&
            e.status === EVENT_STATUS.ACTIVE,
    );
    const seDefenderIndex = superEarthDefendEvent?.enemy ?? null;

    function renderFrontierCard(index) {
        // `superEarthDefendEvent` is guaranteed defined whenever this branch
        // runs: `seDefenderIndex` is `null` when the event is absent, and a
        // numeric `index` never equals `null`. The explicit conjunct just
        // proves that to the type checker.
        if (index === seDefenderIndex && superEarthDefendEvent) {
            // Super Earth defense is an event-focused interrupt — always sector view.
            // `data-attacker-index` links this card (filed under faction 3) to the
            // attacking faction's map territory, so hovering there highlights it
            // too — the map → card reverse highlight (#185).
            return (
                <li
                    key={`frontier-${index}`}
                    {...sectorHoverProps(3, 0)}
                    data-attacker-index={index}
                >
                    <EventCard
                        action="defending"
                        barLabel="SUPER_EARTH_DEFENSE"
                        region="Super Earth"
                        percent={
                            (superEarthDefendEvent.points /
                                superEarthDefendEvent.points_max) *
                            100
                        }
                        points={superEarthDefendEvent.points}
                        pointsMax={superEarthDefendEvent.points_max}
                        factionIndex={index}
                        pace={evaluateProgress(superEarthDefendEvent)}
                        endTime={superEarthDefendEvent.end_time}
                        eventEta={eventForecast(
                            superEarthDefendEvent,
                            Math.floor(Date.now() / 1000),
                        )}
                        pulseDelay={pulseDelays.get(`${index}-0`)}
                        // Sector-view (default) card — factionMap is only read
                        // in campaign view, so undefined is intentional here.
                        factionMap={undefined}
                    />
                </li>
            );
        }

        const campaignData = data.status?.find((l) => l.enemy === index);

        if (campaignData?.status === CAMPAIGN_STATUS.DEFEATED) {
            const factionEvents = events?.filter((e) => e.enemy === index) ?? [];
            const defeatEvent = factionEvents.find(
                (e) => e.type === EVENT_TYPE.ATTACK && e.status === EVENT_STATUS.SUCCESS,
            );
            const earliestStart = factionEvents.reduce(
                (min, e) => (e.start_time < min ? e.start_time : min),
                Infinity,
            );
            return (
                <li key={`frontier-${index}`} {...sectorHoverProps(index)}>
                    <DefeatedCard
                        factionIndex={index}
                        startTime={earliestStart !== Infinity ? earliestStart : null}
                        endTime={defeatEvent?.end_time ?? null}
                        view={regionsView}
                    />
                </li>
            );
        }

        const frontier = computeFrontier(campaignData, mapState[index]);
        if (!frontier) return null;

        const isDefending = frontier.event === EVENT_STATUS.ACTIVE;
        const activeEvent =
            isDefending ?
                events?.find(
                    (e) =>
                        e.enemy === index &&
                        e.type === EVENT_TYPE.DEFEND &&
                        e.status === EVENT_STATUS.ACTIVE,
                )
            :   null;

        // Campaign view uses cumulative campaign totals in the meta row; bar is
        // the 11-segment grid driven by mapState, not the per-sector percent.
        const metaPoints =
            isCampaignView ? campaignData.points
            : isDefending && activeEvent ? activeEvent.points
            : frontier.points;
        const metaPointsMax =
            isCampaignView ? campaignData.points_max
            : isDefending && activeEvent ? activeEvent.points_max
            : frontier.pointsMax;

        return (
            <li key={`frontier-${index}`} {...sectorHoverProps(index, frontier.sector)}>
                <EventCard
                    action={isDefending ? 'defending' : 'capturing'}
                    barLabel={
                        isDefending ? 'CAPITAL_DEFENSE'
                        : isCampaignView ?
                            'FACTION_PROGRESS'
                        :   'SECTOR_PROGRESS'
                    }
                    region={frontier.region}
                    percent={
                        isDefending && activeEvent ?
                            (activeEvent.points / activeEvent.points_max) * 100
                        :   frontier.percent
                    }
                    points={metaPoints}
                    pointsMax={metaPointsMax}
                    factionIndex={index}
                    pace={activeEvent ? evaluateProgress(activeEvent) : null}
                    endTime={activeEvent?.end_time}
                    etaForecast={
                        isCampaignView ?
                            attackForecast(data, index, Math.floor(Date.now() / 1000))
                        :   sectorForecast(data, index, Math.floor(Date.now() / 1000))
                    }
                    eventEta={
                        activeEvent ?
                            eventForecast(activeEvent, Math.floor(Date.now() / 1000))
                        :   null
                    }
                    pulseDelay={
                        activeEvent ?
                            pulseDelays.get(`${activeEvent.enemy}-${activeEvent.region}`)
                        :   undefined
                    }
                    view={regionsView}
                    factionMap={mapState[index]}
                />
            </li>
        );
    }

    function renderHomeworldCard(index) {
        if (index === seDefenderIndex) return null;
        const homeworld = mapState[index]?.[HOMEWORLD_REGION];
        if (homeworld?.event !== EVENT_STATUS.ACTIVE) return null;
        const attackEvent = events?.find(
            (e) =>
                e.enemy === index &&
                e.type === EVENT_TYPE.ATTACK &&
                e.status === EVENT_STATUS.ACTIVE,
        );

        // During an actual homeworld assault this card is an event-focused
        // interrupt, like the Super Earth defense card: single event bar
        // ("Capturing {homeworld}"), regardless of the view toggle — the
        // 11-segment faction overview is hidden while the event runs. The
        // frontier card for this faction returns null anyway (all sectors
        // captured → computeFrontier → null), so this is the faction's
        // primary card. Only in the no-event fallback (stale mapState) does
        // campaign view still show the segments.
        return (
            <li key={`attack-${index}`} {...sectorHoverProps(index, HOMEWORLD_REGION)}>
                <EventCard
                    action="capturing"
                    barLabel="HOMEWORLD_ASSAULT"
                    region={homeworld.region}
                    percent={
                        attackEvent ?
                            (attackEvent.points / attackEvent.points_max) * 100
                        :   homeworld.percent
                    }
                    points={attackEvent ? attackEvent.points : homeworld.points}
                    pointsMax={
                        attackEvent ? attackEvent.points_max : homeworld.points_max
                    }
                    factionIndex={index}
                    pace={attackEvent ? evaluateProgress(attackEvent) : null}
                    endTime={attackEvent?.end_time}
                    eventEta={
                        attackEvent ?
                            eventForecast(attackEvent, Math.floor(Date.now() / 1000))
                        :   null
                    }
                    pulseDelay={
                        attackEvent ?
                            pulseDelays.get(`${attackEvent.enemy}-${attackEvent.region}`)
                        :   undefined
                    }
                    view={attackEvent ? 'sector' : regionsView}
                    factionMap={
                        !attackEvent && isCampaignView ? mapState[index] : undefined
                    }
                />
            </li>
        );
    }

    // DashboardClient renders a Fragment — its children sit as direct
    // flex items of HomeClient's `.home-sidebar`, so the sidebar's
    // `gap: 0.5rem` provides uniform spacing for every block (hero
    // intro, regions, stats) and the event log that follows.
    return (
        <>
            <section className="flex flex-col gap-2">
                <Hijackable
                    as="h1"
                    category="heading"
                    text="Track Managed Democracy Across the Galaxy"
                    className="font-display text-body text-primary"
                />
                <p className="mb-0! text-small text-text-muted">
                    Don&apos;t miss a moment of the action! Follow the Helldivers&apos;
                    campaign progress as they battle the Bugs, Cyborgs, and Illuminate for
                    peace, liberty, and managed democracy.
                </p>
                <div className="flex flex-col items-start gap-2">
                    <LastUpdated lastUpdated={data.last_updated} />
                    <NotificationToggle />
                </div>
            </section>

            <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <Hijackable
                        as="h2"
                        category="heading"
                        text={`Season ${data.season}`}
                    />
                    <RegionsViewToggle value={regionsView} onChange={setRegionsView} />
                </div>
                <ComponentErrorBoundary name="Regions">
                    <ul className="sector-grid list-none p-0">
                        {factionIndices.map(renderFrontierCard)}
                        {factionIndices.map(renderHomeworldCard)}
                    </ul>
                </ComponentErrorBoundary>
            </section>
            <section className="flex flex-col gap-2">
                <ComponentErrorBoundary name="Stats">
                    <div className="flex items-center justify-between gap-2">
                        <Hijackable as="h2" category="heading" text="Stats" />
                        <FactionTabs
                            active={faction}
                            onChange={(id) =>
                                // Switching the faction tab fans a re-render
                                // out to ~10 react-slot-counter instances
                                // (~41ms of work). startTransition marks it
                                // non-urgent so React can yield through that
                                // render instead of blocking the interaction
                                // frame in one chunk.
                                startTransition(() => setFaction(id))
                            }
                        />
                    </div>
                    <StatGrid
                        live={data.status}
                        faction={faction}
                        events={events}
                        playersAvg24h={playersAvg24h}
                        killsTrend={killsTrend}
                        seasonDuration={data.season_duration}
                        warStart={data.war_start}
                    />
                </ComponentErrorBoundary>
            </section>
        </>
    );
}
