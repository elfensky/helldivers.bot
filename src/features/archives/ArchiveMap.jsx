import { useMemo } from 'react';
import Galaxy from '@/features/galaxy/Galaxy';
import { computeMapState } from '@/shared/utils/game/computeMapState.mjs';

const HIDDEN_STATES = [
    { enemy: 0, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
    { enemy: 1, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
    { enemy: 2, points: 0, points_taken: 0, points_max: 1, status: 'hidden' },
];

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

    const factionStates = (parsed ?? []).map((campaign, i) => ({
        enemy: campaign.enemy ?? i,
        points: campaign.points,
        points_taken: campaign.points_taken ?? 0,
        points_max: pointsMaxArr[campaign.enemy ?? i] ?? campaign.points_max ?? 1,
        status: campaign.status,
    }));

    // Only pass events active at this moment — completed events are already
    // reflected in the snapshot's points values. Passing completed defend events
    // would double-count their region-loss cascades.
    const activeEvents = (data.events ?? [])
        .filter((e) => e.start_time <= time && e.end_time > time)
        .map((e) => ({ ...e, status: 'active' }));

    return computeMapState(factionStates, activeEvents);
}

export default function ArchiveMap({ data, selectedEvent }) {
    const mapState = useMemo(
        () => computeMapStateAtEvent(selectedEvent, data),
        [selectedEvent, data],
    );

    return <Galaxy mapState={mapState} />;
}
