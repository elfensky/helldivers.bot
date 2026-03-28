'use client';
import './DashboardClient.css';
import { useState } from 'react';
import Alerts from '@/components/h1/Alerts/Alerts';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import EventCard, { computeFrontier } from '@/components/h1/Galaxy/EventCard';
import FactionTabs from '@/components/h1/FactionTabs/FactionTabs';
import StatGrid from '@/components/h1/StatGrid/StatGrid';
import Event from '@/components/h1/Event/Event';

const factionIndices = [0, 1, 2];

export default function DashboardClient({ data, mapState }) {
    const [faction, setFaction] = useState('global');

    const events = data?.events?.sort((a, b) => b.start_time - a.start_time);

    return (
        <div className="gutters flex flex-col gap-4 pb-4">
            <Alerts data={data} />
            <Galaxy mapState={mapState} lastUpdated={data.last_updated} />
            <div className="sector-grid">
                {factionIndices.map((index) => {
                    const campaignData = data.live?.find((l) => l.enemy === index);
                    const frontier = computeFrontier(campaignData, mapState[index]);
                    if (!frontier) return null;

                    const isDefending = frontier.event === 'active';
                    const label = isDefending ? 'DEFENDING' : 'CAPTURING';

                    return (
                        <EventCard
                            key={`frontier-${index}`}
                            label={label}
                            region={frontier.region}
                            percent={frontier.percent}
                            points={frontier.points}
                            pointsMax={frontier.pointsMax}
                            factionIndex={index}
                        />
                    );
                })}
                {factionIndices.map((index) => {
                    const homeworld = mapState[index]?.[11];
                    if (homeworld?.event !== 'active') return null;

                    return (
                        <EventCard
                            key={`attack-${index}`}
                            label="ATTACKING"
                            region={homeworld.region}
                            percent={homeworld.percent}
                            points={homeworld.points}
                            pointsMax={homeworld.points_max}
                            factionIndex={index}
                        />
                    );
                })}
            </div>
            <section className="flex flex-col gap-2">
                <h2 className="mb-0">Stats</h2>
                <FactionTabs active={faction} onChange={setFaction} />
                <StatGrid live={data.live} faction={faction} />
            </section>
            {events?.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h2 className="mb-0">Event Timeline</h2>
                    <div className="flex flex-col gap-2">
                        {events.map((event) => (
                            <Event key={event.event_id} event={event} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
