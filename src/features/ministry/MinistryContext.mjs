'use client';
import { createContext, useContext } from 'react';

/**
 * Context published by MinistryProvider. Value shape:
 *
 *   {
 *     register(id, descriptor): void,
 *     unregister(id): void,
 *     setIdle(id, isIdle): void,
 *     forceHijack(predicate?: (text: string) => boolean): boolean,
 *     warTone: 'winning' | 'losing' | null,
 *     enabled: boolean,  // false when warTone is null OR prefers-reduced-motion
 *   }
 *
 * `forceHijack` imperatively triggers a hijack on the first eligible descriptor
 * (filtered by `predicate` if provided; default matches any). Returns true on
 * success, false if nothing matched or warTone has no propaganda available.
 * Used by the admin debug panel to reproduce the effect on demand.
 *
 * All callbacks are referentially stable (created once in the provider;
 * forceHijack is memoized against warTone). The context value object is stable
 * against registry mutations (the registry lives in a useRef, so Map mutations
 * never invalidate the context value). It re-creates only when warTone, enabled,
 * or forceHijack change.
 */
export const MinistryContext = createContext(null);

/**
 * Hook to read the Ministry context. Returns null when used outside a
 * provider — Hijackable uses that to no-op gracefully so consumers can
 * be rendered in tests without wiring up the full provider.
 */
export function useMinistryContext() {
    return useContext(MinistryContext);
}
