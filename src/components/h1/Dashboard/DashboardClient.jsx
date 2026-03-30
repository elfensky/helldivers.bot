'use client';
import './DashboardClient.css';
import { useState } from 'react';
import Alerts from '@/components/h1/Alerts/Alerts';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import EventCard, { computeFrontier } from '@/components/h1/Galaxy/EventCard';
import FactionTabs from '@/components/h1/FactionTabs/FactionTabs';
import StatGrid from '@/components/h1/StatGrid/StatGrid';
import Event from '@/components/h1/Event/Event';
import { evaluateProgress } from '@/utils/evaluateProgress.mjs';
import { formatTimeAgo } from '@/utils/formatTimeAgo.mjs';

const factionIndices = [0, 1, 2];

export default function DashboardClient({ data, mapState }) {
    const [faction, setFaction] = useState('global');

    const events = data?.events?.sort((a, b) => b.start_time - a.start_time);
    const timeAgo = formatTimeAgo(data.last_updated);

    return (
        <div className="gutters flex flex-col gap-4 pb-4">
            <h1 className="sr-only">Live Campaign</h1>
            <Alerts data={data} />
            {timeAgo && (
                <p
                    className="font-mono text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                    suppressHydrationWarning
                >
                    {timeAgo}
                </p>
            )}
            <div className="dashboard-main">
                <div className="dashboard-map">
                    <Galaxy mapState={mapState} />
                </div>
                <div className="dashboard-sidebar">
                    <ul className="sector-grid list-none p-0">
                        {factionIndices.map((index) => {
                            const campaignData = data.live?.find(
                                (l) => l.enemy === index,
                            );
                            const frontier = computeFrontier(
                                campaignData,
                                mapState[index],
                            );
                            if (!frontier) return null;

                            const isDefending = frontier.event === 'active';
                            const label = isDefending ? 'DEFENDING' : 'CAPTURING';
                            const activeEvent =
                                isDefending ?
                                    events?.find(
                                        (e) =>
                                            e.enemy === index &&
                                            e.type === 'defend' &&
                                            e.status === 'active',
                                    )
                                :   null;

                            return (
                                <li key={`frontier-${index}`}>
                                    <EventCard
                                        label={label}
                                        region={frontier.region}
                                        percent={frontier.percent}
                                        points={frontier.points}
                                        pointsMax={frontier.pointsMax}
                                        factionIndex={index}
                                        pace={
                                            activeEvent ?
                                                evaluateProgress(activeEvent)
                                            :   null
                                        }
                                    />
                                </li>
                            );
                        })}
                        {factionIndices.map((index) => {
                            const homeworld = mapState[index]?.[11];
                            if (homeworld?.event !== 'active') return null;
                            const attackEvent = events?.find(
                                (e) =>
                                    e.enemy === index &&
                                    e.type === 'attack' &&
                                    e.status === 'active',
                            );

                            return (
                                <li key={`attack-${index}`}>
                                    <EventCard
                                        label="ATTACKING"
                                        region={homeworld.region}
                                        percent={homeworld.percent}
                                        points={homeworld.points}
                                        pointsMax={homeworld.points_max}
                                        factionIndex={index}
                                        pace={
                                            attackEvent ?
                                                evaluateProgress(attackEvent)
                                            :   null
                                        }
                                    />
                                </li>
                            );
                        })}
                    </ul>
                    <section className="flex flex-col gap-2">
                        <h2>Stats</h2>
                        <FactionTabs active={faction} onChange={setFaction} />
                        <StatGrid live={data.live} faction={faction} />
                    </section>
                </div>
            </div>
            {events?.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2>Event Timeline</h2>
                    <ul className="flex list-none flex-col gap-2 p-0">
                        {events.map((event) => (
                            <li key={event.event_id}>
                                <Event event={event} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
