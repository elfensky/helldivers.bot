import { getCrossSeasonStats } from '@/db/queries/getCrossSeasonStats.mjs';
import FactionThreatRanking from '@/features/stats/FactionThreatRanking';
import WarOutcomes from '@/features/stats/WarOutcomes';
import SeasonRecords from '@/features/stats/SeasonRecords';

// DB-backed — the cross-season aggregate runs on each request (cached via
// React's `cache()` inside getCrossSeasonStats); skip the build-time
// pre-render that would otherwise try to hit Postgres.
export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Across the Wars',
    description:
        'Cross-season analytics across every Helldivers war: faction threat ranking, war outcomes and streaks, and all-time records.',
};

/**
 * `/stats` — the cross-season analytics page.
 *
 * One DB query (`getCrossSeasonStats`) supplies every section so the page
 * stays a thin server-side composition: faction threat ranking on top
 * (Recharts bar), war outcomes + streaks + a per-season timeline in the
 * middle, all-time records grid at the bottom. Telemetry-derived components
 * are deferred — see issue #394.
 */
export default async function StatsPage() {
    const data = await getCrossSeasonStats();
    const seasonsCount = data.perSeason.length;

    return (
        <main className="gutters flex w-full flex-col gap-6 py-6">
            <header className="flex flex-col gap-2">
                <h1>Across the Wars</h1>
                <p className="text-text-muted">
                    What humanity has learned from every war we have ever fought —
                    aggregated across {seasonsCount}{' '}
                    {seasonsCount === 1 ? 'season' : 'seasons'} of campaign history.
                </p>
            </header>

            <section className="flex flex-col gap-2">
                <h2>Faction Threat Ranking</h2>
                <p className="text-small text-text-muted">
                    Helldivers&apos; overall win rate against each enemy across every war.
                    A shorter bar means a more threatening foe.
                </p>
                <FactionThreatRanking factionTotals={data.factionTotals} />
            </section>

            <section className="flex flex-col gap-2">
                <h2>War Outcomes &amp; Streaks</h2>
                <WarOutcomes perSeason={data.perSeason} />
            </section>

            <section className="flex flex-col gap-2">
                <h2>All-Time Records</h2>
                <SeasonRecords perSeason={data.perSeason} />
            </section>
        </main>
    );
}
