import { useState, useRef, useEffect, useCallback } from 'react';
import { eventKey } from '@/features/archives/eventKey.mjs';

/**
 * Scroll-driven event selection.
 *
 * Uses a scroll listener (throttled via rAF) instead of IntersectionObserver
 * to avoid edge cases with the fixed header, partial callbacks, and scroll
 * direction. Selects the event card whose center is nearest a focal anchor
 * at 38% of the visible area below the header (upper-third bias).
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
            const visibleHeight = window.innerHeight - headerHeight;
            const anchor = headerHeight + visibleHeight * 0.38;

            const cards = rail.querySelectorAll('[data-event-key]');
            let best = null;
            let bestDist = Infinity;
            for (const card of cards) {
                const rect = card.getBoundingClientRect();
                const cardMid = rect.top + rect.height / 2;
                const dist = Math.abs(cardMid - anchor);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = card;
                } else {
                    break; // DOM-ordered: distance only increases from here
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
