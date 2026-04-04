'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SeasonSelector({ seasons, currentSeason }) {
    const router = useRouter();

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
                onChange={(e) => router.push(`/archives?season=${e.target.value}`)}
                className="rounded bg-white/10 px-3 py-2 text-sm text-white accent-primary hover:bg-white/20"
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
