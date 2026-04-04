import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        if (process.env.NODE_ENV === 'production') {
            await import('../sentry.server.config');
        }
        const { initializeHelldivers1Api } = await import('./instrumentation.node');
        await initializeHelldivers1Api();
    }
}

// Capture errors from Server Components and proxies — no-op in development
export const onRequestError =
    process.env.NODE_ENV === 'production' ? Sentry.captureRequestError : () => {};
