import { getCrossSeasonStats } from '@/db/queries/getCrossSeasonStats.mjs';
import FactionThreatRanking from '@/features/stats/FactionThreatRanking';
import WarOutcomes from '@/features/stats/WarOutcomes';
import SeasonRecords from '@/features/stats/SeasonRecords';
import RatioTrendChart from '@/features/stats/RatioTrendChartLoader';
import { computeTelemetryStats } from '@/features/stats/computeTelemetryStats.mjs';
import { StatCard } from '@/features/stats/StatGrid';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import Hijackable from '@/features/ministry/Hijackable';
import CascadeLog from '@/features/timeline/CascadeLog';
import { getCascadeLeaderboard } from '@/db/queries/getCascadeLeaderboard.mjs';
import { generateCascadeLede } from '@/features/stats/generateCascadeLede.mjs';
import { cookies } from 'next/headers';
import {
    CASCADE_SORT_ORDER_KEY,
    validateCascadeSortOrder,
} from '@/shared/preferences/sortOrder.mjs';

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
 * (Recharts bar), war outcomes + streaks in the middle, the all-time
 * records grid, then the cascade-failures log at the bottom.
 * Telemetry-derived components are deferred — see issue #394.
 */
export default async function StatsPage() {
    const data = await getCrossSeasonStats();
    const seasonsCount = data.perSeason.length;
    const telemetry = computeTelemetryStats(data.perSeason);
    const cascades = await getCascadeLeaderboard();
    const lede = generateCascadeLede(cascades, data.perSeason.length);
    const c = await cookies();
    const initialCascadeSort = validateCascadeSortOrder(
        c.get(CASCADE_SORT_ORDER_KEY)?.value,
    );

    return (
        <main className="gutters flex w-full flex-col gap-6 py-6">
            <header className="flex flex-col gap-2">
                <Hijackable as="h1" category="heading" text="Across the Wars" />
                <p className="text-text-muted">
                    What humanity has learned from every war we have ever fought —
                    aggregated across {seasonsCount}{' '}
                    {seasonsCount === 1 ? 'season' : 'seasons'} of campaign history.
                </p>
            </header>

            <section className="flex flex-col gap-2">
                <Hijackable as="h2" category="heading" text="Faction Threat Ranking" />
                <p className="text-small text-text-muted">
                    Helldivers&apos; overall win rate against each enemy across every war.
                    A shorter bar means a more threatening foe.
                </p>
                <FactionThreatRanking factionTotals={data.factionTotals} />
            </section>

            <section className="flex flex-col gap-2">
                <Hijackable as="h2" category="heading" text="War Outcomes & Streaks" />
                <WarOutcomes perSeason={data.perSeason} />
            </section>

            <section className="flex flex-col gap-2">
                <Hijackable as="h2" category="heading" text="All-Time Records" />
                <SeasonRecords perSeason={data.perSeason} />
            </section>

            {telemetry.seasonsWithTelemetry > 0 && (
                <section className="flex flex-col gap-2">
                    <Hijackable as="h2" category="heading" text="Combat Telemetry" />
                    <p className="text-small text-text-muted">
                        Live combat stats from the {telemetry.seasonsWithTelemetry}{' '}
                        {telemetry.seasonsWithTelemetry === 1 ? 'season' : 'seasons'} the
                        bot has polled directly — earlier wars predate telemetry
                        collection, so the trend grows as new wars are recorded.
                    </p>
                    <div className="grid gap-6 md:grid-cols-2">
                        {telemetry.friendlyFire.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <h3 className="text-small text-text-muted">
                                    Friendly Fire Index — accidentals per kill
                                </h3>
                                <RatioTrendChart
                                    data={telemetry.friendlyFire}
                                    label="Friendly fire"
                                    color="#8b2d2d"
                                    decimals={2}
                                />
                            </div>
                        )}
                        {telemetry.accuracy.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <h3 className="text-small text-text-muted">
                                    Accuracy Trend — hits per shot
                                </h3>
                                <RatioTrendChart
                                    data={telemetry.accuracy}
                                    label="Accuracy"
                                    color="#7ec8e3"
                                    decimals={1}
                                />
                            </div>
                        )}
                    </div>
                    {telemetry.shotsPerPlanet != null && (
                        <div className="stat-grid">
                            <StatCard
                                label="Shots per Planet"
                                value={formatNumber(Math.round(telemetry.shotsPerPlanet))}
                                subtitle="rounds fired per planet liberated"
                            />
                        </div>
                    )}
                </section>
            )}

            <CascadeLog
                cascades={cascades}
                lede={lede ?? undefined}
                initialSortOrder={initialCascadeSort}
            />
        </main>
    );
}
