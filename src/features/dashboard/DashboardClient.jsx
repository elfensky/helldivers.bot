'use client';
import './DashboardClient.css';
import NotificationToggle from '@/features/notifications/NotificationToggle';
import LastUpdated from '@/shared/components/LastUpdated';
import EventCard, { computeFrontier } from '@/features/galaxy/EventCard';
import DefeatedCard from '@/features/galaxy/DefeatedCard';
import FactionTabs from '@/features/dashboard/FactionTabs';
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

export default function DashboardClient({
    initialFaction = 'global',
    initialRegionsView = 'sector',
    playersAvg24h = null,
    kills24hAgo = null,
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
            return (
                <li key={`frontier-${index}`}>
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
                <li key={`frontier-${index}`}>
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

        const isDefending = frontier.event === 'active';
        const activeEvent =
            isDefending ?
                events?.find(
                    (e) =>
                        e.enemy === index && e.type === 'defend' && e.status === 'active',
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
            <li key={`frontier-${index}`}>
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
        if (homeworld?.event !== 'active') return null;
        const attackEvent = events?.find(
            (e) => e.enemy === index && e.type === 'attack' && e.status === 'active',
        );

        // In campaign view this card's bar becomes the 11-segment overview
        // (segments 1-10 from mapState, segment 11 from the active homeworld
        // attack). During an actual homeworld assault, the frontier card for
        // this faction returns null (all sectors captured → computeFrontier
        // → null), so this homeworld card is the faction's primary card.
        return (
            <li key={`attack-${index}`}>
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
                        <FactionTabs active={faction} onChange={setFaction} />
                    </div>
                    <StatGrid
                        live={data.status}
                        faction={faction}
                        events={events}
                        playersAvg24h={playersAvg24h}
                        kills24hAgo={kills24hAgo}
                    />
                </ComponentErrorBoundary>
            </section>
        </>
    );
}
