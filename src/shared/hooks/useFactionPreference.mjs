'use client';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';

const VALID_FACTIONS = new Set(['global', 'bugs', 'cyborgs', 'illuminate']);

/**
 * Shared faction filter preference across the app (dashboard + archives).
 * Persists to localStorage so switching to "bugs" on one page carries to
 * the other.
 */
export function useFactionPreference() {
    return usePersistedState('hd1-faction', 'global', (v) => VALID_FACTIONS.has(v));
}
