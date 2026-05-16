import { useState, useRef, useEffect, useCallback } from 'react';

export function useMapPin(defaultPinned = false) {
    const [isMapSticky, setIsMapSticky] = useState(defaultPinned);
    const [isAnimating, setIsAnimating] = useState(false);
    const animTimerRef = useRef(null);

    const togglePin = useCallback(() => {
        setIsMapSticky((v) => {
            const next = !v;
            clearTimeout(animTimerRef.current);
            if (next) {
                setIsAnimating(true);
                animTimerRef.current = setTimeout(() => setIsAnimating(false), 400);
            } else {
                setIsAnimating(false);
            }
            return next;
        });
    }, []);

    useEffect(() => () => clearTimeout(animTimerRef.current), []);

    return { isMapSticky, isAnimating, togglePin };
}
