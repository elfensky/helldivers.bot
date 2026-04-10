import { useState, useRef, useEffect, useCallback } from 'react';
import { eventKey } from '@/features/archives/eventKey.mjs';

/**
 * Scroll-driven event selection.
 *
 * Uses a scroll listener (throttled via rAF) instead of IntersectionObserver
 * to avoid edge cases with the fixed header, partial callbacks, and scroll
 * direction. Selects the first event card whose top edge is visible below
 * the fixed header.
 */
export function useScrollEvent(events) {
    const [selectedEvent, setSelectedEvent] = useState(null);
    const railRef = useRef(null);

    // Build a lookup map: eventKey string → event object
    const eventMap = useCallback(() => {
        const m = new Map();
        for (const e of events ?? []) {
            m.set(eventKey(e), e);
        }
        return m;
    }, [events]);

    useEffect(() => {
        const rail = railRef.current;
        if (!rail || !events?.length) return;

        const lookup = eventMap();
        let rafId = 0;

        const updateSelection = () => {
            const headerHeight =
                document.getElementById('header')?.offsetHeight ?? 80;

            const cards = rail.querySelectorAll('[data-event-key]');
            let best = null;
            for (const card of cards) {
                const top = card.getBoundingClientRect().top;
                // First card whose top is at or below the header bottom
                if (top >= headerHeight) {
                    best = card;
                    break;
                }
            }

            if (best) {
                const key = best.dataset.eventKey;
                const event = lookup.get(key);
                if (event) setSelectedEvent(event);
            } else {
                setSelectedEvent(null);
            }
        };

        const onScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(updateSelection);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        // Run once on mount to set initial selection
        updateSelection();

        return () => {
            window.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(rafId);
        };
    }, [events, eventMap]);

    return { selectedEvent, railRef };
}
