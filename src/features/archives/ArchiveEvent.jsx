import factions from '@/shared/enums/factions.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';
import EventCardLayout, { STATUS_STYLES } from '@/features/timeline/EventCardLayout';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

/**
 * Archive event card — historical variant of Event.
 * Shows final duration and outcome. Highlighted when scroll-selected.
 * Reuses EventCardLayout for consistent styling with dashboard events.
 */
export default function ArchiveEvent({ event, isActive }) {
    const duration = event.end_time - event.start_time;
    const faction = factions[event.enemy];
    const regionName = getEventRegionLabel(event);

    const statusText =
        event.status === 'success' ? 'Won'
        : event.status === 'fail' ? 'Failed'
        : 'Active';

    const s = STATUS_STYLES[event.status] || STATUS_STYLES.active;

    return (
        <EventCardLayout
            status={event.status}
            className={isActive ? 'border-l-[4px] border-l-primary !bg-primary-tint' : ''}
        >
            <div className="flex flex-col gap-1 px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                    <span className="font-body text-small font-bold text-text uppercase">
                        {statusText} {event.type}
                    </span>
                    <span className={`px-1.5 py-px font-mono text-[10px] ${s.pill}`}>
                        {formatCompactDuration(duration)}
                    </span>
                    {faction && (
                        <img src={faction.icon} alt={faction.name} className="size-5" />
                    )}
                </div>
                <span className="text-small text-text">{regionName}</span>
            </div>
        </EventCardLayout>
    );
}
