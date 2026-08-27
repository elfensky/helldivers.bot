import os from 'node:os';
import { randomUUID } from 'node:crypto';
import db from '@/db/db';

/**
 * The poller lease (#517). Every replica runs the cron thread; on each poll
 * it tries to claim this row. Postgres serialises the write, so exactly one
 * instance holds the lease at a time and the others answer "standby". A dead
 * holder simply stops renewing and the row is free once `lease_until` passes
 * — failover is bounded by LEASE_TTL_S, no election, no manual step.
 *
 * The poller's state (prev_events, last_season_observed) lives in the same
 * row: a new holder inherits the last snapshot instead of starting blind,
 * so a transition across a handover is neither missed nor sent twice.
 *
 * Not pg_advisory_lock: those are bound to a session, and Prisma pools
 * connections.
 */
export const WORKER_TYPE = 'cron_api_poller';
export const LEASE_TTL_S = 60; // 3 polls at the 20 s staging cadence
/**
 * Host + pid + nonce. In a container os.hostname() is the container ID,
 * which tells a dashboard nothing; Swarm passes the node name (and task
 * slot) in via SENTRY_SERVER_NAME, so prefer that when present.
 * @param {NodeJS.ProcessEnv} [env] - Environment to read the name from.
 * @param {string} [hostname] - Fallback host name.
 * @returns {string}
 */
export function makeHolderId(env = process.env, hostname = os.hostname()) {
    const host = env.SENTRY_SERVER_NAME?.trim() || hostname;
    return `${host}:${process.pid}:${randomUUID().slice(0, 8)}`;
}
export const HOLDER_ID = makeHolderId();

/**
 * Claim or renew the lease. Returns the persisted poller state when this
 * instance holds it, or null when another live holder does.
 * @param {string} [holderId] - This process's identity; defaults to HOLDER_ID.
 * @param {number} [ttlSeconds] - How long a claim stays valid without renewal.
 * @returns {Promise<{ prevEvents: object[] | null, lastSeasonObserved: number | null } | null>}
 */
export async function claimLease(holderId = HOLDER_ID, ttlSeconds = LEASE_TTL_S) {
    // In DO UPDATE, `worker_heartbeat.col` is the OLD row and EXCLUDED the
    // proposed one — so started_at resets exactly when the holder changes.
    //
    // Every timestamp here is `now() AT TIME ZONE 'UTC'`: the columns are
    // naive timestamp(3) that Prisma writes in UTC, while a bare now() is
    // the session's local time — mixing the two put started_at two hours
    // off last_beat on the dashboard. The lease comparison must use the
    // same clock it was written with.
    const rows = await db.$queryRaw`
        INSERT INTO worker_heartbeat (worker_type, holder_id, lease_until, last_beat, started_at, updated_at)
        VALUES (
            ${WORKER_TYPE}, ${holderId},
            (now() AT TIME ZONE 'UTC') + make_interval(secs => ${ttlSeconds}),
            now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
        )
        ON CONFLICT (worker_type) DO UPDATE SET
            holder_id   = EXCLUDED.holder_id,
            lease_until = EXCLUDED.lease_until,
            started_at  = CASE
                WHEN worker_heartbeat.holder_id IS DISTINCT FROM EXCLUDED.holder_id THEN now() AT TIME ZONE 'UTC'
                ELSE worker_heartbeat.started_at END
        WHERE worker_heartbeat.holder_id = EXCLUDED.holder_id
           OR worker_heartbeat.lease_until IS NULL
           OR worker_heartbeat.lease_until < now() AT TIME ZONE 'UTC'
        RETURNING holder_id, prev_events, last_season_observed
    `;
    const row = rows[0];
    if (!row) return null;
    return {
        prevEvents: row.prev_events ?? null,
        lastSeasonObserved: row.last_season_observed ?? null,
    };
}

/**
 * Write poller state, but only while still the holder — a lease that expired
 * mid-poll must not let a stale instance clobber the new holder's snapshot.
 * @param {string} holderId - Only this holder's row is written.
 * @param {{ prevEvents?: object[] | null, lastSeasonObserved?: number | null }} state - Fields to persist; omitted ones are left alone.
 */
export async function persistPollerState(holderId, state) {
    const data = {};
    if ('prevEvents' in state) data.prev_events = state.prevEvents;
    if ('lastSeasonObserved' in state)
        data.last_season_observed = state.lastSeasonObserved;
    await db.worker_heartbeat.updateMany({
        where: { worker_type: WORKER_TYPE, holder_id: holderId },
        data,
    });
}
