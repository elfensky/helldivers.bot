'use client';

import Button from '@/shared/components/Button/Button';

/**
 * Square toggle button that flips the event log sort order.
 */
export default function EventLogSortToggle({ sortOrder, onToggle }) {
    const isDesc = sortOrder === 'desc';
    const label = isDesc ? 'Sort oldest first' : 'Sort newest first';
    return (
        <Button
            size="icon"
            variant="primary"
            onClick={onToggle}
            title={label}
            aria-label={label}
            data-umami-event="event-log-sort-toggle"
        >
            {isDesc ? '↓' : '↑'}
        </Button>
    );
}
