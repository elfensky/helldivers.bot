'use client';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MinistryContext } from '@/features/ministry/MinistryContext.mjs';
import { createRegistry } from '@/features/ministry/ministryRegistry.mjs';
import { pickAlt } from '@/features/ministry/ministryContent.mjs';
import { CYCLE_MS } from '@/features/ministry/useMinistryHijackCycle.mjs';

const HIJACK_MIN_MS = 2 * 60 * 1000;
const HIJACK_MAX_MS = 5 * 60 * 1000;
const FLICKER_MIN_MS = 15 * 1000;
const FLICKER_MAX_MS = 30 * 1000;
const FLICKER_DUR_MIN_MS = 150;
const FLICKER_DUR_MAX_MS = 300;

function randomBetween(min, max, rng) {
    return min + rng() * (max - min);
}

/**
 * MinistryProvider — root of the Ministry Interference subsystem.
 *
 * Nested INSIDE the existing <LiveDataProvider> in layout.jsx. Owns:
 *  - A module-level registry (useRef) so Hijackable mount/unmount
 *    does NOT trigger context invalidation or React re-renders.
 *  - Two setTimeout-driven schedulers (hijack + ambient flicker).
 *  - A `prefers-reduced-motion` matchMedia listener (live).
 *  - Its own `document.visibilitychange` listener — see plan note for
 *    why this is NOT shared with LiveDataProvider (LiveDataProvider
 *    does not expose visibility in its context; one extra listener is
 *    cheaper than refactoring shared infra).
 *  - A pathname ref updated on every navigation — scope eligibility
 *    is evaluated against the ref at pick-time, NOT via a re-render
 *    dependency, to eliminate the post-navigation stale-scope race.
 *
 * @param {object} props Component props
 * @param {'winning' | 'losing' | null} props.warTone War faction status for tone selection
 * @param {React.ReactNode} props.children Child components
 */
export default function MinistryProvider({ warTone, children }) {
    const registryRef = useRef(createRegistry());
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    // Reduced-motion: read once on mount via matchMedia and re-evaluate on change.
    const [reducedMotion, setReducedMotion] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        const onChange = (e) => setReducedMotion(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const enabled = warTone !== null && !reducedMotion;

    // Stable callbacks — referentially identical for the lifetime of the provider.
    const register = useCallback((id, descriptor) => {
        if (!registryRef.current) return;
        registryRef.current.register(id, descriptor);
    }, []);

    const unregister = useCallback((id) => {
        if (!registryRef.current) return;
        registryRef.current.unregister(id);
    }, []);

    const setIdle = useCallback((id, isIdle) => {
        if (!registryRef.current) return;
        registryRef.current.setIdle(id, isIdle);
    }, []);

    // Context value re-creates only when warTone or enabled change (e.g., reduced-motion
    // toggle, or parent re-render with a different tone). Registry mutations via the Map
    // never invalidate this object — that's the stability guarantee.
    const ctxValue = useMemo(
        () => ({ register, unregister, setIdle, warTone, enabled }),
        [register, unregister, setIdle, warTone, enabled],
    );

    // ─── Hijack scheduler ────────────────────────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        let timer = null;
        let cycleResetTimer = null;
        let cancelled = false;
        const rng = Math.random;
        const reg = registryRef.current;

        function scheduleNext() {
            if (cancelled) return;
            const delay = randomBetween(HIJACK_MIN_MS, HIJACK_MAX_MS, rng);
            timer = setTimeout(tick, delay);
        }

        function tick() {
            if (cancelled) return;
            if (typeof document !== 'undefined' && document.hidden) {
                scheduleNext();
                return;
            }
            try {
                const picked = reg.pickEligible({
                    rng,
                    pathname: pathnameRef.current ?? '/',
                    requireIdle: false,
                });
                if (!picked) {
                    scheduleNext();
                    return;
                }
                const { id, entry } = picked;
                const altText = entry.altText ?? pickAlt(entry.category, warTone, rng);
                if (!altText) {
                    scheduleNext();
                    return;
                }
                reg.setIdle(id, false);
                entry.onHijack(altText);
                cycleResetTimer = setTimeout(() => {
                    reg.setIdle(id, true);
                    scheduleNext();
                }, CYCLE_MS);
            } catch {
                scheduleNext();
            }
        }

        scheduleNext();
        return () => {
            cancelled = true;
            clearTimeout(timer);
            clearTimeout(cycleResetTimer);
        };
    }, [enabled, warTone]);

    // ─── Ambient flicker scheduler ──────────────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        let timer = null;
        let cancelled = false;
        const rng = Math.random;
        const reg = registryRef.current;

        function scheduleNext() {
            if (cancelled) return;
            const delay = randomBetween(FLICKER_MIN_MS, FLICKER_MAX_MS, rng);
            timer = setTimeout(tick, delay);
        }

        function tick() {
            if (cancelled) return;
            if (typeof document !== 'undefined' && document.hidden) {
                scheduleNext();
                return;
            }
            try {
                const picked = reg.pickEligible({
                    rng,
                    pathname: pathnameRef.current ?? '/',
                    requireIdle: true, // per-element idle check
                });
                if (!picked) {
                    scheduleNext();
                    return;
                }
                const { entry } = picked;
                // Pick a non-space char index from entry.text.
                const nonSpaceIndices = [];
                for (let i = 0; i < entry.text.length; i++) {
                    if (entry.text[i] !== ' ') nonSpaceIndices.push(i);
                }
                if (nonSpaceIndices.length === 0) {
                    scheduleNext();
                    return;
                }
                const charIdx =
                    nonSpaceIndices[
                        Math.min(
                            Math.floor(rng() * nonSpaceIndices.length),
                            nonSpaceIndices.length - 1,
                        )
                    ];
                const dur = randomBetween(FLICKER_DUR_MIN_MS, FLICKER_DUR_MAX_MS, rng);
                entry.onFlicker(charIdx, dur);
            } catch (err) {
                // Swallow flicker-scheduling errors and reschedule below.
                // The flicker animation is a cosmetic non-critical path; we
                // never want a transient timing issue to crash the provider.
                console.debug('[MinistryProvider] flicker scheduling failed:', err);
            }
            scheduleNext();
        }

        scheduleNext();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [enabled]);

    // ─── Dev-only debug hook ─────────────────────────────────────────────
    // Gated by NODE_ENV so it is tree-shaken out of production builds.
    // Exposes window.__ministry_test__.forceHijack(predicate) for Playwright.
    useEffect(() => {
        if (process.env.NODE_ENV === 'production') return;
        if (typeof window === 'undefined') return;
        window.__ministry_test__ = {
            /**
             * Triggers onHijack on the first registered descriptor whose
             * text matches the predicate. Returns true on success, false
             * if nothing matched.
             *
             * @param {(text: string) => boolean} textPredicate - Returns true if this element should be hijacked
             * @returns {boolean}
             */
            forceHijack(textPredicate) {
                let fired = false;
                registryRef.current.forEachEligible(
                    { pathname: pathnameRef.current ?? '/' },
                    (id, entry) => {
                        if (fired) return;
                        if (textPredicate(entry.text)) {
                            const alt =
                                entry.altText ??
                                pickAlt(entry.category, warTone, Math.random);
                            if (alt) {
                                registryRef.current.setIdle(id, false);
                                entry.onHijack(alt);
                                setTimeout(
                                    () => registryRef.current.setIdle(id, true),
                                    CYCLE_MS,
                                );
                                fired = true;
                            }
                        }
                    },
                );
                return fired;
            },
        };
        return () => {
            delete window.__ministry_test__;
        };
    }, [warTone]);

    return (
        <MinistryContext.Provider value={ctxValue}>{children}</MinistryContext.Provider>
    );
}
