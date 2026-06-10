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

    // Imperatively trigger one hijack on the first eligible descriptor whose text
    // matches `predicate` (default: any eligible). Used by the admin debug panel
    // so a hijack can be reproduced on demand without waiting on the random scheduler.
    // Respects scope/pathname; ignores the document-hidden gate and the reduced-motion
    // `enabled` flag (the caller asked for it explicitly). Returns true on success,
    // false if no eligible descriptor matched or no propaganda string is available
    // for the current warTone.
    const forceHijack = useCallback(
        (predicate = () => true) => {
            const reg = registryRef.current;
            if (!reg) return false;
            let fired = false;
            reg.forEachEligible({ pathname: pathnameRef.current ?? '/' }, (id, entry) => {
                if (fired) return;
                if (!predicate(entry.text)) return;
                const alt =
                    entry.altText ?? pickAlt(entry.category, warTone, Math.random);
                if (!alt) return;
                reg.setIdle(id, false);
                entry.onHijack(alt);
                setTimeout(() => reg.setIdle(id, true), CYCLE_MS);
                fired = true;
            });
            return fired;
        },
        [warTone],
    );

    // Context value re-creates only when warTone, enabled, or forceHijack change
    // (forceHijack is itself memoized against warTone). Registry mutations via the
    // Map never invalidate this object — that's the stability guarantee.
    const ctxValue = useMemo(
        () => ({ register, unregister, setIdle, forceHijack, warTone, enabled }),
        [register, unregister, setIdle, forceHijack, warTone, enabled],
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

    return (
        <MinistryContext.Provider value={ctxValue}>{children}</MinistryContext.Provider>
    );
}
