/**
 * Spawns the cron worker thread that polls the API update endpoint on a timer.
 * Only runs under the Node.js runtime; registers SIGINT/SIGTERM handlers for graceful shutdown.
 * @returns {Promise<boolean>} true if the worker started, false otherwise
 */
export async function initializeWorker() {
    'use server';

    if (process.env.NEXT_RUNTIME === 'nodejs') {
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

            let worker = new Worker(workerPath);
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
            });

            process.on('SIGINT', async () => {
                console.info('SIGINT received, terminating update worker...');
                if (worker) {
                    await worker.terminate();
                }
                process.exit();
            });

            process.on('SIGTERM', async () => {
                console.info('SIGTERM received, terminating update worker...');
                if (worker) {
                    await worker.terminate();
                }
                process.exit();
            });

            return true;
        } catch (error) {
            console.error(error.message, {
                cause: '/src/shared/utils/initializeWorker.mjs',
            });
            return false;
        }
    }

    return false;
}
