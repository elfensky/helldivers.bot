'use client';

import Button from '@/shared/components/Button/Button';

/**
 * Square toggle button that flips the cascade log sort order.
 * Mirror of EventLogSortToggle, with 'worst' | 'recent' semantics.
 */
export default function CascadeLogSortToggle({ sortOrder, onToggle }) {
    const isWorst = sortOrder === 'worst';
    const label = isWorst ? 'Sort recent first' : 'Sort worst first';
    return (
        <Button
            size="icon"
            variant="primary"
            onClick={onToggle}
            title={label}
            aria-label={label}
            data-umami-event="cascade-log-sort-toggle"
        >
            {isWorst ? '↓' : '↑'}
        </Button>
    );
}
