/**
 * True unless WORKER_ENABLED is explicitly "false". Lets a horizontally scaled
 * web tier run with the poller switched off: the update path keeps state in
 * memory (prevEvents, lastSeasonObserved), so exactly one instance may poll —
 * see #516. Deployments run N web replicas with WORKER_ENABLED=false and one
 * worker replica with it on (deploy/staging/compose.yaml).
 * @returns {boolean}
 */
export function isWorkerEnabled() {
    const v = (process.env.WORKER_ENABLED ?? '').trim().toLowerCase();
    return !['false', '0', 'no', 'off'].includes(v);
}

/**
 * Spawns the cron worker thread that polls the API update endpoint on a timer.
 * Only runs under the Node.js runtime; registers SIGINT/SIGTERM handlers for graceful shutdown.
 * @returns {Promise<boolean>} true if the worker started (or is deliberately disabled), false otherwise
 */
export async function initializeWorker() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        if (!isWorkerEnabled()) {
            console.info(
                'initializeWorker | WORKER_ENABLED=false — this instance serves web only',
            );
            return true;
        }
        const key = process.env.UPDATE_KEY;
        if (!key) {
            throw new Error('UPDATE_KEY is not set');
        }
        const interval = process.env.UPDATE_INTERVAL;
        if (!interval) {
            throw new Error('UPDATE_INTERVAL is not set');
        }
        const port = process.env.PORT || 3000;

        const { Worker } = await import('worker_threads');
        const path = await import('path');

        try {
            let workerPath = '';
            if (process.env.NODE_ENV === 'development') {
                workerPath = path.resolve(process.cwd(), 'public/workers/cron.js');
            } else {
                workerPath = path.resolve('/app/public/workers/cron.js');
            }

            /** @type {InstanceType<typeof Worker> | null} */
            let worker = new Worker(workerPath);
            let shuttingDown = false;
            worker.postMessage({ key: key, interval: interval, port: port });
            worker.on('message', (data) => {
                if (data.error) {
                    console.error('Worker error:', data.error, 'at', data.time);
                }
            });
            worker.on('error', (err) => {
                console.error('Worker thread error:', err);
            });

            worker.on('exit', (code) => {
                console.info(`Worker stopped with exit code ${code}`);
                worker = null;
                // The thread is the whole ingest pipeline and the container's
                // healthcheck is a DB ping, so a dead thread would otherwise
                // leave a "healthy" task that never polls. Exit so the
                // orchestrator restarts the process.
                if (!shuttingDown) process.exit(1);
            });

            process.on('SIGINT', async () => {
                shuttingDown = true;
                console.info('SIGINT received, terminating update worker...');
                if (worker) {
                    await worker.terminate();
                }
                process.exit();
            });

            process.on('SIGTERM', async () => {
                shuttingDown = true;
                console.info('SIGTERM received, terminating update worker...');
                if (worker) {
                    await worker.terminate();
                }
                process.exit();
            });

            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(message, {
                cause: '/src/shared/utils/initializeWorker.mjs',
            });
            return false;
        }
    }

    return false;
}
