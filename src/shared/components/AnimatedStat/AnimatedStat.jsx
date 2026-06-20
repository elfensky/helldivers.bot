'use client';

import { useEffect, useRef, useState } from 'react';
import SlotCounter from 'react-slot-counter';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

// Treat every non-digit character (letters, punctuation, whitespace, symbols) as
// a static separator so that outputs like "14.3M", "20.6%", "7/11", and
// "2,145 ahead" only slot the digits and leave the rest still.
const isSeparator = (c) => typeof c === 'string' && !/[0-9]/.test(c);

// Values going up roll in from below (like a forward-ticking odometer);
// values going down roll in from above. Non-numeric or unchanged values
// fall back to the supplied default.
function directionForDelta(prev, next, fallback) {
    const a = Number(prev);
    const b = Number(next);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return fallback;
    if (b > a) return 'bottom-up';
    if (b < a) return 'top-down';
    return fallback;
}

function prefersReducedMotion() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Wrapper around `react-slot-counter` that renders statically on first paint
 * and only animates on subsequent value changes. Intended for values that
 * update via live polling so the page load itself doesn't spin digits.
 *
 * Direction tracks the sign of the change: increases roll in from below,
 * decreases from above. Pass `direction` to override. Omitting `duration`
 * lets the library's own default (0.7s) apply; pass a number to override.
 *
 * Respects `prefers-reduced-motion`: when set, renders the formatted value
 * as plain text and never instantiates the slot counter.
 *
 * @param {object} props - Component props.
 * @param {string | number | null | undefined} props.value - The value to display.
 * @param {(n: string | number | null | undefined) => string} [props.format] - Formatter applied to `value`.
 * @param {'bottom-up' | 'top-down'} [props.direction] - Roll direction override; defaults to the sign of the change.
 * @param {number} [props.duration] - Animation duration in seconds; omit to use the library default.
 * @param {boolean} [props.sequentialAnimationMode] - Animate digits sequentially.
 * @param {boolean} [props.useMonospaceWidth] - Render digits at a fixed monospace width.
 */
export default function AnimatedStat({
    value,
    format = formatNumber,
    direction,
    duration,
    sequentialAnimationMode = false,
    useMonospaceWidth = true,
}) {
    const formatted = format(value);
    const [initialValue] = useState(formatted);
    const prevValueRef = useRef(value);
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        setReduced(prefersReducedMotion());
    }, []);

    const autoDirection = directionForDelta(prevValueRef.current, value, 'bottom-up');

    useEffect(() => {
        prevValueRef.current = value;
    }, [value]);

    if (reduced) {
        return <span className="slot-stat-static">{formatted}</span>;
    }

    return (
        <SlotCounter
            value={formatted}
            startValue={initialValue}
            startValueOnce
            duration={duration}
            direction={direction ?? autoDirection}
            isSeparatorCharacter={isSeparator}
            sequentialAnimationMode={sequentialAnimationMode}
            useMonospaceWidth={useMonospaceWidth}
        />
    );
}
