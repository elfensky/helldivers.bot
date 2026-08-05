import { hydrateFileSecrets } from './hydrateFileSecrets.mjs';

/**
 * Validates environment variables at startup.
 * Core vars (database, worker) throw if missing — the app cannot function without them.
 * Optional vars (auth, analytics) warn if missing — features degrade gracefully.
 *
 * Marked `async` even though no body awaits anything: the keyword wraps
 * sync throws from the validate/check helpers into a rejected promise so
 * callers can use the project's `tryCatch` wrapper uniformly. Dropping the
 * keyword would force callers into raw try/catch blocks (banned by the
 * codebase convention in CLAUDE.md).
 *
 * @returns {Promise<{ auth: boolean, analytics: boolean }>}
 * @throws {Error} if a core env var is unset, or if auth is partially configured
 */
export async function initializeEnvironmentVariables() {
    // Populate <KEY> from <KEY>_FILE (Docker/Swarm secrets) before validating —
    // must run before Prisma reads POSTGRES_URL. See hydrateFileSecrets.mjs.
    hydrateFileSecrets();
    validateDatabase();
    validateUpdates();
    const analytics = checkAnalytics();
    const auth = checkAuth();
    return { auth, analytics };
}

function validateDatabase() {
    if (!process.env.POSTGRES_URL) {
        throw new Error('POSTGRES_URL is not set');
    }
}

function validateUpdates() {
    if (!process.env.UPDATE_KEY) {
        throw new Error('UPDATE_KEY is not set');
    }
    if (!process.env.UPDATE_INTERVAL) {
        throw new Error('UPDATE_INTERVAL is not set');
    }
    if (!process.env.PORT) {
        console.info('PORT has defaulted to 3000');
    }
}

/**
 * Check analytics env vars. Warns on missing vars instead of throwing.
 * Special case: SENTRY_DSN set without SENTRY_AUTH_TOKEN warns about degraded source maps.
 * @returns {boolean} true if any analytics service is configured
 */
function checkAnalytics() {
    const hasSentryDsn = !!process.env.SENTRY_DSN;
    const hasSentryToken = !!process.env.SENTRY_AUTH_TOKEN;
    const hasUmami = !!process.env.UMAMI_SITE_ID;

    if (!hasUmami) {
        console.warn('UMAMI_SITE_ID is not set — Umami analytics disabled');
    }
    if (!hasSentryDsn) {
        console.warn('SENTRY_DSN is not set — error tracking disabled');
    }
    if (hasSentryDsn && !hasSentryToken) {
        console.warn(
            'SENTRY_DSN is set but SENTRY_AUTH_TOKEN is missing — error tracking will work but source maps will not upload',
        );
    }
    return hasSentryDsn || hasUmami;
}

/**
 * Check auth env vars. If BETTER_AUTH_SECRET is absent, auth is intentionally disabled.
 * If BETTER_AUTH_SECRET is present but other auth vars are missing, that's a misconfiguration — throw.
 * @returns {boolean} true if auth is configured
 * @throws {Error} if auth is partially configured (secret present but other vars missing)
 */
function checkAuth() {
    if (!process.env.BETTER_AUTH_SECRET) {
        console.warn('BETTER_AUTH_SECRET is not set — auth features disabled');
        return false;
    }

    // Auth is intended — validate all required auth vars
    if (!process.env.BETTER_AUTH_URL) {
        throw new Error('BETTER_AUTH_URL is not set');
    }
    if (!process.env.AUTH_DISCORD_ID) {
        throw new Error('AUTH_DISCORD_ID is not set');
    }
    if (!process.env.AUTH_DISCORD_SECRET) {
        throw new Error('AUTH_DISCORD_SECRET is not set');
    }
    if (!process.env.AUTH_GITHUB_ID) {
        throw new Error('AUTH_GITHUB_ID is not set');
    }
    if (!process.env.AUTH_GITHUB_SECRET) {
        throw new Error('AUTH_GITHUB_SECRET is not set');
    }
    if (!process.env.AUTH_GOOGLE_ID) {
        throw new Error('AUTH_GOOGLE_ID is not set');
    }
    if (!process.env.AUTH_GOOGLE_SECRET) {
        throw new Error('AUTH_GOOGLE_SECRET is not set');
    }
    return true;
}
