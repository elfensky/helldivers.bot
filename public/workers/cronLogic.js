/**
 * Testable polling loop extracted from `cron.js`.
 *
 * The thin `cron.js` shell connects parentPort + the doWork factory together;
 * this file is the actual logic and can be unit-tested without spawning a
 * worker_threads thread or intercepting Node built-ins.
 */

// Custom header set on the very first poll of a worker session so the
// /api/h1/update handler can run a one-time startup pass (e.g. backfill
// missing seasons). Must match the lowercase string read in
// src/app/api/h1/update/route.js — kept in lockstep by the test in
// src/__tests__/unit/workers/cron.test.mjs.
const WORKER_STARTUP_HEADER = 'X-Worker-Startup';

/**
 * Build a self-scheduling poll loop for the worker.
 *
 * @param {{ key: string, interval: number, port: number }} cfg
 * @param {{ postMessage: (msg: object) => void }} parentPort
 * @returns {() => void} — call to start the loop
 */
function makeDoWork({ key, interval, port }, parentPort) {
    let isFirstPoll = true;

    async function doWork() {
        const url = `http://localhost:${port}/api/h1/update`;

        try {
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${key}`,
                    ...(isFirstPoll && { [WORKER_STARTUP_HEADER]: '1' }),
                },
            });
            const data = await response.json();
            parentPort.postMessage({ data, time: new Date().toString() });

            // Fire-and-forget GlitchTip uptime ping. Only on 2xx so that a
            // sustained 5xx (HD1 API down, DB down) flips the monitor red.
            if (response.ok && process.env.GLITCHTIP_HEARTBEAT_URL) {
                fetch(process.env.GLITCHTIP_HEARTBEAT_URL, { method: 'POST' }).catch(
                    () => {},
                );
            }
        } catch (err) {
            parentPort.postMessage({
                error: err.toString(),
                time: new Date().toString(),
            });
        }

        isFirstPoll = false;

        // setTimeout (not setInterval) — prevents overlapping requests if a
        // poll takes longer than the interval, and avoids race conditions in
        // the DB upserts on the receiving end.
        setTimeout(doWork, interval * 1000);
    }

    return doWork;
}

module.exports = { makeDoWork, WORKER_STARTUP_HEADER };
