import { reportError } from './observability.mjs';

/**
 * Reconstruct an Error from a structured-clone-safe SW message and forward
 * to GlitchTip. Service workers run in a separate context with no DOM and
 * can't import the Sentry browser SDK, so sw.js postMessage's failures to
 * its controlled clients; this handler is the receiver.
 *
 * Expected message shape:
 *   { type: 'sw-error', error: { message, name?, stack? }, context?: object }
 *
 * @param {MessageEvent | { data: unknown } | null | undefined} event - postMessage event received from the service worker
 */
export function handleSwErrorMessage(event) {
    const msg = event?.data;
    if (!msg || msg.type !== 'sw-error' || !msg.error) return;
    const err = new Error(msg.error.message ?? 'Service worker error');
    err.name = msg.error.name || 'Error';
    if (msg.error.stack) err.stack = msg.error.stack;
    reportError(err, { source: 'sw', ...(msg.context ?? {}) });
}

/**
 * Wire the SW → client error bridge. Safe to call multiple times — the
 * browser deduplicates addEventListener registrations by listener identity,
 * and `handleSwErrorMessage` is a stable module-level reference.
 */
export function registerSwErrorBridge() {
    if (typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', handleSwErrorMessage);
}
