import { performanceTime } from '@/utils/time';
import { tryCatch } from '@/utils/tryCatch';

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

        //dynamic imports
        //worker threads and path
        const { performance } = await import('perf_hooks');
        const { Worker } = await import('worker_threads');
        const { fileURLToPath } = await import('url');
        const path = await import('path');
        const fs = await import('fs');
        const { exec } = await import('child_process');

        //initialize
        const start = performance.now();
        try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            // console.log(__dirname);

            let workerPath = '';
            if (process.env.NODE_ENV === 'development') {
                // path = '../../public/workers/cron.js');
                workerPath = path.resolve(__dirname, '../../public/workers/cron.js');
            } else {
                workerPath = path.resolve('/app/public/workers/cron.js');
            }

            // const workerPath = path.resolve(__dirname, '../../public/workers/cron.js');
            // console.log(workerPath);

            // exec('ls -all', (error, stdout, stderr) => {
            //     if (error) {
            //         console.error(`Error: ${error.message}`);
            //         return;
            //     }
            //     if (stderr) {
            //         console.error(`Stderr: ${stderr}`);
            //         return;
            //     }
            //     console.log(`Output:\n${stdout}`);
            // });

            const worker = new Worker(workerPath);
            worker.postMessage({ key: key, interval: interval });
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
