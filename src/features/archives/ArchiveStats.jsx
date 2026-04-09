import { StatCard } from '@/features/stats/StatGrid';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import map from '@/shared/enums/map.mjs';

function sumBigInt(live, field) {
    return live.reduce((acc, f) => acc + (f[field] ?? 0n), 0n);
}

function formatPercent(numerator, denominator) {
    if (denominator === 0n) return '—';
    return ((Number(numerator) / Number(denominator)) * 100).toFixed(1) + '%';
}

function formatRatio(numerator, denominator) {
    if (denominator === 0n) return '—';
    return (Number(numerator) / Number(denominator)).toFixed(1);
}

export default function ArchiveStats({ events, snapshots, pointsMax, live, data }) {
    if (!events?.length) return null;

    // Event-derived stats
    const sorted = [...events].sort((a, b) => a.start_time - b.start_time);
    const seasonSeconds = sorted[sorted.length - 1].end_time - sorted[0].start_time;
    const seasonDays = Math.round(seasonSeconds / 86400);
    const wonCount = events.filter((e) => e.status === 'success').length;
    const defends = events.filter((e) => e.type === 'defend');
    const attacks = events.filter((e) => e.type === 'attack');
    const defendWon = defends.filter((e) => e.status === 'success').length;
    const attackWon = attacks.filter((e) => e.status === 'success').length;
    const durations = events.map((e) => e.end_time - e.start_time);
    const longest = Math.max(...durations);
    const shortest = Math.min(...durations);
    const peakSurge = Math.max(...events.map((e) => e.players_at_start || 0));

    // Most contested region
    const regionCounts = {};
    for (const e of events) {
        const regionName = map[e.enemy]?.[e.region]?.region ?? 'Unknown';
        regionCounts[regionName] = (regionCounts[regionName] ?? 0) + 1;
    }
    const mostContested =
        Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    // Snapshot-derived overkill
    const lastSnap = snapshots?.[snapshots.length - 1];
    const parsedSnap =
        lastSnap ?
            typeof lastSnap.data === 'string' ? JSON.parse(lastSnap.data)
            :   lastSnap.data
        :   null;
    const totalPointsTaken = parsedSnap ?
        parsedSnap.reduce((s, f) => s + (f.points_taken || 0), 0)
    :   0;
    const totalPointsMax = pointsMax?.points?.reduce((s, p) => s + p, 0) ?? 1;
    const overkillPct =
        totalPointsMax > 0 ?
            ((totalPointsTaken / totalPointsMax) * 100).toFixed(1)
        :   '—';

    // Outcome
    const result = getWarOutcome(data);
    const outcome = result?.outcome ?? 'unknown';
    const outcomeColor =
        outcome === 'victory' ? 'success'
        : outcome === 'defeat' ? 'danger'
        : undefined;

    // h1_live combat stats (only for seasons with live data)
    const hasLive = live?.length > 0;
    let liveCards = null;
    if (hasLive) {
        const kills = sumBigInt(live, 'kills');
        const deaths = sumBigInt(live, 'deaths');
        const missions = sumBigInt(live, 'missions');
        const players = Math.max(...live.map((f) => Number(f.players ?? 0n)));
        const shots = sumBigInt(live, 'shots');
        const hits = sumBigInt(live, 'hits');
        const accidentals = sumBigInt(live, 'accidentals');
        const totalUniquePlayers = sumBigInt(live, 'total_unique_players');

        liveCards = (
            <>
                <StatCard label="KILLS" value={formatNumber(kills)} />
                <StatCard label="MISSIONS" value={formatNumber(missions)} />
                <StatCard label="PEAK_PLAYERS" value={formatNumber(players)} />
                <StatCard label="K/D_RATIO" value={formatRatio(kills, deaths)} />
                <StatCard label="ACCURACY" value={formatPercent(hits, shots)} />
                <StatCard
                    label="FRIENDLY_FIRE"
                    value={formatPercent(accidentals, kills)}
                    accentColor="danger"
                />
                <StatCard
                    label="UNIQUE_PLAYERS"
                    value={formatNumber(totalUniquePlayers)}
                />
            </>
        );
    }

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
            <StatCard
                label="DEFENSE_WON"
                value={`${defendWon}/${defends.length}`}
            />
            <StatCard
                label="ATTACK_WON"
                value={`${attackWon}/${attacks.length}`}
            />
            <StatCard label="TOTAL_OVERKILL" value={`${overkillPct}%`} />
            <StatCard label="LONGEST_EVENT" value={formatCompactDuration(longest)} />
            <StatCard label="SHORTEST_EVENT" value={formatCompactDuration(shortest)} />
            <StatCard label="MOST_CONTESTED" value={mostContested} />
            <StatCard label="PEAK_SURGE" value={formatNumber(peakSurge)} />
            {liveCards}
        </div>
    );
}
