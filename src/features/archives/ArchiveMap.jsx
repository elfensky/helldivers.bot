import { useMemo } from 'react';
import Galaxy from '@/features/galaxy/Galaxy';
import { computeMapState } from '@/shared/utils/game/computeMapState.mjs';

const HIDDEN_STATES = [
    { enemy: 0, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
    { enemy: 1, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
    { enemy: 2, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
];

/**
 * Reconstruct map state at a specific event's start time.
 *
 * Uses the nearest snapshot as a base, then replays events from the gap
 * between snapshot time and selected event time. This handles stale snapshots:
 *
 *   snapshot ──── gap events (completed) ──── selected event (active)
 *   (base)        (replay with real status)    (show as active)
 *
 * Gap events are NOT reflected in the snapshot's points (they happened after
 * the snapshot was taken). Active events are happening right now.
 * computeMapState processes both: gap events update sector ownership via
 * their real status (fail cascades, success holds), active events show
 * contested regions.
 */
function computeMapStateAtEvent(selectedEvent, data) {
    const snapshots = data?.snapshots ?? [];

    if (!snapshots.length || !selectedEvent) {
        return computeMapState(HIDDEN_STATES, []);
    }

    const time = selectedEvent.start_time;

    const nearest = snapshots
        .filter((s) => s.time <= time)
        .sort((a, b) => b.time - a.time)[0];

    if (!nearest) {
        return computeMapState(HIDDEN_STATES, []);
    }

    const parsed =
        typeof nearest.data === 'string' ? JSON.parse(nearest.data) : nearest.data;

    const pointsMaxArr = data.points_max?.points ?? [];

    const factionStates = (parsed ?? []).map((campaign, i) => {
        const enemy = campaign.enemy ?? i;
        return {
            enemy,
            points: campaign.points,
            points_taken: campaign.points_taken ?? 0,
            points_max: pointsMaxArr[enemy] ?? campaign.points_max ?? 1,
            status: campaign.status,
        };
    });

    const allEvents = data.events ?? [];

    // Gap events: completed AFTER snapshot but BEFORE selected event.
    // These are not reflected in the snapshot's points — replay them
    // with their real status so computeMapState applies the correct
    // sector ownership changes (failed defend cascades, etc.).
    const gapEvents = allEvents
        .filter((e) => e.end_time > nearest.time && e.end_time <= time)
        .sort((a, b) => a.end_time - b.end_time);

    // Active events: happening at the selected moment.
    const activeEvents = allEvents
        .filter((e) => e.start_time <= time && e.end_time > time)
        .map((e) => ({ ...e, status: 'active' }));

    return computeMapState(factionStates, [...gapEvents, ...activeEvents]);
}

export default function ArchiveMap({ data, selectedEvent }) {
    const mapState = useMemo(
        () => computeMapStateAtEvent(selectedEvent, data),
        [selectedEvent, data],
    );

    return <Galaxy mapState={mapState} />;
}
