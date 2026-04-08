// Allow 2 missed polls at 15s cadence before marking down
const HEALTH_THRESHOLD_MS = 30_000;

/**
 * Derives worker health status from the latest heartbeat row.
 * @param {{ last_beat: string|Date, last_error?: string } | null} heartbeat
 * @returns {{ status: 'healthy'|'degraded'|'down', label: string, color: string }}
 */
export function computeWorkerHealth(heartbeat) {
    if (!heartbeat) {
        return { status: 'down', label: 'No data', color: 'danger' };
    }

    const age = Date.now() - new Date(heartbeat.last_beat).getTime();

    if (age > HEALTH_THRESHOLD_MS) {
        return { status: 'down', label: 'Worker down', color: 'danger' };
    }

    if (heartbeat.last_error) {
        return { status: 'degraded', label: 'Worker degraded', color: 'yellow-400' };
    }

    return { status: 'healthy', label: 'Worker healthy', color: 'green-400' };
}
