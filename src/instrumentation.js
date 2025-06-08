import { initializeOpenApiSpec } from '@/utils/initialize.openapi';
import { initializeDatabase } from '@/utils/initialize.prisma';
import { initializeWorker } from '@/utils/initialize.worker';

async function initializeHelldivers1Api() {
    'use server';
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // OPEN API - generate spec or check if spec exists
        const openapi = await initializeOpenApiSpec();
        if (!openapi) {
            console.error('instrumentation.js | openapi: ', openapi);
            process.exit(1);
        }
        console.info('instrumentation.js | openapi: ', openapi);

        // DATABASE - check if connceted, run migrations and generate empty seasons
        const database = await initializeDatabase();
        if (!database) {
            console.error('instrumentation.js | database: ', database);
            process.exit(1);
        }
        console.info('instrumentation.js | database: ', database);

        // WORKER - continiously update current campaign from the official Helldivers API
        const worker = await initializeWorker();
        if (!worker) {
            console.error('instrumentation.js | worker: ', worker);
            process.exit(1);
        }
        console.info('instrumentation.js | worker: ', worker);
    }
}

initializeHelldivers1Api();
