'use client';

import ToggleButton from '@/shared/components/ToggleButton/ToggleButton';

/**
 * Square toggle button that flips the event log sort order.
 */
export default function EventLogSortToggle({ sortOrder, onToggle }) {
    const isDesc = sortOrder === 'desc';
    const label = isDesc ? 'Sort oldest first' : 'Sort newest first';
    return (
        <ToggleButton
            onClick={onToggle}
            title={label}
            aria-label={label}
            data-umami-event="event-log-sort-toggle"
        >
            {isDesc ? '↓' : '↑'}
        </ToggleButton>
    );
}
