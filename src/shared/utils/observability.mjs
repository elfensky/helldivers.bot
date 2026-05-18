import * as Sentry from '@sentry/nextjs';

/**
 * Report a caught error to GlitchTip via the Sentry SDK.
 * Safe to call when Sentry is unconfigured — the SDK no-ops.
 *
 * @param {unknown} error - the error to report; falsy values are skipped
 * @param {Record<string, unknown> & { level?: 'warning' | 'error' | 'fatal' }} [context]
 *   Additional context attached as `extra` on the Sentry event. `level`, if
 *   present, becomes the event severity (default 'error' applies otherwise).
 */
export function reportError(error, context = {}) {
    if (!error) return;
    const { level, ...extra } = context;
    Sentry.captureException(error, { level, extra });
}
