import { performanceTime } from '@/utils/time';
import { tryCatch } from '@/lib/tryCatch';

export async function initializeWorker() {
    'use server';
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const key = process.env.UPDATE_API;
        if (!key) {
            throw new Error('UPDATE_API is not set');
        }
        //dynamic imports
        //worker threads and path
        const { performance } = await import('perf_hooks');
        const { Worker } = await import('worker_threads');
        const { fileURLToPath } = await import('url');
        const path = await import('path');
        const fs = await import('fs');

        //initialize
        const start = performance.now();
        try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const workerPath = path.resolve(__dirname, '../workers/cron.js');

            const worker = new Worker(workerPath);
            worker.postMessage(key);
            worker.onmessage = function (e) {
                if (e.data.error) {
                    console.error('Worker error:', e.data.error, 'at', e.data.time);
                } else {
                    console.log('Worker result:', e.data.data, 'at', e.data.time);
                }
            };
            return true;
        } catch (error) {
            console.error(error.message, {
                cause: '/src/utils/initialize.worker.mjs',
            });
            return false;
        }
    }
}
