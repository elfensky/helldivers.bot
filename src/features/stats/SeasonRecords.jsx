import { StatCard } from '@/features/stats/StatGrid';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

/**
 * Find the row that owns the maximum of `getValue(row)` across `perSeason`.
 * Returns `{ value, season }` or null when no row has a finite value.
 */
function findMax(perSeason, getValue) {
    let best = null;
    for (const row of perSeason) {
        const v = getValue(row);
        if (v == null || !Number.isFinite(v)) continue;
        if (best == null || v > best.value) best = { value: v, season: row.season };
    }
    return best;
}

/**
 * All-time superlatives across the war history — five extrema rendered as
 * StatCards with the winning season as the subtitle. Event/campaign-derived
 * so every season counts (telemetry-based records are deferred until the
 * dataset is meaningful — see issue #394).
 */
export default function SeasonRecords({ perSeason }) {
    if (!perSeason?.length) return null;

    const longestWar = findMax(perSeason, (r) => r.season_duration);
    const mostEvents = findMax(perSeason, (r) => r.events);
    const longestAvgBattle = findMax(perSeason, (r) => r.avg_event_duration);
    const mostDefendsWon = findMax(perSeason, (r) => r.defend_wins);
    const mostAttacksWon = findMax(perSeason, (r) => r.attack_wins);

    return (
        <div className="grid grid-cols-2 gap-1 lg:grid-cols-3">
            {longestWar && (
                <StatCard
                    label="LONGEST_WAR"
                    value={formatCompactDuration(longestWar.value)}
                    subtitle={`Season ${longestWar.season}`}
                />
            )}
            {mostEvents && (
                <StatCard
                    label="MOST_EVENTS"
                    value={mostEvents.value}
                    subtitle={`Season ${mostEvents.season}`}
                />
            )}
            {longestAvgBattle && (
                <StatCard
                    label="LONGEST_AVG_BATTLE"
                    value={formatCompactDuration(Math.round(longestAvgBattle.value))}
                    subtitle={`Season ${longestAvgBattle.season}`}
                />
            )}
            {mostDefendsWon && (
                <StatCard
                    label="MOST_DEFENDS_WON"
                    value={mostDefendsWon.value}
                    subtitle={`Season ${mostDefendsWon.season}`}
                />
            )}
            {mostAttacksWon && (
                <StatCard
                    label="MOST_ATTACKS_WON"
                    value={mostAttacksWon.value}
                    subtitle={`Season ${mostAttacksWon.season}`}
                />
            )}
        </div>
    );
}
