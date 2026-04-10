import { useState, useRef, useEffect, useCallback } from 'react';
import { eventKey } from '@/features/archives/eventKey.mjs';

/**
 * Scroll-driven event selection via IntersectionObserver.
 *
 * Observes event cards (identified by `data-event-key`) inside the rail
 * container. When a card enters the top 40% of the viewport, it becomes
 * the selected event. Returns `null` when no event is in the trigger zone
 * (e.g., page load before user scrolls to events).
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

        const observer = new IntersectionObserver(
            (entries) => {
                // Pick the topmost intersecting entry that is actually visible
                // (non-negative top). Entries with negative top are partially
                // scrolled above the viewport and should not win the selection.
                let best = null;
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    if (entry.boundingClientRect.top < 0) continue;
                    if (
                        !best ||
                        entry.boundingClientRect.top <
                            best.boundingClientRect.top
                    ) {
                        best = entry;
                    }
                }

                if (best) {
                    const key = best.target.dataset.eventKey;
                    const event = lookup.get(key);
                    if (event) setSelectedEvent(event);
                }
            },
            {
                // Shrink bottom by 60% — only the top 40% of viewport is the trigger zone
                rootMargin: '0px 0px -60% 0px',
                threshold: 0,
            },
        );

        const cards = rail.querySelectorAll('[data-event-key]');
        cards.forEach((card) => observer.observe(card));

        return () => observer.disconnect();
    }, [events, eventMap]);

    return { selectedEvent, railRef };
}
