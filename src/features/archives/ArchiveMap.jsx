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

    // Only pass events active at this moment — completed events are already
    // reflected in the snapshot's points values.
    const activeEvents = (data.events ?? [])
        .filter((e) => e.start_time <= time && e.end_time > time)
        .map((e) => ({ ...e, status: 'active' }));

    // Correct stale snapshot points using active defend events.
    // A defend on region N means the frontier is at N:
    //   - At least N sectors captured (boost if snapshot is behind)
    //   - At most N sectors captured (cap if snapshot is ahead)
    // This handles both directions of snapshot staleness.
    const factionStates = (parsed ?? []).map((campaign, i) => {
        const enemy = campaign.enemy ?? i;
        const pMax = pointsMaxArr[enemy] ?? campaign.points_max ?? 1;
        const pointsPerSector = pMax / 10;
        let points = campaign.points;

        const defendRegions = activeEvents
            .filter((e) => e.enemy === enemy && e.type === 'defend' && e.region > 0 && e.region <= 10)
            .map((e) => e.region);

        if (defendRegions.length > 0) {
            const maxDefendRegion = Math.max(...defendRegions);
            // Frontier is at this region — clamp points to exactly this many sectors
            points = maxDefendRegion * pointsPerSector;
        }

        return {
            enemy,
            points,
            points_taken: campaign.points_taken ?? 0,
            points_max: pMax,
            status: campaign.status,
        };
    });

    return computeMapState(factionStates, activeEvents);
}

export default function ArchiveMap({ data, selectedEvent }) {
    const mapState = useMemo(
        () => computeMapStateAtEvent(selectedEvent, data),
        [selectedEvent, data],
    );

    return <Galaxy mapState={mapState} />;
}
