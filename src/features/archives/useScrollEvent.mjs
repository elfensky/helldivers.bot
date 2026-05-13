import { useState, useRef, useEffect, useCallback } from 'react';
import { eventKey } from '@/features/archives/eventKey.mjs';

/**
 * Scroll-driven event selection.
 *
 * Uses a scroll listener (throttled via rAF) instead of IntersectionObserver
 * to avoid edge cases with the fixed header, partial callbacks, and scroll
 * direction. Selects the event card whose center is nearest a dynamic focal
 * anchor.
 *
 * Anchor placement is viewport-dependent:
 *   - Desktop (≥1024px wide): upper-third (38%) → lower-third (62%) near the
 *     bottom of the page. Event log is in the left column, map is on the
 *     right — no overlap, so the anchor can sit high for a natural reading
 *     position.
 *   - Mobile (<1024px wide): lower quarter (75%) → 90% near the bottom. When
 *     the user pins the galaxy map to the top via the FAB, the pinned map
 *     occupies roughly the upper half of the viewport; a low anchor keeps
 *     the selected card visible beneath the map's drop-shadow halo. Even
 *     when the map isn't pinned, the lower anchor is a consistent default.
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
            const headerHeight = document.getElementById('header')?.offsetHeight ?? 80;
            const visibleHeight = window.innerHeight - headerHeight;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const bottomProximity = Math.max(
                0,
                Math.min(1, 1 - (maxScroll - window.scrollY) / visibleHeight),
            );
            // Mobile (<lg) uses a lower anchor (75% → 90%) so the selected
            // card stays below a pinned map's drop-shadow halo. Desktop
            // keeps the upper-third anchor (38% → 62%).
            const isMobile = window.innerWidth < 1024;
            const topAnchor = isMobile ? 0.75 : 0.38;
            const driftRange = isMobile ? 0.15 : 0.24;
            const ratio = topAnchor + bottomProximity * driftRange;
            const anchor = headerHeight + visibleHeight * ratio;

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
                const rect = best.getBoundingClientRect();
                const isVisible = rect.bottom > headerHeight && rect.top < window.innerHeight;
                if (isVisible) {
                    const key = best.dataset.eventKey;
                    const event = lookup.get(key);
                    if (event) setSelectedEvent(event);
                } else {
                    setSelectedEvent(null);
                }
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
