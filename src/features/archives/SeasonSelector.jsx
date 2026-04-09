'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTrack } from '@/shared/hooks/useTrack.mjs';

export default function SeasonSelector({ seasons, currentSeason }) {
    const router = useRouter();
    const track = useTrack();

    // Sync URL with resolved season so the link is shareable.
    // Defers via requestIdleCallback (with setTimeout fallback) to avoid
    // interfering with RSC flight stream processing.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('season') && currentSeason) {
            const schedule =
                typeof requestIdleCallback === 'function' ? requestIdleCallback : (
                    setTimeout
                );
            const cancel =
                typeof cancelIdleCallback === 'function' ? cancelIdleCallback : (
                    clearTimeout
                );
            const id = schedule(() => {
                window.history.replaceState(
                    null,
                    '',
                    `/archives?season=${currentSeason}`,
                );
            });
            return () => cancel(id);
        }
    }, [currentSeason]);

    if (!seasons || seasons.length === 0) return null;

    return (
        <nav>
            <select
                value={currentSeason}
                onChange={(e) => {
                    const season = e.target.value;
                    router.push(`/archives?season=${season}`);
                    track('archive-season-select', { season: Number(season) });
                }}
                className="border border-ghost bg-surface-1 px-3 py-1.5 font-mono text-sm text-text accent-primary hover:bg-surface-2"
            >
                {seasons.map((s) => (
                    <option key={s} value={s}>
                        Season {s}
                    </option>
                ))}
            </select>
        </nav>
    );
}
