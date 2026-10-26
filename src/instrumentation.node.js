import { initializeEnvironmentVariables } from '@/shared/utils/initializeEnv.mjs';
import { initializeWorker } from '@/shared/utils/initializeWorker.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { migrateOrWait } from '@/update/migrateOnStart.mjs';

export async function initializeHelldivers1Api() {
    //ENVIRONMENT - are the required .env variables present and set
    const { data: env, error: envError } = await tryCatch(
        initializeEnvironmentVariables(),
    );
    if (envError) {
        throw new Error(`instrumentation.js | env: ${envError.message}`);
    }
    console.info('instrumentation.js | env:', env);

    // MIGRATIONS - apply pending migrations, and the seed when its data changed, before serving (#599)
    if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
        await migrateOrWait();
    }

    // WORKER - continiously update current campaign from the official Helldivers API
    const worker = await initializeWorker();
    if (!worker) {
        throw new Error('instrumentation.js | worker: initialization failed');
    }
    console.info('instrumentation.js | worker: ', worker);
}
