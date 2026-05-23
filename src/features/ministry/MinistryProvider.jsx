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

    return (
        <MinistryContext.Provider value={ctxValue}>{children}</MinistryContext.Provider>
    );
}

// Exported for the scheduler in the next task — keeps test mocks predictable.
export const _internals = {
    HIJACK_MIN_MS,
    HIJACK_MAX_MS,
    FLICKER_MIN_MS,
    FLICKER_MAX_MS,
    FLICKER_DUR_MIN_MS,
    FLICKER_DUR_MAX_MS,
    randomBetween,
    pickAlt,
    CYCLE_MS,
};
