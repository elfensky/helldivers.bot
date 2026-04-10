import { StatCard } from '@/features/stats/StatGrid';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import {
    findClosestCalls,
    findWorstCascade,
} from '@/shared/utils/game/seasonAnalytics.mjs';

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

const sectionHeading =
    'col-span-2 font-mono text-small text-text-muted uppercase tracking-wide';

export default function ArchiveStats({ events, live, data, onEventSelect }) {
    if (!events?.length) return null;

    // Event-derived stats
    const sorted = [...events].sort((a, b) => a.start_time - b.start_time);
    const seasonSeconds = sorted[sorted.length - 1].end_time - sorted[0].start_time;
    const seasonDays = Math.round(seasonSeconds / 86400);
    const wonCount = events.filter((e) => e.status === 'success').length;
    const winRate =
        events.length > 0 ? Math.round((wonCount / events.length) * 100) : 0;

    // Outcome
    const result = getWarOutcome(data);
    const outcome = result?.outcome ?? 'unknown';
    const outcomeColor =
        outcome === 'victory' ? 'success'
        : outcome === 'defeat' ? 'danger'
        : undefined;

    // Notable moments
    const { narrowestWin, narrowestLoss } = findClosestCalls(events);
    const worstCascade = findWorstCascade(events);
    const hasNotableMoments = narrowestWin || narrowestLoss || worstCascade;

    // h1_live combat stats (only for seasons with live data)
    const hasLive = live?.length > 0;
    let liveCards = null;
    if (hasLive) {
        const kills = sumBigInt(live, 'kills');
        const deaths = sumBigInt(live, 'deaths');
        const missions = sumBigInt(live, 'missions');
        const successfulMissions = sumBigInt(live, 'successful_missions');
        const players = Math.max(...live.map((f) => Number(f.players ?? 0n)));
        const shots = sumBigInt(live, 'shots');
        const hits = sumBigInt(live, 'hits');
        const accidentals = sumBigInt(live, 'accidentals');
        liveCards = (
            <>
                <h3 className={`${sectionHeading} mt-3`}>Combat Record</h3>
                <StatCard label="KILLS" value={formatNumber(kills)} />
                <StatCard label="K/D" value={formatRatio(kills, deaths)} />
                <StatCard label="ACCURACY" value={formatPercent(hits, shots)} />
                <StatCard
                    label="FRIENDLY_FIRE"
                    value={formatPercent(accidentals, kills)}
                    accentColor="danger"
                />
                <StatCard
                    label="MISSION_SUCCESS"
                    value={formatPercent(successfulMissions, missions)}
                />
                <StatCard
                    label="PEAK_ONLINE"
                    value={formatNumber(players)}
                />
            </>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-1">
            <h3 className={sectionHeading}>War Summary</h3>
            <StatCard
                label="OUTCOME"
                value={outcome.toUpperCase()}
                accentColor={outcomeColor}
                valueColor={outcomeColor}
            />
            <StatCard label="DURATION" value={`${seasonDays} days`} />
            <StatCard
                label="WIN_RATE"
                value={`${winRate}%`}
                subtitle={`${wonCount} / ${events.length}`}
                accentColor={winRate > 50 ? 'success' : 'danger'}
            />
            {hasLive && (
                <StatCard
                    label="TOTAL_DIVERS"
                    value={formatNumber(sumBigInt(live, 'total_unique_players'))}
                />
            )}

            {hasNotableMoments && (
                <>
                    <h3 className={`${sectionHeading} mt-3`}>Notable Moments</h3>
                    {narrowestWin && (
                        <StatCard
                            label="NARROWEST_WIN"
                            value={narrowestWin.region}
                            subtitle={`${Math.round(narrowestWin.ratio * 100)}% — ${narrowestWin.faction}`}
                            accentColor="danger"
                            onClick={onEventSelect ? () => onEventSelect(narrowestWin.event) : undefined}
                        />
                    )}
                    {narrowestLoss && (
                        <StatCard
                            label="NARROWEST_LOSS"
                            value={narrowestLoss.region}
                            subtitle={`${Math.round(narrowestLoss.ratio * 100)}% — ${narrowestLoss.faction}`}
                            accentColor="success"
                            onClick={onEventSelect ? () => onEventSelect(narrowestLoss.event) : undefined}
                        />
                    )}
                    {worstCascade && (
                        <StatCard
                            label="WORST_CASCADE"
                            value={`${worstCascade.length} regions`}
                            subtitle={worstCascade.faction}
                            onClick={onEventSelect && worstCascade.firstEvent ? () => onEventSelect(worstCascade.firstEvent) : undefined}
                        />
                    )}
                </>
            )}

            {liveCards}
        </div>
    );
}
