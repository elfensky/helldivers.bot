'use client';
import { useState, useCallback } from 'react';
import './ArchivesLayout.css';
import ArchiveStats from '@/features/archives/ArchiveStats';
import ArchivesHeader, { EffectsToggle } from '@/features/archives/ArchivesHeader';
import FactionHealthChart from '@/features/archives/FactionHealthChart';
import FactionTabs from '@/features/dashboard/FactionTabs';
import FactionStats from '@/features/archives/FactionStats';
import EventLog from '@/features/timeline/EventLog';
import ArchiveMap from '@/features/archives/ArchiveMap';
import SeasonSelector from '@/features/archives/SeasonSelector';
import { eventKey } from '@/features/archives/eventKey.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import { useCyberstanEffects } from '@/features/archives/useCyberstanEffects.mjs';
import { useScrollEvent } from '@/features/archives/useScrollEvent.mjs';

export default function ArchivesClient({
    data,
    seasons,
    currentSeason,
    defeatMessageIndex,
}) {
    const events = data?.events ?? [];
    const [faction, setFaction] = useState('bugs');
    const [mapVisible, setMapVisible] = useState(true);
    const isDefeat = getWarOutcome(data)?.outcome === 'defeat';
    const effects = useCyberstanEffects(isDefeat);
    const { selectedEvent, railRef } = useScrollEvent(events);

    // Synced glitch phase from ArchivesHeader → ArchiveStats
    const [glitchPhase, setGlitchPhase] = useState({
        phase: 'idle',
        takeoverMs: 800,
        restoreMs: 800,
    });
    const handlePhaseChange = useCallback((phase, takeoverMs, restoreMs) => {
        setGlitchPhase({ phase, takeoverMs, restoreMs });
    }, []);

    return (
        <div className="archives-page">
            {/* Full-width stats section */}
            <div
                className={`archives-stats-section${isDefeat ? ' cyberstan-defeat' : ''}${effects.watermark ? ' cyberstan-watermark-active' : ''}`}
            >
                <ArchivesHeader
                    isDefeat={isDefeat}
                    effects={effects}
                    defeatMessageIndex={defeatMessageIndex}
                    onPhaseChange={handlePhaseChange}
                />

                <section className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <h2>Statistics</h2>
                        <div className="flex items-center gap-2">
                            {isDefeat && (
                                <EffectsToggle active={effects.headerScramble} />
                            )}
                            <SeasonSelector
                                seasons={seasons}
                                currentSeason={currentSeason}
                            />
                        </div>
                    </div>
                    <ArchiveStats
                        events={events}
                        live={data?.live}
                        data={data}
                        effects={effects}
                        glitchPhase={glitchPhase}
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
                    <EventLog
                        events={events}
                        timeFormat="absolute"
                        title="Event Log"
                        id="archives-event-log"
                        selectedEventKey={selectedEvent ? eventKey(selectedEvent) : null}
                        railRef={railRef}
                        includeToday={false}
                        layout="stack"
                    />
                </div>

                <div className="archives-map-col">
                    {mapVisible && (
                        <ArchiveMap data={data} selectedEvent={selectedEvent} />
                    )}
                </div>
            </div>
        </div>
    );
}
