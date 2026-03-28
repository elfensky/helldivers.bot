'use client';
import { useState } from 'react';
import Alerts from '@/components/h1/Alerts/Alerts';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import FactionTabs from '@/components/h1/FactionTabs/FactionTabs';
import StatGrid from '@/components/h1/StatGrid/StatGrid';
import Event from '@/components/h1/Event/Event';

export default function DashboardClient({ data, mapState }) {
    const [faction, setFaction] = useState('global');

    const events = data?.events?.sort((a, b) => b.start_time - a.start_time);

    return (
        <div className="gutters flex flex-col gap-4 pb-4">
            <Alerts data={data} />
            <Galaxy mapState={mapState} lastUpdated={data.last_updated} live={data.live} />
            <FactionTabs active={faction} onChange={setFaction} />
            <StatGrid live={data.live} faction={faction} />
            {events?.length > 0 && (
                <section>
                    <h2>Event Timeline</h2>
                    <div className="flex flex-col gap-2" style={{ marginTop: '0.5rem' }}>
                        {events.map((event) => (
                            <Event key={event.event_id} event={event} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
