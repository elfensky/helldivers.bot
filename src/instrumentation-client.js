// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

if (process.env.NODE_ENV === 'production') {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        sendDefaultPii: true,
        tracesSampleRate: 0.25,
        autoSessionTracking: false,
        tunnel: '/api/glitchtip-tunnel',
        debug: false,
    });
}

export const onRouterTransitionStart =
    process.env.NODE_ENV === 'production'
        ? Sentry.captureRouterTransitionStart
        : () => {};
