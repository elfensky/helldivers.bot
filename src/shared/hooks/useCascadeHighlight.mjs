import { useCallback, useEffect, useRef, useState } from 'react';
import { eventKey } from '@/shared/utils/game/eventKey.mjs';
import { findCascadeByEventKey } from '@/shared/utils/game/findCascadeByEventKey.mjs';

// Scroll events within this window (ms) after a pin are ignored, so the
// programmatic smooth-scroll and macOS inertial fling don't dismiss the
// highlight before the user can see it.
const DISMISS_GRACE_MS = 700;

/**
 * Cascade deep-link highlight for the archives event log.
 *
 * Clicking a cascade card (same page) or landing on `/archives#<eventKey>`
 * (direct / external / back-forward) pins a persistent highlight across every
 * event in that cascade and scrolls the log to the topmost-in-DOM member. The
 * highlight clears when the user scrolls away or pins another cascade.
 *
 * @param {Array<object>} cascades - Cascades for the current season (each has `events`).
 * @param {{ current: HTMLElement | null }} railRef - Stable ref (from useRef) on the event-log container. Passing a non-stable ref object re-fires the hash effect every render.
 * @returns {{ highlightedKeys: Set<string> | null, pinCascade: (cascade: object) => void }}
 */
export function useCascadeHighlight(cascades, railRef) {
    const [highlightedKeys, setHighlightedKeys] = useState(
        /** @type {Set<string> | null} */ (null),
    );
    // Hash listeners are registered once; read cascades through a ref so they
    // always see the latest season's data without re-subscribing each render.
    const cascadesRef = useRef(cascades);
    cascadesRef.current = cascades;
    // Cleanup for the currently-armed scroll-away listener (one at a time).
    const dismissCleanupRef = useRef(/** @type {null | (() => void)} */ (null));

    const pinCascade = useCallback(
        (cascade) => {
            if (!cascade?.events?.length) return;
            const keys = new Set(cascade.events.map(eventKey));
            setHighlightedKeys(keys);

            // Scroll to the topmost highlighted card in current DOM order
            // (sort-agnostic). Double rAF so layout has painted before measuring.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const rail = railRef.current;
                    if (!rail) return;
                    let topEl = null;
                    let topY = Infinity;
                    for (const key of keys) {
                        const el = rail.querySelector(`[data-event-key="${key}"]`);
                        if (!el) continue;
                        const y = el.getBoundingClientRect().top;
                        if (y < topY) {
                            topY = y;
                            topEl = el;
                        }
                    }
                    topEl?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                });
            });

            // Arm a self-removing scroll-away dismiss; ignore scroll during the
            // grace window so the programmatic/inertial scroll doesn't clear it.
            dismissCleanupRef.current?.();
            const armedAt = Date.now() + DISMISS_GRACE_MS;
            function onScroll() {
                if (Date.now() < armedAt) return;
                setHighlightedKeys(null);
                cleanup();
            }
            function cleanup() {
                window.removeEventListener('wheel', onScroll);
                window.removeEventListener('touchmove', onScroll);
                dismissCleanupRef.current = null;
            }
            window.addEventListener('wheel', onScroll, { passive: true });
            window.addEventListener('touchmove', onScroll, { passive: true });
            dismissCleanupRef.current = cleanup;
        },
        [railRef],
    );

    useEffect(() => {
        const resolveHash = () => {
            const key = window.location.hash.slice(1);
            if (!key) return;
            const cascade = findCascadeByEventKey(cascadesRef.current, key);
            if (cascade) pinCascade(cascade);
        };
        resolveHash(); // direct / external / reload with a hash already present
        window.addEventListener('hashchange', resolveHash);
        window.addEventListener('popstate', resolveHash);
        return () => {
            window.removeEventListener('hashchange', resolveHash);
            window.removeEventListener('popstate', resolveHash);
            dismissCleanupRef.current?.();
        };
    }, [pinCascade]);

    return { highlightedKeys, pinCascade };
}
