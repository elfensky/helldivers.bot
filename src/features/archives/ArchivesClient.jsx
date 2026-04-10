'use client';
import { useState } from 'react';
import './ArchivesLayout.css';
import ArchiveStats from '@/features/archives/ArchiveStats';
import ArchivesHeader from '@/features/archives/ArchivesHeader';
import FactionHealthChart from '@/features/archives/FactionHealthChart';
import FactionTabs from '@/features/dashboard/FactionTabs';
import FactionStats from '@/features/archives/FactionStats';
import ArchiveEventRail from '@/features/archives/ArchiveEventRail';
import ArchiveMap from '@/features/archives/ArchiveMap';
import factions from '@/shared/enums/factions.mjs';
import mapEnum from '@/shared/enums/map.mjs';
import SeasonSelector from '@/features/archives/SeasonSelector';
import { eventKey } from '@/features/archives/eventKey.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import { useCyberstanEffects } from '@/features/archives/useCyberstanEffects.mjs';
import { useScrollEvent } from '@/features/archives/useScrollEvent.mjs';

export default function ArchivesClient({ data, seasons, currentSeason }) {
    const events = data?.events ?? [];
    const [faction, setFaction] = useState('bugs');
    const [mapVisible, setMapVisible] = useState(true);
    const isDefeat = getWarOutcome(data)?.outcome === 'defeat';
    const effects = useCyberstanEffects(isDefeat);
    const { selectedEvent, railRef } = useScrollEvent(events);

    return (
        <div className="archives-page">
            {/* Full-width stats section */}
            <div className={`archives-stats-section${isDefeat ? ' cyberstan-defeat' : ''}${effects.watermark ? ' cyberstan-watermark-active' : ''}`}>
                <ArchivesHeader isDefeat={isDefeat} effects={effects} />

                <section className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h2>Statistics</h2>
                        <SeasonSelector
                            seasons={seasons}
                            currentSeason={currentSeason}
                        />
                    </div>
                    <ArchiveStats
                        events={events}
                        live={data?.live}
                        data={data}
                        effects={effects}
                    />
                </section>

                <section className="mt-4 flex flex-col gap-2">
                    <h2>Conquest Progress</h2>
                    <FactionHealthChart
                        snapshots={data?.snapshots}
                        pointsMax={data?.points_max}
                    />
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
            </div>

            {/* Mobile FAB to toggle map — hidden at lg: */}
            <button
                className="archives-map-toggle"
                onClick={() => setMapVisible((v) => !v)}
                aria-label={mapVisible ? 'Hide map' : 'Show map'}
                data-umami-event="archive-map-toggle"
            >
                {mapVisible ? '✕' : '🗺'}
            </button>

            {/* Two-column scrollytelling: event log + sticky map */}
            <div className="archives-scrollytelling">
                <div className="archives-event-col">
                    <ArchiveEventRail
                        events={events}
                        selectedEventKey={
                            selectedEvent ? eventKey(selectedEvent) : null
                        }
                        railRef={railRef}
                    />
                </div>

                <div className="archives-map-col">
                    {mapVisible && (
                        <>
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
                                                {mapEnum[selectedEvent.enemy]?.[
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
