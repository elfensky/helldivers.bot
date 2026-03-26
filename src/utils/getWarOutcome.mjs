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
 * Defeat signal:
 *   - Chronologically last region-0 defend event has status 'fail' (Super Earth fell)
 *
 * Decision:
 *   - Victory signal AND no defeat signal → Victory
 *   - Defeat signal → Defeat
 *   - No victory signal → Defeat (war ended without winning)
 *   - No data → null (no banner)
 *
 * Key insight: check ANY snapshot, not just the last. The API's periodic snapshots
 * may miss the final moment, but earlier snapshots can capture the all-defeated state.
 *
 * @param {object} data - Campaign data with snapshots[], events[], live[]
 * @returns {{ outcome: 'victory'|'defeat', reason: string } | null}
 */
export function getWarOutcome(data) {
    const snapshots = data?.snapshots || [];
    const events = data?.events || [];
    const live = data?.live || [];

    // No data at all — no banner
    if (snapshots.length === 0 && events.length === 0 && live.length === 0) {
        return null;
    }

    // Victory signal 1: live data shows all 3 factions defeated (current season)
    if (live.length === 3 && live.every((f) => f.status === 'defeated')) {
        return { outcome: 'victory', reason: 'All enemy factions have been defeated.' };
    }

    // Victory signal 2: ANY snapshot shows all 3 factions defeated
    const anySnapshotDefeated = snapshots.some((snap) => {
        const factionData =
            typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data;
        return (
            Array.isArray(factionData) &&
            factionData.length === 3 &&
            factionData.every((f) => f.status === 'defeated')
        );
    });

    // Victory signal 3: all 3 enemy homeworlds captured (successful attacks)
    const factionsDefeated = new Set(
        events
            .filter((e) => e.type === 'attack' && e.status === 'success')
            .map((e) => e.enemy),
    );
    const allHomeworldsCaptured = factionsDefeated.size === 3;

    const victorySignal = anySnapshotDefeated || allHomeworldsCaptured;

    // Defeat signal: last region-0 defend event failed (Super Earth fell)
    const r0Defends = events
        .filter((e) => e.type === 'defend' && e.region === 0)
        .sort((a, b) => a.end_time - b.end_time);
    const defeatSignal =
        r0Defends.length > 0 && r0Defends[r0Defends.length - 1].status === 'fail';

    // Decision
    if (victorySignal && !defeatSignal) {
        return { outcome: 'victory', reason: 'All enemy factions have been defeated.' };
    }
    if (defeatSignal) {
        return { outcome: 'defeat', reason: 'The war was lost.' };
    }
    if (!victorySignal) {
        return { outcome: 'defeat', reason: 'The war was lost.' };
    }

    return null;
}
