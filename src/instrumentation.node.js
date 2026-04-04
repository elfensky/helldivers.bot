import { initializeEnvironmentVariables } from '@/shared/utils/initialize.env';
import { initializeOpenApiSpec } from '@/shared/utils/api/initialize.openapi';
import { initializeWorker } from '@/shared/utils/initialize.worker';
import { tryCatch } from '@/shared/utils/tryCatch';

export async function initializeHelldivers1Api() {
    //ENVIRONMENT - are the required .env variables present and set
    const { data: env, error: envError } = await tryCatch(
        initializeEnvironmentVariables(),
    );
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

    // WORKER - continiously update current campaign from the official Helldivers API
    const worker = await initializeWorker();
    if (!worker) {
        throw new Error('instrumentation.js | worker: initialization failed');
    }
    console.info('instrumentation.js | worker: ', worker);
}
