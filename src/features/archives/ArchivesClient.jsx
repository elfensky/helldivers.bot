'use client';
import { useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import './ArchivesLayout.css';
import SeasonStats from '@/features/archives/SeasonStats';
import CombatStats from '@/features/archives/CombatStats';
import EventStats from '@/features/archives/EventStats';
import FactionTabs from '@/features/dashboard/FactionTabs';
import FactionStats from '@/features/archives/FactionStats';
import ArchiveEventRail from '@/features/archives/ArchiveEventRail';
import ArchiveMap from '@/features/archives/ArchiveMap';
import factions from '@/shared/enums/factions.mjs';
import map from '@/shared/enums/map.mjs';
import SeasonSelector from '@/features/archives/SeasonSelector';
import { eventKey } from '@/features/archives/eventKey.mjs';

function findEventByKey(events, key) {
    if (!key) return null;
    return events.find((e) => eventKey(e) === key) ?? null;
}

function syncEventToUrl(event) {
    const url = new URL(window.location.href);
    if (!event) {
        url.searchParams.delete('event');
    } else {
        url.searchParams.set('event', eventKey(event));
    }
    window.history.pushState(null, '', url.toString());
}

export default function ArchivesClient({ data, seasons, currentSeason }) {
    const searchParams = useSearchParams();
    const mapRef = useRef(null);
    const events = data?.events ?? [];
    const lastEvent = events.length ? events[events.length - 1] : null;

    const initialEvent =
        findEventByKey(events, searchParams.get('event')) ?? lastEvent;

    const [selectedEvent, setSelectedEvent] = useState(initialEvent);
    const [faction, setFaction] = useState('bugs');

    const handleSelect = useCallback((event) => {
        setSelectedEvent(event);
        syncEventToUrl(event);

        if (window.innerWidth < 1024 && mapRef.current) {
            mapRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    return (
        <div className="archives-layout">
            {/* Sidebar */}
            <div className="archives-sidebar">
                <div className="pb-2">
                    <h1 className="font-display text-body text-primary">
                        Declassified Campaign Archives
                    </h1>
                    <p className="mt-1 text-small text-text-muted">
                        Official war records from the Ministry of Truth. Every
                        campaign victory and strategic redeployment has been
                        verified by Super Earth High Command. Browse the complete
                        history of humanity&apos;s glorious fight for managed
                        democracy across the galaxy.
                    </p>
                </div>

                <section className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h2>Statistics</h2>
                        <SeasonSelector
                            seasons={seasons}
                            currentSeason={currentSeason}
                        />
                    </div>
                    <EventStats events={events} data={data} />
                    <SeasonStats live={data?.live} events={events} />
                    <CombatStats live={data?.live} events={events} />
                </section>

                <section className="mt-4 flex flex-col gap-2">
                    <h2>Faction Analysis</h2>
                    <FactionTabs active={faction} onChange={setFaction} />
                    <FactionStats
                        events={events}
                        snapshots={data?.snapshots}
                        pointsMax={data?.points_max}
                        faction={faction}
                    />
                </section>

                <section className="mt-4">
                    <ArchiveEventRail
                        events={events}
                        selectedEventKey={
                            selectedEvent ? eventKey(selectedEvent) : null
                        }
                        onSelect={handleSelect}
                    />
                </section>
            </div>

            {/* Map column */}
            <div className="archives-map-col" ref={mapRef}>
                <ArchiveMap data={data} selectedEvent={selectedEvent} />

                {selectedEvent && (
                    <div
                        className={`border border-ghost bg-surface-1 p-3 ${
                            selectedEvent.type === 'defend'
                                ? 'border-r-[4px] border-r-danger'
                                : 'border-r-[4px] border-r-success'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold">
                                    {map[selectedEvent.enemy]?.[
                                        selectedEvent.region
                                    ]?.region ?? 'Unknown Region'}
                                </div>
                                <div className="text-xs text-text-muted">
                                    {factions[selectedEvent.enemy]?.name ??
                                        'Unknown'}{' '}
                                    &middot; {selectedEvent.type} &middot;{' '}
                                    {Math.round(
                                        (selectedEvent.end_time -
                                            selectedEvent.start_time) /
                                            3600,
                                    )}
                                    h
                                </div>
                            </div>
                            <div
                                className={`text-xs font-bold ${
                                    selectedEvent.status === 'success'
                                        ? 'text-success'
                                        : 'text-danger'
                                }`}
                            >
                                {selectedEvent.status === 'success'
                                    ? 'WON'
                                    : 'LOST'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
