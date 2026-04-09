import { StatCard } from '@/features/stats/StatGrid';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import map from '@/shared/enums/map.mjs';

const factionMap = { bugs: 0, cyborgs: 1, illuminate: 2 };

export default function FactionStats({ events, snapshots, pointsMax, faction }) {
    const factionIndex = factionMap[faction];
    if (factionIndex === undefined) return null;

    const factionEvents = (events ?? []).filter((e) => e.enemy === factionIndex);
    if (!factionEvents.length) return null;

    const defends = factionEvents.filter((e) => e.type === 'defend');
    const attacks = factionEvents.filter((e) => e.type === 'attack');
    const successfulDefends = defends.filter((e) => e.status === 'success').length;
    const successfulAttacks = attacks.filter((e) => e.status === 'success').length;

    const defenseRate =
        defends.length > 0
            ? Math.round((successfulDefends / defends.length) * 100)
            : null;
    const attackRate =
        attacks.length > 0
            ? Math.round((successfulAttacks / attacks.length) * 100)
            : null;

    const durations = factionEvents
        .filter((e) => e.end_time && e.start_time)
        .map((e) => e.end_time - e.start_time);
    const avgDuration =
        durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : null;

    const peakSurge = factionEvents.reduce(
        (max, e) => Math.max(max, Number(e.players_at_start ?? 0)),
        0,
    );

    // Most attacked region
    const regionCounts = {};
    for (const e of factionEvents) {
        regionCounts[e.region] = (regionCounts[e.region] ?? 0) + 1;
    }
    const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];
    const mostAttackedName = topRegion
        ? (map[factionIndex]?.[Number(topRegion[0])]?.region ?? '—')
        : '—';

    // Snapshot-derived stats
    let overkill = '—';
    let conquest = '—';

    if (snapshots?.length && pointsMax?.points) {
        const lastSnap = snapshots[snapshots.length - 1];
        const parsed =
            typeof lastSnap.data === 'string'
                ? JSON.parse(lastSnap.data)
                : lastSnap.data;

        if (parsed?.[factionIndex]) {
            const factionData = parsed[factionIndex];
            const maxPoints = pointsMax.points[factionIndex];

            if (maxPoints > 0) {
                if (factionData.points_taken != null) {
                    overkill =
                        ((Number(factionData.points_taken) / maxPoints) * 100).toFixed(
                            0,
                        ) + '%';
                }
                if (factionData.points != null) {
                    conquest =
                        ((Number(factionData.points) / maxPoints) * 100).toFixed(1) +
                        '%';
                }
            }
        }
    }

    return (
        <div className="grid grid-cols-2 gap-1">
            <StatCard
                label="DEFENSE_RATE"
                value={defenseRate != null ? `${defenseRate}%` : '—'}
                accentColor={
                    defenseRate != null
                        ? defenseRate > 50
                            ? 'success'
                            : 'danger'
                        : undefined
                }
            />
            <StatCard
                label="ATTACK_RATE"
                value={attackRate != null ? `${attackRate}%` : '—'}
                accentColor={
                    attackRate != null
                        ? attackRate > 50
                            ? 'success'
                            : 'danger'
                        : undefined
                }
            />
            <StatCard label="TOTAL_EVENTS" value={factionEvents.length} />
            <StatCard
                label="AVG_DURATION"
                value={avgDuration != null ? formatCompactDuration(avgDuration) : '—'}
            />
            <StatCard
                label="PEAK_SURGE"
                value={peakSurge > 0 ? formatNumber(peakSurge) : '—'}
            />
            <StatCard label="MOST_ATTACKED" value={mostAttackedName} />
            <StatCard label="OVERKILL" value={overkill} />
            <StatCard label="CONQUEST" value={conquest} />
        </div>
    );
}
