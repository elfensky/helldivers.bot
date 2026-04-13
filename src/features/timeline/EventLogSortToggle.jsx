'use client';

/**
 * 30×30 square toggle button that flips the event log sort order.
 * Mirrors the `EffectsToggle` pattern from `ArchivesHeader.jsx`.
 */
export default function EventLogSortToggle({ sortOrder, onToggle }) {
    const isDesc = sortOrder === 'desc';
    return (
        <button
            type="button"
            onClick={onToggle}
            title={isDesc ? 'Sort oldest first' : 'Sort newest first'}
            aria-label={isDesc ? 'Sort oldest first' : 'Sort newest first'}
            data-umami-event="event-log-sort-toggle"
            className="inline-flex size-[30px] cursor-pointer items-center justify-center border border-primary font-mono text-primary hover:bg-primary hover:text-surface-0"
        >
            {isDesc ? '↓' : '↑'}
        </button>
    );
}
