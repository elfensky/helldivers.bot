'use client';

import Button from '@/shared/components/Button/Button';

/**
 * Square toggle button that flips a two-state sort order. The caller owns the
 * domain semantics (which state is "descending", the label, the umami event);
 * this component only renders the arrow + button shell.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.descending - True when the current order is the "↓" state.
 * @param {() => void} props.onToggle - Click handler that flips the order.
 * @param {string} props.label - Accessible label / tooltip for the next action.
 * @param {string} props.umamiEvent - data-umami-event name for click tracking.
 */
export default function SortToggle({ descending, onToggle, label, umamiEvent }) {
    return (
        <Button
            size="icon"
            variant="primary"
            onClick={onToggle}
            title={label}
            aria-label={label}
            data-umami-event={umamiEvent}
        >
            {descending ? '↓' : '↑'}
        </Button>
    );
}
