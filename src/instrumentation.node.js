import { initializeEnvironmentVariables } from '@/shared/utils/initializeEnv';
import { initializeWorker } from '@/shared/utils/initializeWorker';
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

    // WORKER - continiously update current campaign from the official Helldivers API
    const worker = await initializeWorker();
    if (!worker) {
        throw new Error('instrumentation.js | worker: initialization failed');
    }
    console.info('instrumentation.js | worker: ', worker);
}
