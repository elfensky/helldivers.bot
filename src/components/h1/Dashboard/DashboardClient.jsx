'use client';
import './DashboardClient.css';
import { useState } from 'react';
import Alerts from '@/components/h1/Alerts/Alerts';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import EventCard, { computeFrontier } from '@/components/h1/Galaxy/EventCard';
import FactionTabs from '@/components/h1/FactionTabs/FactionTabs';
import StatGrid from '@/components/h1/StatGrid/StatGrid';
import { evaluateProgress } from '@/utils/evaluateProgress.mjs';
import { formatTimeAgo } from '@/utils/formatTimeAgo.mjs';
import { sortEventsByRecent } from '@/utils/eventFilters.mjs';
import { HOMEWORLD_REGION } from '@/enums/worlds.mjs';

const factionIndices = [0, 1, 2];
const FACTION_LABELS = {
    global: 'Global',
    bugs: 'Bugs',
    cyborgs: 'Cyborgs',
    illuminate: 'Illuminate',
};

export default function DashboardClient({ data, mapState }) {
    const [faction, setFaction] = useState('global');

    const events = sortEventsByRecent(data?.events);
    const timeAgo = formatTimeAgo(data.last_updated);

    function renderFrontierCard(index) {
        const campaignData = data.live?.find((l) => l.enemy === index);
        const frontier = computeFrontier(campaignData, mapState[index]);
        if (!frontier) return null;

        const isDefending = frontier.event === 'active';
        const label = isDefending ? 'DEFENDING' : 'CAPTURING';
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
                    label={label}
                    region={frontier.region}
                    percent={frontier.percent}
                    points={frontier.points}
                    pointsMax={frontier.pointsMax}
                    factionIndex={index}
                    pace={activeEvent ? evaluateProgress(activeEvent) : null}
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
                    label="ATTACKING"
                    region={homeworld.region}
                    percent={homeworld.percent}
                    points={homeworld.points}
                    pointsMax={homeworld.points_max}
                    factionIndex={index}
                    pace={attackEvent ? evaluateProgress(attackEvent) : null}
                />
            </li>
        );
    }

    return (
        <div className="dashboard gutters">
            <div className="dashboard-alerts">
                <Alerts data={data} />
            </div>
            <div className="dashboard-map">
                <Galaxy mapState={mapState} />
            </div>
            <div className="dashboard-sidebar">
                <div className="pb-2">
                    <h1 className="font-[family-name:var(--font-display)] text-sm text-[var(--color-primary)]">
                        Track Managed Democracy Across the Galaxy
                    </h1>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Don&apos;t miss a moment of the action! Follow the
                        Helldivers&apos; campaign progress as they battle the Bugs,
                        Cyborgs, and Illuminate for peace, liberty, and managed democracy.
                    </p>
                    {timeAgo && (
                        <p
                            className="mt-2 font-mono text-xs"
                            style={{ color: 'var(--color-text-muted)' }}
                            suppressHydrationWarning
                        >
                            {timeAgo}
                        </p>
                    )}
                </div>
                <section className="flex flex-col gap-2">
                    <h2>Regions</h2>
                    <ul className="sector-grid list-none p-0">
                        {factionIndices.map(renderFrontierCard)}
                        {factionIndices.map(renderHomeworldCard)}
                    </ul>
                </section>
                <section className="flex flex-col gap-2">
                    <h2>Stats — {FACTION_LABELS[faction]}</h2>
                    <FactionTabs active={faction} onChange={setFaction} />
                    <StatGrid live={data.live} faction={faction} events={events} />
                </section>
            </div>
            <button
                className="dashboard-scroll-hint"
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
