'use client';
import { useState, useEffect } from 'react';

const LG_BREAKPOINT = 1024;
const HERO_VISIBLE_THRESHOLD = 0.25;

/**
 * Watches the homepage hero's scroll position and returns `true` once the
 * hero has scrolled out of view past the `HERO_VISIBLE_THRESHOLD` (i.e.,
 * ≤25% of the hero is currently in the viewport).
 *
 * Only active at `lg:` (≥1024px). Below that breakpoint the hook always
 * returns `false`, so `HomeGalaxyOverlay` stays out of the way and the
 * mobile layout renders normally with an inline `<Galaxy>` inside
 * `DashboardClient`.
 *
 * The scroll listener is rAF-throttled — same pattern used by
 * `src/features/archives/useScrollEvent.mjs`.
 *
 * @param {React.RefObject<HTMLElement>} heroRef - ref to the hero wrapper
 * @returns {boolean} isPinned
 */
export function useHomeMapPinned(heroRef) {
    const [isPinned, setIsPinned] = useState(false);

    useEffect(() => {
        const hero = heroRef.current;
        if (!hero) return;

        let rafId = 0;

        const compute = () => {
            if (window.innerWidth < LG_BREAKPOINT) {
                setIsPinned(false);
                return;
            }
            const rect = hero.getBoundingClientRect();
            const headerHeight = document.getElementById('header')?.offsetHeight ?? 80;
            const visibleTop = Math.max(headerHeight, rect.top);
            const visibleBottom = Math.min(window.innerHeight, rect.bottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            const visibleRatio = rect.height > 0 ? visibleHeight / rect.height : 0;
            setIsPinned(visibleRatio <= HERO_VISIBLE_THRESHOLD);
        };

        const onScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(compute);
        };

        const onResize = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(compute);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);
        compute();

        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(rafId);
        };
    }, [heroRef]);

    return isPinned;
}
