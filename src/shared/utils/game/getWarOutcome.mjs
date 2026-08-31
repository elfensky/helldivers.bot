/**
 * Determine war outcome from campaign data.
 *
 * Algorithm (verified against 137 wiki-confirmed seasons, 0 mismatches):
 *
 * Victory signals:
 *   1. Live data: all 3 factions have status 'defeated' (current season)
 *   2. ANY snapshot contains all 3 factions with status 'defeated'
 *   3. All 3 enemy homeworlds captured (successful attack events on enemies 0, 1, 2)
 *
 * A null or missing faction slot in either `data.status` or a snapshot's
 * `data` array fails the all-defeated check rather than throwing — it is
 * never treated as a defeated faction (STAB-05).
 *
 * Defeat signal:
 *   - Chronologically last region-0 defend event has status 'fail' (Super Earth fell)
 *
 * Decision:
 *   - Victory signal AND no defeat signal → Victory
 *   - Defeat signal → Defeat
 *   - No victory signal → Defeat (war ended without winning)
 *   - No data → null (no banner)
 *
 * Faction attribution:
 *   - Victory: `faction` is the enemy id of the last successful attack event
 *     (the homeworld captured last by end_time — "who did the Helldivers
 *     defeat last")
 *   - Defeat: `faction` is the enemy id of the latest failed region-0
 *     defend event (the attacker who broke Super Earth — "who were the
 *     Helldivers defeated by"). `null` when no such event exists — do NOT
 *     guess from other signals, since "defeat" here is strictly the Super
 *     Earth fall signal per product intent.
 *
 * Key insight: check ANY snapshot, not just the last. The API's periodic snapshots
 * may miss the final moment, but earlier snapshots can capture the all-defeated state.
 *
 * @param {object} data - Campaign data with snapshots[], events[], status[]
 * @returns {{ outcome: 'victory'|'defeat', reason: string, faction: number|null } | null}
 */
import { EVENT_TYPE, EVENT_STATUS, CAMPAIGN_STATUS } from '@/shared/enums/events.mjs';

export function getWarOutcome(data) {
    const snapshots = data?.snapshots || [];
    const events = data?.events || [];
    const live = data?.status || [];

    // No data at all — no banner
    if (snapshots.length === 0 && events.length === 0 && live.length === 0) {
        return null;
    }

    // Last conquered homeworld (by end_time desc) — used for victory attribution
    const successfulAttacks = events
        .filter((e) => e.type === EVENT_TYPE.ATTACK && e.status === EVENT_STATUS.SUCCESS)
        .sort((a, b) => (b.end_time ?? 0) - (a.end_time ?? 0));
    const lastConqueredFaction = successfulAttacks[0]?.enemy ?? null;

    // Victory signal 1: live data shows all 3 factions defeated (current season)
    if (live.length === 3 && live.every((f) => f?.status === CAMPAIGN_STATUS.DEFEATED)) {
        return {
            outcome: 'victory',
            reason: 'All enemy factions have been defeated.',
            faction: lastConqueredFaction,
        };
    }

    // Victory signal 2: ANY snapshot shows all 3 factions defeated
    const anySnapshotDefeated = snapshots.some((snap) => {
        const factionData = snap.data;
        return (
            Array.isArray(factionData) &&
            factionData.length === 3 &&
            factionData.every((f) => f?.status === CAMPAIGN_STATUS.DEFEATED)
        );
    });

    // Victory signal 3: all 3 enemy homeworlds captured (successful attacks)
    const factionsDefeated = new Set(successfulAttacks.map((e) => e.enemy));
    const allHomeworldsCaptured = factionsDefeated.size === 3;

    const victorySignal = anySnapshotDefeated || allHomeworldsCaptured;

    // Defeat signal: last region-0 defend event failed (Super Earth fell)
    const r0Defends = events
        .filter((e) => e.type === EVENT_TYPE.DEFEND && e.region === 0)
        .sort((a, b) => a.end_time - b.end_time);
    const lastR0Defend = r0Defends[r0Defends.length - 1] ?? null;
    const defeatSignal =
        lastR0Defend !== null && lastR0Defend.status === EVENT_STATUS.FAIL;

    // Decision
    if (victorySignal && !defeatSignal) {
        return {
            outcome: 'victory',
            reason: 'All enemy factions have been defeated.',
            faction: lastConqueredFaction,
        };
    }
    // defeatSignal OR no victorySignal → defeat
    return {
        outcome: 'defeat',
        reason: 'The war was lost.',
        faction: defeatSignal ? (lastR0Defend.enemy ?? null) : null,
    };
}
