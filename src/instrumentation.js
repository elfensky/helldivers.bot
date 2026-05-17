import * as Sentry from '@sentry/nextjs';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        if (process.env.SENTRY_DSN) {
            await import('../sentry.server.config');
        }
        const { initializeHelldivers1Api } = await import('./instrumentation.node');
        await initializeHelldivers1Api();
    }
}

// Capture errors from Server Components and proxies — gated on DSN, not
// NODE_ENV, so localhost reports too when SENTRY_DSN is set in .env.development.
// Environments are still distinguishable via the `environment` tag.
export const onRequestError =
    process.env.SENTRY_DSN ? Sentry.captureRequestError : () => {};
