'use client';
import { useEffect } from 'react';
import { readPreferenceCookie } from '@/shared/utils/cookies.mjs';
import { FACTION_KEY, FACTION_DEFAULT } from '@/shared/preferences/faction.mjs';
import {
    REGIONS_VIEW_KEY,
    REGIONS_VIEW_DEFAULT,
} from '@/shared/preferences/regionsView.mjs';
import { SORT_ORDER_KEY, SORT_ORDER_DEFAULT } from '@/shared/preferences/sortOrder.mjs';

const SESSION_FLAG = 'hd1-prefs-snapshotted';

/**
 * Side-effect-only component, mounted in the root layout so it runs on every
 * route, that fires a single `preference-snapshot` Umami event per session
 * capturing the user's current preferences. Complements the existing
 * click-event tracking on each toggle: clicks measure churn, snapshots measure
 * state distribution (including users who never touch a toggle).
 *
 * Guarded by sessionStorage so SPA navigation doesn't double-count.
 * Fires fire-and-forget via `window.umami?.track` — if Umami hasn't
 * loaded yet (unusual, but possible on first-ever mount), the event
 * silently drops. Production-only in practice since Umami only loads
 * when UMAMI_SITE_ID is set.
 */
export default function PreferenceTracker() {
    useEffect(() => {
        try {
            if (sessionStorage.getItem(SESSION_FLAG)) return;
            sessionStorage.setItem(SESSION_FLAG, '1');
        } catch {
            // sessionStorage unavailable — fall through and fire anyway
        }

        window.umami?.track('preference-snapshot', {
            faction: readPreferenceCookie(FACTION_KEY) ?? FACTION_DEFAULT,
            regions_view: readPreferenceCookie(REGIONS_VIEW_KEY) ?? REGIONS_VIEW_DEFAULT,
            sort_order: readPreferenceCookie(SORT_ORDER_KEY) ?? SORT_ORDER_DEFAULT,
        });
    }, []);
    return null;
}
