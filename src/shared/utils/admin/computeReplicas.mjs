const LIVE_MS = 90_000; // Docker's 3 x 30 s healthcheck rule
const GONE_MS = 300_000;
const SKEW_ALERT_MS = 600_000;

/**
 * Derive the replica view for the admin System Overview (#596). Roles and
 * states are computed on read from `app_instance` rows and the lease row,
 * never stored. Rows older than 24 h are already dropped by listInstances.
 * @param {Array<{ id: string, host: string, version: string, worker_enabled: boolean, started_at: Date|string, last_seen: Date|string }>} instances - app_instance rows
 * @param {{ holder_id?: string|null, lease_until?: Date|string|null } | null} heartbeat - worker_heartbeat row, or null
 * @param {number} [now] - Current time in ms.
 * @returns {{ replicas: Array<object>, gone: Array<object>, liveVersions: string[], skew: { since: Date, alert: boolean } | null, hasPoller: boolean }}
 */
export function computeReplicas(instances, heartbeat, now = Date.now()) {
    const leaseLive =
        heartbeat?.lease_until ? new Date(heartbeat.lease_until).getTime() > now : false;
    const replicas = [];
    const gone = [];
    for (const row of instances) {
        const age = now - new Date(row.last_seen).getTime();
        if (age > GONE_MS) {
            gone.push(row);
            continue;
        }
        const role =
            leaseLive && row.id === heartbeat?.holder_id ? 'poller'
            : row.worker_enabled ? 'standby'
            : 'web';
        replicas.push({ ...row, role, state: age <= LIVE_MS ? 'live' : 'late' });
    }
    replicas.sort(
        (a, b) =>
            Number(b.role === 'poller') - Number(a.role === 'poller') ||
            a.host.localeCompare(b.host),
    );
    gone.sort(
        (a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime(),
    );

    const live = replicas.filter((r) => r.state === 'live');
    const liveVersions = [...new Set(live.map((r) => r.version))].sort((a, b) =>
        a.localeCompare(b, 'en', { numeric: true }),
    );
    let skew = null;
    if (liveVersions.length > 1) {
        const newest = liveVersions[liveVersions.length - 1];
        const since = new Date(
            Math.min(
                ...live
                    .filter((r) => r.version === newest)
                    .map((r) => new Date(r.started_at).getTime()),
            ),
        );
        skew = { since, alert: now - since.getTime() > SKEW_ALERT_MS };
    }
    return {
        replicas,
        gone,
        liveVersions,
        skew,
        hasPoller: replicas.some((r) => r.role === 'poller'),
    };
}
