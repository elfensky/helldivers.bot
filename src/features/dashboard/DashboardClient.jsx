'use client';
import './DashboardClient.css';
import { useState } from 'react';
import Galaxy from '@/features/galaxy/Galaxy';
import NotificationToggle from '@/features/notifications/NotificationToggle';
import EventCard, { computeFrontier } from '@/features/galaxy/EventCard';
import DefeatedCard from '@/features/galaxy/DefeatedCard';
import FactionTabs from '@/features/dashboard/FactionTabs';
import StatGrid from '@/features/stats/StatGrid';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import { evaluateProgress } from '@/features/stats/evaluateProgress.mjs';
import { sortEventsByRecent } from '@/shared/utils/game/eventFilters.mjs';
import { HOMEWORLD_REGION } from '@/shared/enums/worlds.mjs';
import { CAMPAIGN_STATUS, EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import ComponentErrorBoundary from '@/shared/components/ComponentErrorBoundary';

const factionIndices = [0, 1, 2];
const FACTION_LABELS = {
    global: 'Global',
    bugs: 'Bugs',
    cyborgs: 'Cyborgs',
    illuminate: 'Illuminate',
};

export default function DashboardClient() {
    const { data, mapState } = useLiveDataContext();
    const [faction, setFaction] = useState('global');

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

    function renderFrontierCard(index) {
        const campaignData = data.live?.find((l) => l.enemy === index);

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

        return (
            <li key={`frontier-${index}`}>
                <EventCard
                    action={isDefending ? 'defending' : 'capturing'}
                    barLabel={isDefending ? 'CAPITAL_DEFENSE' : 'SECTOR_PROGRESS'}
                    region={frontier.region}
                    percent={
                        isDefending && activeEvent
                            ? (activeEvent.points / activeEvent.points_max) * 100
                            : frontier.percent
                    }
                    points={
                        isDefending && activeEvent
                            ? activeEvent.points
                            : frontier.points
                    }
                    pointsMax={
                        isDefending && activeEvent
                            ? activeEvent.points_max
                            : frontier.pointsMax
                    }
                    factionIndex={index}
                    pace={activeEvent ? evaluateProgress(activeEvent) : null}
                    endTime={activeEvent?.end_time}
                />
            </li>
        );
    }

    function renderHomeworldCard(index) {
        const homeworld = mapState[index]?.[HOMEWORLD_REGION];
        if (homeworld?.event !== 'active') return null;
        const attackEvent = events?.find(
            (e) => e.enemy === index && e.type === 'attack' && e.status === 'active',
        );

        return (
            <li key={`attack-${index}`}>
                <EventCard
                    action="capturing"
                    barLabel="HOMEWORLD_ASSAULT"
                    region={homeworld.region}
                    percent={
                        attackEvent
                            ? (attackEvent.points / attackEvent.points_max) * 100
                            : homeworld.percent
                    }
                    points={attackEvent ? attackEvent.points : homeworld.points}
                    pointsMax={
                        attackEvent
                            ? attackEvent.points_max
                            : homeworld.points_max
                    }
                    factionIndex={index}
                    pace={attackEvent ? evaluateProgress(attackEvent) : null}
                    endTime={attackEvent?.end_time}
                />
            </li>
        );
    }

    return (
        <div className="dashboard gutters">
            <div className="dashboard-map">
                <ComponentErrorBoundary name="Galaxy Map">
                    <Galaxy mapState={mapState} />
                </ComponentErrorBoundary>
            </div>
            <div className="dashboard-sidebar">
                <div className="pb-2">
                    <h1 className="font-display text-body text-primary">
                        Track Managed Democracy Across the Galaxy
                    </h1>
                    <p className="mt-1 text-small text-text-muted">
                        Don&apos;t miss a moment of the action! Follow the
                        Helldivers&apos; campaign progress as they battle the Bugs,
                        Cyborgs, and Illuminate for peace, liberty, and managed democracy.
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                        <NotificationToggle />
                    </div>
                </div>
                <section className="flex flex-col gap-2">
                    <h2>Regions</h2>
                    <ComponentErrorBoundary name="Regions">
                        <ul className="sector-grid list-none p-0">
                            {factionIndices.map(renderFrontierCard)}
                            {factionIndices.map(renderHomeworldCard)}
                        </ul>
                    </ComponentErrorBoundary>
                </section>
                <section className="flex flex-col gap-2">
                    <ComponentErrorBoundary name="Stats">
                        <h2>Stats — {FACTION_LABELS[faction]}</h2>
                        <FactionTabs active={faction} onChange={setFaction} />
                        <StatGrid live={data.live} faction={faction} events={events} />
                    </ComponentErrorBoundary>
                </section>
            </div>
            <button
                className="dashboard-scroll-hint"
                data-umami-event="dashboard-scroll-to-log"
                onClick={() =>
                    document
                        .getElementById('event-log')
                        ?.scrollIntoView({ behavior: 'smooth' })
                }
            >
                <span className="hint-arrow">↓</span> event log
            </button>
        </div>
    );
}
