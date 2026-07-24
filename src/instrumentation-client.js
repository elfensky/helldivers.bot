// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
import { guardedReload } from '@/shared/utils/reloadGuard.mjs';
import { isChunkError } from '@/shared/utils/isChunkError.mjs';
import { registerSwErrorBridge } from '@/shared/utils/swErrorBridge.mjs';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
        process.env.NEXT_PUBLIC_DEPLOY_ENV ||
        process.env.DEPLOY_ENV ||
        process.env.NODE_ENV,
    sendDefaultPii: true,
    // 10% transaction sampling in production trims per-navigation/per-request
    // SDK overhead while staying statistically useful; full sampling in
    // dev/preview so local traces are never missed.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    tunnel: '/api/glitchtip',
    debug: false,
    // A client that outlived a deploy requests chunk URLs the new build no longer
    // serves. Next/React catch most of those internally and report them as
    // *handled* exceptions (mechanism `generic`), so they never reach the
    // `unhandledrejection` listener below — every observed production
    // ChunkLoadError arrived this way, meaning the auto-reload never fired.
    // beforeSend is the one place every reporting path passes through.
    // Deferred a tick so the event is queued for transport before we navigate;
    // guardedReload's circuit breaker (3 reloads / 30s) bounds the retry.
    beforeSend(event, hint) {
        if (isChunkError(hint?.originalException)) {
            setTimeout(() => guardedReload('chunk'), 0);
        }
        return event;
    },
});

// Forward errors postMessage'd from the service worker (push handler etc.)
// into Sentry. The SW context can't import the SDK directly.
registerSwErrorBridge();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Retained as the fallback path: with no DSN configured Sentry never runs
// beforeSend, and genuinely unhandled chunk rejections still need the reload.
window.addEventListener('unhandledrejection', (event) => {
    if (isChunkError(event.reason)) {
        guardedReload('chunk');
    }
});
