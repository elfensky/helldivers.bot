'use client';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import './WarTimeline.css';
import { computeMapState } from '@/utils/computeMapState.mjs';
import { formatTimestamp } from '@/utils/time.mjs';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import factions from '@/enums/factions';

const KIND_PRIORITY = { snapshot: 0, event_start: 1, event_end: 2 };

export function formatEventLabel(event, phase) {
    const factionName = factions[event.enemy]?.name ?? `Faction ${event.enemy}`;
    const typeLabel = event.type === 'defend' ? 'Defend' : 'Attack';

    if (phase === 'start') {
        return `${typeLabel} begins: ${factionName}`;
    }

    const outcome = event.status === 'success' ? 'Won' : 'Failed';
    return `${typeLabel} ${outcome}: ${factionName}`;
}

export function buildTimeline(data) {
    const moments = [];

    for (const s of data.snapshots ?? []) {
        moments.push({ kind: 'snapshot', time: s.time, snapshot: s, label: 'Snapshot' });
    }

    for (const e of data.events ?? []) {
        moments.push({
            kind: 'event_start',
            time: e.start_time,
            event: e,
            label: formatEventLabel(e, 'start'),
        });

        const isResolved = e.status !== 'active' && e.end_time !== e.start_time;
        if (isResolved) {
            moments.push({
                kind: 'event_end',
                time: e.end_time,
                event: e,
                label: formatEventLabel(e, 'end'),
            });
        }
    }

    moments.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        return KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    });

    return moments;
}

export function computeMomentMapState(moment, data) {
    const snapshots = data.snapshots ?? [];

    const nearest = snapshots
        .filter((s) => s.time <= moment.time)
        .sort((a, b) => b.time - a.time)[0];

    if (!nearest) {
        const hiddenStates = [
            { enemy: 0, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
            { enemy: 1, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
            { enemy: 2, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
        ];
        return computeMapState(hiddenStates, []);
    }

    const parsed =
        typeof nearest.data === 'string' ? JSON.parse(nearest.data) : nearest.data;

    const pointsMaxArr = data.points_max?.points ?? [];

    const factionStates = (parsed ?? []).map((campaign, i) => ({
        enemy: campaign.enemy ?? i,
        points: campaign.points,
        points_taken: campaign.points_taken ?? 0,
        points_max: pointsMaxArr[campaign.enemy ?? i] ?? campaign.points_max ?? 1,
        status: campaign.status,
    }));

    const activeEvents = (data.events ?? [])
        .filter((e) => {
            const isActive = e.start_time <= moment.time && e.end_time >= moment.time;
            const isCompleted =
                e.end_time <= moment.time &&
                (e.status === 'success' || e.status === 'fail');
            return isActive || isCompleted;
        })
        .map((e) => ({
            ...e,
            status:
                e.start_time <= moment.time && e.end_time > moment.time ?
                    'active'
                :   e.status,
        }));

    return computeMapState(factionStates, activeEvents);
}

function syncTimelineToUrl(idx) {
    const url = new URL(window.location.href);
    if (idx === null) {
        url.searchParams.delete('timeline');
    } else {
        url.searchParams.set('timeline', String(idx));
    }
    window.history.replaceState(null, '', url.toString());
}

export default function WarTimeline({ data, defaultMapState }) {
    const searchParams = useSearchParams();

    const [selectedIndex, setSelectedIndex] = useState(null);

    const moments = useMemo(() => buildTimeline(data), [data]);

    // Sync selectedIndex from URL params (runs on mount, season change, and param change)
    useEffect(() => {
        const param = searchParams.get('timeline');
        if (param === null) {
            setSelectedIndex(null);
        } else {
            const idx = parseInt(param, 10);
            const clamped =
                Number.isFinite(idx) && moments.length > 0 ?
                    Math.min(idx, moments.length - 1)
                :   null;
            setSelectedIndex(clamped);
        }
    }, [searchParams, data, moments.length]);

    const currentMapState = useMemo(() => {
        if (selectedIndex === null || moments.length === 0) return defaultMapState;
        const clamped = Math.min(selectedIndex, moments.length - 1);
        const moment = moments[clamped];
        const result = computeMomentMapState(moment, data);
        // DEBUG: log bug sector statuses
        return result;
    }, [selectedIndex, moments, data, defaultMapState]);

    if (moments.length === 0) {
        return <Galaxy mapState={defaultMapState} />;
    }

    const activeIndex = selectedIndex ?? 0;
    const activeMoment = moments[activeIndex];

    const eventMoments = moments
        .map((m, i) => ({ moment: m, index: i }))
        .filter(({ moment }) => moment.kind !== 'snapshot');

    const carouselRef = useRef(null);

    const selectMoment = useCallback(
        (idx) => {
            setSelectedIndex(idx);
            syncTimelineToUrl(idx);
        },
        [setSelectedIndex],
    );

    // Auto-scroll carousel to active card
    useEffect(() => {
        const container = carouselRef.current;
        if (!container) return;
        const activeCard = container.querySelector('.timeline-card.active');
        if (activeCard) {
            activeCard.scrollIntoView({
                behavior: 'smooth',
                inline: 'center',
                block: 'nearest',
            });
        }
    }, [activeIndex]);

    function getCardClass(moment) {
        if (moment.kind === 'snapshot') return 'timeline-card snapshot';
        if (moment.event?.type === 'defend') return 'timeline-card defend';
        return 'timeline-card attack';
    }

    return (
        <div className="war-timeline">
            {/* Desktop: range slider */}
            <div className="timeline-controls timeline-desktop">
                <div className="timeline-track">
                    {eventMoments.map(({ moment, index }) => {
                        const percent = (index / (moments.length - 1)) * 100;
                        const eventType = moment.event?.type;
                        const markerClass =
                            eventType === 'defend' ?
                                'timeline-marker defend'
                            :   'timeline-marker attack';
                        return (
                            <span
                                key={`${moment.kind}-${moment.time}-${moment.event?.event_id ?? index}`}
                                className={markerClass}
                                style={{ left: `${percent}%` }}
                                aria-hidden="true"
                            />
                        );
                    })}
                </div>

                <input
                    type="range"
                    className="timeline-range"
                    min={0}
                    max={moments.length - 1}
                    value={activeIndex}
                    onChange={(e) => selectMoment(Number(e.target.value))}
                    aria-label="War timeline"
                    aria-valuetext={formatTimestamp(activeMoment.time)}
                />

                <div className="timeline-info">
                    <span className="timeline-info-label">{activeMoment.label}</span>
                    <span className="timeline-info-time">
                        {formatTimestamp(activeMoment.time)}
                    </span>
                </div>
            </div>

            {/* Mobile: carousel */}
            <div className="timeline-controls timeline-mobile">
                <div className="timeline-nav">
                    <button
                        className="timeline-nav-btn"
                        onClick={() => selectMoment(Math.max(0, activeIndex - 1))}
                        disabled={activeIndex === 0}
                        aria-label="Previous moment"
                    >
                        ‹
                    </button>
                    <span className="timeline-nav-count">
                        {activeIndex + 1} / {moments.length}
                    </span>
                    <button
                        className="timeline-nav-btn"
                        onClick={() =>
                            selectMoment(Math.min(moments.length - 1, activeIndex + 1))
                        }
                        disabled={activeIndex === moments.length - 1}
                        aria-label="Next moment"
                    >
                        ›
                    </button>
                </div>
                <div className="timeline-carousel" ref={carouselRef}>
                    {moments.map((moment, index) => (
                        <button
                            key={`${moment.kind}-${moment.time}-${moment.event?.event_id ?? index}`}
                            className={`${getCardClass(moment)}${index === activeIndex ? ' active' : ''}`}
                            onClick={() => selectMoment(index)}
                        >
                            <span className="timeline-card-label">{moment.label}</span>
                            <span className="timeline-card-time">
                                {formatTimestamp(moment.time)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <Galaxy mapState={currentMapState} />
        </div>
    );
}
