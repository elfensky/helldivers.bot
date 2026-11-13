'use client';
import { useEffect } from 'react';
import { readPreferenceCookie } from '@/shared/utils/cookies.mjs';
import { FACTION_KEY, FACTION_DEFAULT } from '@/shared/preferences/faction.mjs';
import {
    REGIONS_VIEW_KEY,
    REGIONS_VIEW_DEFAULT,
} from '@/shared/preferences/regionsView.mjs';
import { SORT_ORDER_KEY, SORT_ORDER_DEFAULT } from '@/shared/preferences/sortOrder.mjs';
import { replayAllowed } from '@/features/consent/replayConsent.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';

const SESSION_FLAG = 'hd1-prefs-snapshotted';

/**
 * Side-effect-only component, mounted in the root layout so it runs on every
 * route, that fires a single `preference-snapshot` Umami event per session
 * capturing the user's current preferences. Complements the existing
 * click-event tracking on each toggle: clicks measure churn, snapshots measure
 * state distribution (including users who never touch a toggle).
 *
 * It reads the preference cookies and writes sessionStorage for an analytics
 * purpose, so it runs only after the same yes as session replay (#617), under
 * the same gate. Guarded by sessionStorage so SPA navigation doesn't
 * double-count; blocked storage sends nothing. Fires fire-and-forget via
 * `window.umami?.track` — if Umami hasn't loaded yet, the event silently drops.
 *
 * @param {object} props - Component props.
 * @param {boolean} [props.identified] - The account link is on for this page load.
 * @returns {null}
 */
export default function PreferenceTracker({ identified = false }) {
    useEffect(() => {
        const snapshot = async () => {
            if (!(await replayAllowed(identified))) return;

            const { data: first, error } = await tryCatch(
                Promise.resolve().then(() => {
                    if (sessionStorage.getItem(SESSION_FLAG)) return false;
                    sessionStorage.setItem(SESSION_FLAG, '1');
                    return true;
                }),
            );
            if (error || !first) return;

            window.umami?.track('preference-snapshot', {
                faction: readPreferenceCookie(FACTION_KEY) ?? FACTION_DEFAULT,
                regions_view:
                    readPreferenceCookie(REGIONS_VIEW_KEY) ?? REGIONS_VIEW_DEFAULT,
                sort_order: readPreferenceCookie(SORT_ORDER_KEY) ?? SORT_ORDER_DEFAULT,
            });
        };
        snapshot();
    }, [identified]);
    return null;
}
