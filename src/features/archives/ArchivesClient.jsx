'use client';
import { useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import './ArchivesLayout.css';
import SeasonOverview from '@/features/archives/SeasonOverview';
import SeasonStats from '@/features/archives/SeasonStats';
import FactionSummary from '@/features/archives/FactionSummary';
import ArchiveEventRail from '@/features/archives/ArchiveEventRail';
import ArchiveMap from '@/features/archives/ArchiveMap';
import factions from '@/shared/enums/factions.mjs';
import map from '@/shared/enums/map.mjs';

/** Composite key for uniquely identifying an event (type + event_id). */
function eventKey(event) {
    return `${event.type}-${event.event_id}`;
}

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

export default function ArchivesClient({ data }) {
    const searchParams = useSearchParams();
    const mapRef = useRef(null);
    const events = data?.events ?? [];
    const lastEvent = events.length ? events[events.length - 1] : null;

    // Initialize from URL param or default to last event
    const initialEvent =
        findEventByKey(events, searchParams.get('event')) ?? lastEvent;

    const [selectedEvent, setSelectedEvent] = useState(initialEvent);

    const handleSelect = useCallback((event) => {
        setSelectedEvent(event);
        syncEventToUrl(event);

        // On mobile, scroll to map when event is selected
        if (window.innerWidth < 1024 && mapRef.current) {
            mapRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    return (
        <div className="archives-layout">
            <div className="archives-overview">
                <SeasonOverview data={data} />
            </div>

            <div className="archives-stats">
                <SeasonStats live={data?.live} events={events} />
            </div>

            <div className="archives-analytics-slot">
                {/* Phase 9 analytics slot */}
            </div>

            <div className="archives-factions">
                <FactionSummary live={data?.live} />
            </div>

            <div className="archives-event-rail">
                <ArchiveEventRail
                    events={events}
                    selectedEventKey={selectedEvent ? eventKey(selectedEvent) : null}
                    onSelect={handleSelect}
                />
            </div>

            {/* Map column — sticky on desktop, ordered between factions and event rail on mobile */}
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
                                    {map[selectedEvent.enemy]?.[selectedEvent.region]?.region ??
                                        'Unknown Region'}
                                </div>
                                <div className="text-xs text-text-muted">
                                    {factions[selectedEvent.enemy]?.name ?? 'Unknown'} &middot;{' '}
                                    {selectedEvent.type} &middot;{' '}
                                    {Math.round(
                                        (selectedEvent.end_time - selectedEvent.start_time) / 3600,
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
                                {selectedEvent.status === 'success' ? 'WON' : 'LOST'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
