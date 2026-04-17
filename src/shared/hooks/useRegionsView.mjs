'use client';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';

/**
 * Homepage Regions section view-mode preference. `'sector'` = single-bar
 * active-sector zoom; `'campaign'` = 11-segment full-war bar. Persisted
 * to localStorage so the user's last choice sticks across sessions.
 */
export function useRegionsView() {
    return usePersistedState(
        'hd1-regions-view',
        'sector',
        (v) => v === 'sector' || v === 'campaign',
    );
}
