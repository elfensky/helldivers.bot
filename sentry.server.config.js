// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

if (process.env.NODE_ENV === 'production') {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        sendDefaultPii: true,
        tracesSampleRate: 0.25,
        debug: false,
    });
}
