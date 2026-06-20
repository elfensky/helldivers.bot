import { useMemo } from 'react';
import Galaxy from '@/features/galaxy/Galaxy';
import { computeMapStateAtEvent } from '@/shared/utils/game/computeMapStateAtEvent.mjs';

export default function ArchiveMap({ data, selectedEvent }) {
    const mapState = useMemo(
        () => computeMapStateAtEvent(selectedEvent, data),
        [selectedEvent, data],
    );

    // Archives have no live pulse animation, so no per-sector delays.
    return <Galaxy mapState={mapState} pulseDelays={undefined} />;
}
