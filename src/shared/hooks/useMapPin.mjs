import { useState, useRef, useEffect, useCallback } from 'react';

export function useMapPin(defaultPinned = false) {
    const [isMapSticky, setIsMapSticky] = useState(defaultPinned);
    const [isAnimating, setIsAnimating] = useState(false);
    /** @type {import('react').RefObject<ReturnType<typeof setTimeout> | null>} */
    const animTimerRef = useRef(null);

    const togglePin = useCallback(() => {
        setIsMapSticky((v) => {
            const next = !v;
            clearTimeout(animTimerRef.current ?? undefined);
            if (next) {
                setIsAnimating(true);
                animTimerRef.current = setTimeout(() => setIsAnimating(false), 400);
            } else {
                setIsAnimating(false);
            }
            return next;
        });
    }, []);

    useEffect(() => () => clearTimeout(animTimerRef.current ?? undefined), []);

    return { isMapSticky, isAnimating, togglePin };
}
