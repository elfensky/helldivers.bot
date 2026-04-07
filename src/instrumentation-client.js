// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: true,
    tracesSampleRate: 1.0,
    autoSessionTracking: false,
    tunnel: '/api/glitchtip',
    debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
