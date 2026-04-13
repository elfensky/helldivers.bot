import humanizeDuration from 'humanize-duration';
import { StatCard } from '@/features/stats/StatGrid';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import GlitchText from '@/features/archives/ClientGlitchText';
import factions from '@/shared/enums/factions.mjs';
import { findWorstCascade } from '@/shared/utils/game/seasonAnalytics.mjs';

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

export default function ArchiveStats({ events, live, data, effects, glitchPhase }) {
    if (!events?.length) return null;

    // Event-derived stats
    const sorted = [...events].sort((a, b) => a.start_time - b.start_time);
    // DURATION: snapshot poll span is the archive-era source of truth; event span is the fallback.
    const snapshots = data?.snapshots;
    const seasonSeconds =
        snapshots && snapshots.length >= 2 ?
            snapshots[snapshots.length - 1].time - snapshots[0].time
        :   sorted[sorted.length - 1].end_time - sorted[0].start_time;
    const seasonDays = Math.round(seasonSeconds / 86400);
    const seasonHumanDuration = humanizeDuration(seasonSeconds * 1000, {
        largest: 2,
        round: true,
    });

    // Defense / attack rates — split out from the old global WIN_RATE so the
    // two activities can be read independently.
    const defends = events.filter((e) => e.type === 'defend');
    const attacks = events.filter((e) => e.type === 'attack');
    const successfulDefends = defends.filter((e) => e.status === 'success').length;
    const successfulAttacks = attacks.filter((e) => e.status === 'success').length;
    const defenseRate =
        defends.length > 0 ?
            Math.round((successfulDefends / defends.length) * 100)
        :   null;
    const attackRate =
        attacks.length > 0 ?
            Math.round((successfulAttacks / attacks.length) * 100)
        :   null;

    // Outcome
    const result = getWarOutcome(data);
    const outcome = result?.outcome ?? 'unknown';
    const outcomeColor =
        outcome === 'victory' ? 'success'
        : outcome === 'defeat' ? 'danger'
        : undefined;
    const outcomeFaction =
        result?.faction != null ? factions[result.faction]?.name : null;

    // Notable moments
    const worstCascade = findWorstCascade(events);

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
                <StatCard label="PEAK_ONLINE" value={formatNumber(players)} />
            </>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-1 lg:grid-cols-3">
            <StatCard
                label="OUTCOME"
                value={
                    outcome === 'defeat' ?
                        <GlitchText
                            text="DEFEAT"
                            altText="VICTORY"
                            className="text-danger"
                            altClassName="text-success"
                            phase={glitchPhase?.phase ?? 'idle'}
                            takeoverMs={glitchPhase?.takeoverMs ?? 800}
                            restoreMs={glitchPhase?.restoreMs ?? 800}
                        />
                    :   outcome.toUpperCase()
                }
                subtitle={outcomeFaction ?? undefined}
                accentColor={outcomeColor}
                valueColor={outcome !== 'defeat' ? outcomeColor : undefined}
            />
            <StatCard
                label="DURATION"
                value={`${seasonDays} ${seasonDays === 1 ? 'day' : 'days'}`}
                subtitle={seasonHumanDuration}
            />
            <StatCard
                label="DEFENSE_RATE"
                value={defenseRate != null ? `${defenseRate}%` : '—'}
                subtitle={
                    defends.length > 0 ?
                        `${successfulDefends} / ${defends.length}`
                    :   undefined
                }
                accentColor={
                    defenseRate != null ?
                        defenseRate > 50 ?
                            'success'
                        :   'danger'
                    :   undefined
                }
            />
            <StatCard
                label="ATTACK_RATE"
                value={attackRate != null ? `${attackRate}%` : '—'}
                subtitle={
                    attacks.length > 0 ?
                        `${successfulAttacks} / ${attacks.length}`
                    :   undefined
                }
                accentColor={
                    attackRate != null ?
                        attackRate > 50 ?
                            'success'
                        :   'danger'
                    :   undefined
                }
            />
            {hasLive && (
                <StatCard
                    label="TOTAL_DIVERS"
                    value={formatNumber(sumBigInt(live, 'total_unique_players'))}
                />
            )}

            {worstCascade && (
                <StatCard
                    label="WORST_CASCADE"
                    value={`${worstCascade.length} regions`}
                    subtitle={worstCascade.faction}
                />
            )}

            {liveCards}
        </div>
    );
}
