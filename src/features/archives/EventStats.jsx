import { StatCard } from '@/features/stats/StatGrid';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import map from '@/shared/enums/map.mjs';

export default function EventStats({ events, data }) {
    if (!events?.length) return null;

    const durations = events.map((e) => e.end_time - e.start_time);
    const longest = Math.max(...durations);
    const shortest = Math.min(...durations);

    const regionCounts = {};
    for (const e of events) {
        const regionName = map[e.enemy]?.[e.region]?.region ?? 'Unknown';
        regionCounts[regionName] = (regionCounts[regionName] ?? 0) + 1;
    }
    const mostContested = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    const sorted = [...events].sort((a, b) => a.start_time - b.start_time);
    const seasonSeconds = sorted[sorted.length - 1].end_time - sorted[0].start_time;
    const seasonDays = Math.round(seasonSeconds / 86400);

    const wonCount = events.filter((e) => e.status === 'success').length;

    const result = getWarOutcome(data);
    const outcome = result?.outcome ?? 'unknown';
    const outcomeColor =
        outcome === 'victory' ? 'success'
        : outcome === 'defeat' ? 'danger'
        : undefined;

    return (
        <div className="grid grid-cols-2 gap-1">
            <StatCard
                label="OUTCOME"
                value={outcome.toUpperCase()}
                accentColor={outcomeColor}
                valueColor={outcomeColor}
            />
            <StatCard label="SEASON_DURATION" value={`${seasonDays} days`} />
            <StatCard
                label="EVENTS_WON"
                value={`${wonCount}/${events.length}`}
                accentColor={wonCount > events.length / 2 ? 'success' : 'danger'}
            />
            <StatCard label="LONGEST_EVENT" value={formatCompactDuration(longest)} />
            <StatCard label="SHORTEST_EVENT" value={formatCompactDuration(shortest)} />
            <StatCard label="MOST_CONTESTED" value={mostContested} />
        </div>
    );
}
