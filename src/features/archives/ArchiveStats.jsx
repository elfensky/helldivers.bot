import { StatCard } from '@/features/stats/StatGrid';
import '@/features/stats/StatGrid.css';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';
import { formatRatio } from '@/shared/utils/format/formatRatio.mjs';
import { getWarOutcome } from '@/shared/utils/game/getWarOutcome.mjs';
import Hijackable from '@/features/ministry/Hijackable';
import factions, { FACTION_INDEX } from '@/shared/enums/factions.mjs';
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import map from '@/shared/enums/map.mjs';
import { selectClosestCalls } from '@/features/archives/selectClosestCalls.mjs';

/**
 * A DEFENSE_RATE / ATTACK_RATE card for one event type — the success rate
 * with a "won / total" subtitle, tinted by whether the rate cleared 50%.
 */
function rateCard(label, typeEvents) {
    const won = typeEvents.filter((e) => e.status === EVENT_STATUS.SUCCESS).length;
    const total = typeEvents.length;
    const rate = total > 0 ? Math.round((won / total) * 100) : null;
    return (
        <StatCard
            label={label}
            value={rate != null ? `${rate}%` : '—'}
            subtitle={total > 0 ? `${won} / ${total}` : undefined}
            accentColor={
                rate != null ?
                    rate > 50 ?
                        'success'
                    :   'danger'
                :   undefined
            }
        />
    );
}

/** The DEFENSE_RATE + ATTACK_RATE pair derived from a set of events. */
function rateCards(events) {
    return (
        <>
            {rateCard(
                'DEFENSE_RATE',
                events.filter((e) => e.type === EVENT_TYPE.DEFEND),
            )}
            {rateCard(
                'ATTACK_RATE',
                events.filter((e) => e.type === EVENT_TYPE.ATTACK),
            )}
        </>
    );
}

/**
 * AVG_DIFFICULTY card — mean difficulty of successful missions on a 1-15
 * scale. Telemetry-derived, so it renders nothing for seasons that predate
 * stat collection (no successful missions on record).
 */
function difficultyCard(totalDifficulty, successfulMissions) {
    if (!(Number(successfulMissions) > 0)) return null;
    return (
        <StatCard
            label="AVG_DIFFICULTY"
            value={formatRatio(totalDifficulty, successfulMissions)}
            subtitle="of 15"
        />
    );
}

/**
 * Archives-only statistics that complement the shared `<StatGrid>`: the war
 * outcome, defend/attack rates and mission difficulty on the global tab, plus
 * a faction's hotspot, conquest and average battle length on a faction tab.
 * Handles both views in one component, mirroring how `StatGrid` branches on
 * `faction`.
 */
export default function ArchiveStats({ faction, events, data, live }) {
    if (!events?.length) return null;

    if (faction === 'global') {
        const result = getWarOutcome(data);
        const outcome = result?.outcome ?? 'unknown';
        const outcomeColor =
            outcome === 'victory' ? 'success'
            : outcome === 'defeat' ? 'danger'
            : undefined;
        const outcomeFaction =
            result?.faction != null ? factions[result.faction]?.name : null;
        // Per-faction stats are disjoint, so summing the three rows gives the
        // war-wide totals for the average-difficulty ratio.
        const diff = (live ?? []).reduce(
            (acc, s) => ({
                difficulty: acc.difficulty + Number(s.total_mission_difficulty || 0),
                successful: acc.successful + Number(s.successful_missions || 0),
            }),
            { difficulty: 0, successful: 0 },
        );

        // The defends that came within a hair of holding — narrowest losses
        // first. Hidden entirely when the war had no genuine nail-biters.
        const closestCalls = selectClosestCalls(events);

        return (
            <>
                <div className="stat-grid">
                    <StatCard
                        label="OUTCOME"
                        value={
                            outcome === 'victory' || outcome === 'defeat' ?
                                <Hijackable
                                    category="value"
                                    scope="archives"
                                    text={outcome.toUpperCase()}
                                    altText={outcome === 'victory' ? 'DEFEAT' : 'VICTORY'}
                                    className={
                                        outcome === 'defeat' ? 'text-danger' : (
                                            'text-success'
                                        )
                                    }
                                    altClassName={
                                        outcome === 'defeat' ? 'text-success' : (
                                            'text-danger'
                                        )
                                    }
                                />
                            :   outcome.toUpperCase()
                        }
                        subtitle={outcomeFaction ?? undefined}
                        accentColor={outcomeColor}
                        valueColor={
                            outcome !== 'victory' && outcome !== 'defeat' ?
                                outcomeColor
                            :   undefined
                        }
                    />
                    {rateCards(events)}
                    {difficultyCard(diff.difficulty, diff.successful)}
                </div>
                {closestCalls.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <h3 className="text-small text-text-muted">
                            Closest Calls — defends that came nearest to holding
                        </h3>
                        <div className="stat-grid">
                            {closestCalls.map((c, i) => (
                                <StatCard
                                    key={`${c.enemy}-${c.region}-${i}`}
                                    label={
                                        map[c.enemy]?.[c.region]?.region ??
                                        `Region ${c.region}`
                                    }
                                    value={`${(c.ratio * 100).toFixed(1)}%`}
                                    subtitle={factions[c.enemy]?.name}
                                    accentColor="danger"
                                />
                            ))}
                        </div>
                    </div>
                )}
            </>
        );
    }

    const factionIndex = FACTION_INDEX[faction];
    if (factionIndex === undefined) return null;
    const factionEvents = events.filter((e) => e.enemy === factionIndex);
    if (!factionEvents.length) return null;

    // Average battle length across this faction's events.
    const durations = factionEvents
        .filter((e) => e.end_time && e.start_time)
        .map((e) => e.end_time - e.start_time);
    const avgDuration =
        durations.length > 0 ?
            durations.reduce((a, b) => a + b, 0) / durations.length
        :   null;

    // Most-fought region for this faction.
    const regionCounts = {};
    for (const e of factionEvents) {
        regionCounts[e.region] = (regionCounts[e.region] ?? 0) + 1;
    }
    const topRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];
    const hotspotName =
        topRegion ? (map[factionIndex]?.[Number(topRegion[0])]?.region ?? '—') : '—';

    // Final conquest share from the last snapshot.
    let conquest = '—';
    const snapshots = data?.snapshots;
    const pointsMax = data?.points_max;
    if (snapshots?.length && pointsMax?.points) {
        const factionData = snapshots[snapshots.length - 1].data?.[factionIndex];
        const maxPoints = pointsMax.points[factionIndex];
        if (maxPoints > 0 && factionData?.points != null) {
            conquest = ((Number(factionData.points) / maxPoints) * 100).toFixed(1) + '%';
        }
    }

    const factionLive = live?.find((r) => r.enemy === factionIndex);

    return (
        <div className="stat-grid">
            {rateCards(factionEvents)}
            <StatCard
                label="AVG_BATTLE"
                value={avgDuration != null ? formatCompactDuration(avgDuration) : '—'}
            />
            <StatCard label="HOTSPOT" value={hotspotName} />
            <StatCard label="CONQUEST" value={conquest} />
            {difficultyCard(
                factionLive?.total_mission_difficulty,
                factionLive?.successful_missions,
            )}
        </div>
    );
}
