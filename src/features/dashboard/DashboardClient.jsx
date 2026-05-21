'use client';
import { startTransition } from 'react';
import './DashboardClient.css';
import NotificationToggle from '@/features/notifications/NotificationToggle';
import LastUpdated from '@/shared/components/LastUpdated';
import EventCard, { computeFrontier } from '@/features/galaxy/EventCard';
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
                <h1>SIGNAL LOST</h1>
                <p>
                    Communication with Super Earth High Command has been disrupted. This
                    is not cause for alarm. Remain calm and await further instructions.
                </p>
            </div>
        );
    }

    const events = sortEventsByRecent(data?.events);
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
        if (index === seDefenderIndex) {
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
                        pulseDelay={pulseDelays.get(`${index}-0`)}
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
                    barLabel={isDefending ? 'CAPITAL_DEFENSE' : 'SECTOR_PROGRESS'}
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

        // In campaign view this card's bar becomes the 11-segment overview
        // (segments 1-10 from mapState, segment 11 from the active homeworld
        // attack). During an actual homeworld assault, the frontier card for
        // this faction returns null (all sectors captured → computeFrontier
        // → null), so this homeworld card is the faction's primary card.
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
                    pulseDelay={
                        attackEvent ?
                            pulseDelays.get(`${attackEvent.enemy}-${attackEvent.region}`)
                        :   undefined
                    }
                    view={regionsView}
                    factionMap={isCampaignView ? mapState[index] : undefined}
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
                <h1 className="font-display text-body text-primary">
                    Track Managed Democracy Across the Galaxy
                </h1>
                <p className="mb-0! text-small text-text-muted">
                    Don&apos;t miss a moment of the action! Follow the Helldivers&apos;
                    campaign progress as they battle the Bugs, Cyborgs, and Illuminate for
                    peace, liberty, and managed democracy.
                </p>
                <div className="flex items-center gap-3">
                    <LastUpdated lastUpdated={data.last_updated} />
                    <NotificationToggle />
                </div>
            </section>

            <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <h2>Season {data.season}</h2>
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
                        <h2>Stats</h2>
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
