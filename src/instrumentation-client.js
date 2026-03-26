// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
    dsn: 'https://853ecd1fc1dd47f28d6bb82a270cbbc5@bugsink.lavrenov.cloud/2',

    // Bugsink recommendation: send PII since it's self-hosted
    sendDefaultPii: true,

    // Bugsink recommendation: disable traces (not supported by Bugsink)
    tracesSampleRate: 0,

    // Disable features not supported by Bugsink
    // No session replay, feedback, or logs - Bugsink focuses only on error events

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
