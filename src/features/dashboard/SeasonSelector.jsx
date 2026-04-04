'use client';
import { useRouter } from 'next/navigation';

export default function SeasonSelector({ seasons, currentSeason }) {
    const router = useRouter();

    if (!seasons || seasons.length === 0) return null;

    return (
        <nav>
            <select
                value={currentSeason}
                onChange={(e) => router.push(`/archives?season=${e.target.value}`)}
                className="rounded bg-white/10 px-3 py-2 text-sm text-white accent-[var(--orange)] hover:bg-white/20"
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
