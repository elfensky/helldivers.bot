'use client';
import { usePreferenceSnapshot } from '@/shared/hooks/usePreferenceSnapshot.mjs';

/**
 * Side-effect-only component that fires a one-per-session Umami event
 * with the current preference cookie values. Mounted in the root layout
 * so it runs on every route.
 */
export default function PreferenceTracker() {
    usePreferenceSnapshot();
    return null;
}
