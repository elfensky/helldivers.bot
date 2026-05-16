import { formatDuration } from '@/shared/utils/format/formatCompactDuration.mjs';
import { StatCard } from '@/features/stats/StatGrid';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import GlitchText from '@/features/archives/GlitchText';
import factions from '@/shared/enums/factions.mjs';
import { findWorstCascade } from '@/shared/utils/game/seasonAnalytics.mjs';
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';

// Only 5 fields in h1_statistic are BigInt in the Prisma schema: kills, deaths,
// shots, hits, accidentals. The other stat columns (missions, successful_missions,
// players, total_unique_players, ...) are Int and come back as plain JS Number.
// BigInt() coerces either losslessly. DO NOT use sumBigInt for global-per-season
// fields (total_unique_players, season_duration) — those are repeated verbatim
// across the 3 faction rows and summing them overcounts 3x; read live[0]?.field.
function sumBigInt(live, field) {
    return live.reduce((acc, f) => acc + BigInt(f[field] ?? 0), 0n);
}

function formatPercent(numerator, denominator) {
    if (!denominator) return '—';
    return ((Number(numerator) / Number(denominator)) * 100).toFixed(1) + '%';
}

function formatRatio(numerator, denominator) {
    if (!denominator) return '—';
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
    const seasonHumanDuration = formatDuration(seasonSeconds);

    // Defense / attack rates — split out from the old global WIN_RATE so the
    // two activities can be read independently.
    const defends = events.filter((e) => e.type === EVENT_TYPE.DEFEND);
    const attacks = events.filter((e) => e.type === EVENT_TYPE.ATTACK);
    const successfulDefends = defends.filter(
        (e) => e.status === EVENT_STATUS.SUCCESS,
    ).length;
    const successfulAttacks = attacks.filter(
        (e) => e.status === EVENT_STATUS.SUCCESS,
    ).length;
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

    // h1_statistic combat stats (only for seasons with live data)
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
                    value={formatNumber(Number(live[0]?.total_unique_players ?? 0))}
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
