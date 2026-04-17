'use client';
import { useEffect, useState } from 'react';
import { formatTimeAgo } from '@/shared/utils/format/formatTimeAgo.mjs';

/**
 * Live "Updated Xs ago" counter. Ticks every second; resets naturally when
 * `lastUpdated` changes (e.g. the next poll arrives).
 */
export default function LastUpdated({ lastUpdated }) {
    // `now` must be state so the React Compiler can't elide re-renders:
    // formatTimeAgo(lastUpdated) would otherwise appear constant when only
    // `lastUpdated` is in scope, cloaking the hidden Date.now() dependency.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1_000);
        return () => clearInterval(id);
    }, []);
    if (!lastUpdated) return null;
    return (
        <span
            className="font-mono text-small text-[var(--color-text-muted)]"
            suppressHydrationWarning
        >
            {formatTimeAgo(lastUpdated, new Date(now))}
        </span>
    );
}
