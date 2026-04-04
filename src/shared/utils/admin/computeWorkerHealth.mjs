const HEALTH_THRESHOLD_MS = 30_000;

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
