import { performance } from 'node:perf_hooks';
import db from '@/db/db';
import { HOLDER_ID } from '@/update/lease.mjs';
import { isWorkerEnabled } from '@/shared/utils/initializeWorker.mjs';

/**
 * Replica registry (#596): one `app_instance` row per running process, keyed
 * by HOLDER_ID. /api/healthcheck refreshes it; roles (poller, standby, web
 * only) are derived on read, see computeReplicas.
 */
const REGISTER_INTERVAL_MS = 20_000;
const RETENTION_MS = 24 * 3_600_000;
const STARTED_AT = new Date(performance.timeOrigin); // Node's process start
let lastRegistered = 0;

/**
 * Upsert this process's row, at most once per 20 s. The stamp is set before
 * the write, so a failed write retries on the next window and concurrent
 * calls never double-write.
 * @param {number} [now] - Current time in ms.
 * @returns {Promise<void>}
 */
export async function registerInstance(now = Date.now()) {
    if (now - lastRegistered < REGISTER_INTERVAL_MS) return;
    lastRegistered = now;
    const row = {
        host: HOLDER_ID.split(':')[0],
        version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
        worker_enabled: isWorkerEnabled(),
        started_at: STARTED_AT,
        last_seen: new Date(now),
    };
    await db.app_instance.upsert({
        where: { id: HOLDER_ID },
        create: { id: HOLDER_ID, ...row },
        update: row,
    });
}

/**
 * Rows seen in the last 24 h; older replicas drop out of the panel.
 * @param {number} [now] - Current time in ms.
 */
export function listInstances(now = Date.now()) {
    return db.app_instance.findMany({
        where: { last_seen: { gte: new Date(now - RETENTION_MS) } },
    });
}

/**
 * Delete rows last seen more than 24 h ago.
 * @param {number} [now] - Current time in ms.
 */
export function pruneInstances(now = Date.now()) {
    return db.app_instance.deleteMany({
        where: { last_seen: { lt: new Date(now - RETENTION_MS) } },
    });
}
