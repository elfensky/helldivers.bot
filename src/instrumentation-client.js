// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { guardedReload } from '@/shared/utils/reloadGuard.mjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
        process.env.NEXT_PUBLIC_DEPLOY_ENV ||
        process.env.DEPLOY_ENV ||
        process.env.NODE_ENV,
    sendDefaultPii: true,
    tracesSampleRate: 1.0,
    autoSessionTracking: false,
    tunnel: '/api/glitchtip',
    debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const CHUNK_ERROR_RE =
    /ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg =
        typeof reason === 'string' ? reason : reason?.message || reason?.name || '';
    if (CHUNK_ERROR_RE.test(msg)) {
        guardedReload('chunk');
    }
});
