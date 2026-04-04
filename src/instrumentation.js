import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config');
        const { initializeHelldivers1Api } = await import('./instrumentation.node');
        await initializeHelldivers1Api();
    }
}

// Capture errors from Server Components and proxies
export const onRequestError = Sentry.captureRequestError;
