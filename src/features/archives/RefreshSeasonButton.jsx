'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reseedSeason } from '@/features/archives/reseedSeason';
import { useTrack } from '@/shared/hooks/useTrack.mjs';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Admin-only control that force-refreshes the currently-viewed archive
 * season from the official HD1 API. Hidden for non-admins (the parent
 * only renders this component when `isAdmin === true`).
 *
 * Disabled for 24 hours after the last successful refresh, with the
 * remaining time shown as the button label (e.g. "Next refresh in 21h").
 * The cooldown check runs in a `useEffect` so SSR always emits the
 * static "Refresh" label — the remaining-time label appears only after
 * client mount, keeping SSR + hydration identical.
 */
export default function RefreshSeasonButton({ season, lastUpdated }) {
    const router = useRouter();
    const track = useTrack();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState(null);
    const [remainingMs, setRemainingMs] = useState(0);

    useEffect(() => {
        if (!lastUpdated) {
            setRemainingMs(0);
            return;
        }
        const elapsed = Date.now() - new Date(lastUpdated).getTime();
        setRemainingMs(elapsed >= 0 ? Math.max(0, COOLDOWN_MS - elapsed) : 0);
    }, [lastUpdated]);

    const cooldownActive = remainingMs > 0;
    const disabled = pending || cooldownActive;

    const label =
        pending ? 'Refreshing…'
        : cooldownActive ?
            `Next refresh in ${formatCompactDuration(Math.ceil(remainingMs / 1000))}`
        :   'Refresh';

    const title =
        error ??
        (cooldownActive ?
            'Already refreshed within the last 24 hours — try again later'
        :   'Re-fetch this season from the official API');

    function handleClick() {
        setError(null);
        startTransition(async () => {
            track('archive-season-refresh', { season });
            const result = await reseedSeason(season);
            if (result?.error) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            title={title}
            className="border border-ghost bg-surface-1 px-3 py-1.5 font-mono text-sm text-text hover:bg-surface-2 disabled:opacity-60"
            data-umami-event="archive-season-refresh-click"
        >
            {label}
        </button>
    );
}
