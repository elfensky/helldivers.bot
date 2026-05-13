/**
 * Testable polling loop extracted from `cron.js`.
 *
 * The thin `cron.js` shell connects parentPort + the doWork factory together;
 * this file is the actual logic and can be unit-tested without spawning a
 * worker_threads thread or intercepting Node built-ins.
 */

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
                    ...(isFirstPoll && { 'X-Worker-Startup': '1' }),
                },
            });
            const data = await response.json();
            parentPort.postMessage({ data, time: new Date().toString() });
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

module.exports = { makeDoWork };
