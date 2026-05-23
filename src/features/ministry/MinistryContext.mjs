'use client';
import { createContext, useContext } from 'react';

/**
 * Context published by MinistryProvider. Value shape:
 *
 *   {
 *     register(id, descriptor): void,
 *     unregister(id): void,
 *     setIdle(id, isIdle): void,
 *     warTone: 'winning' | 'losing' | null,
 *     enabled: boolean,  // false when warTone is null OR prefers-reduced-motion
 *   }
 *
 * All callbacks are referentially stable (created once in the
 * provider). The context value object is stable against registry mutations (the registry lives
 * in a useRef, so Map mutations never invalidate the context value). It re-creates
 * only when warTone or enabled change.
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
