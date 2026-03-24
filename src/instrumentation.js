import * as Sentry from '@sentry/nextjs';
import { initializeEnvironmentVariables } from '@/utils/initialize.env';
import { initializeOpenApiSpec } from '@/utils/initialize.openapi';
import { initializeDatabase } from '@/utils/initialize.prisma';
import { initializeWorker } from '@/utils/initialize.worker';
import { tryCatch } from '@/utils/tryCatch';

export async function register() {
    // Initialize Sentry for server-side and edge runtimes
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config');
    }

    // Initialize Helldivers API services (only for nodejs runtime)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await initializeHelldivers1Api();
    }
}

// Capture errors from Server Components, middleware, and proxies
export const onRequestError = Sentry.captureRequestError;

async function initializeHelldivers1Api() {
    'use server';
    //ENVIRONMENT - are the required .env variables present and set
    const { data: env, error: envError } = await tryCatch(initializeEnvironmentVariables());
    if (envError) {
        throw new Error(`instrumentation.js | env: ${envError.message}`);
    }
    console.info('instrumentation.js | env:', env);

    // OPEN API - generate spec or check if spec exists
    const openapi = await initializeOpenApiSpec();
    if (!openapi) {
        throw new Error('instrumentation.js | openapi: initialization failed');
    }
    console.info('instrumentation.js | openapi: ', openapi);

    // DATABASE - check if connceted, run migrations and generate empty seasons
    // THIS IS NO LONGER NECCESARY, INITIALIZATION & MIGRATIONS ARE HANDLED IN A SEPARATE CONTAINER THAT RUNS ONCE
    // const database = await initializeDatabase();
    // if (!database) {
    //     console.error('instrumentation.js | database: ', database);
    //     process.exit(1);
    // }
    // console.info('instrumentation.js | database: ', database);

    // WORKER - continiously update current campaign from the official Helldivers API
    const worker = await initializeWorker();
    if (!worker) {
        throw new Error('instrumentation.js | worker: initialization failed');
    }
    console.info('instrumentation.js | worker: ', worker);
}
