/**
 * Pure API-policy lookups — cache tiers (#436) and rate-limit groups (#435).
 *
 * These are plain frozen tables with no environment access, split out from
 * `config/server.mjs` so they can be imported from anywhere — including the
 * rate limiter, which is pulled into env-less route unit tests — without
 * tripping server.mjs's eager `config = parseServerConfig()` validation.
 *
 * Convention: route modules import `getCacheControl` / `getRateLimitConfig`
 * from HERE, not from `config/server.mjs`. Both paths are behaviourally
 * identical (server.mjs bare-re-exports them), but this one is env-free and so
 * import-safe in tests. Route modules that need real env still import `config`
 * from `config/server.mjs`. Boot-time env validation is unaffected either way —
 * it comes from `initializeEnvironmentVariables()` in `instrumentation.node.js`,
 * not from importing `config/server.mjs`.
 *
 * @module config/policy
 */

/**
 * Tiered `Cache-Control` values — the Frozen-Tail / Living-Head split. Historic
 * data is immutable (long TTL); the current season is live (short or no cache).
 */
const CACHE_CONTROL = Object.freeze({
    live: 'no-store',
    latest: 'public, max-age=10, stale-while-revalidate=30',
    'current-season': 'public, max-age=60, stale-while-revalidate=300',
    'closed-season': 'public, max-age=3600, stale-while-revalidate=86400',
});

/**
 * Per-group fixed-window rate limits. `limit` requests per `windowSeconds`.
 * `public_read` (general reads), `history_read` (paginated timeseries),
 * `rebroadcast` (HD1-API drop-in), `backfill_trigger` (on-demand season fetch),
 * `push` (notification subscribe/unsubscribe).
 */
const RATE_LIMITS = Object.freeze({
    public_read: Object.freeze({ limit: 120, windowSeconds: 60 }),
    history_read: Object.freeze({ limit: 30, windowSeconds: 60 }),
    rebroadcast: Object.freeze({ limit: 60, windowSeconds: 60 }),
    backfill_trigger: Object.freeze({ limit: 5, windowSeconds: 60 }),
    push: Object.freeze({ limit: 20, windowSeconds: 60 }),
});

/**
 * @param {string} tier - Cache tier name (a key of CACHE_CONTROL).
 * @returns {string} the `Cache-Control` header value for the tier
 */
export function getCacheControl(tier) {
    const value = CACHE_CONTROL[tier];
    if (!value) {
        throw new Error(`Unknown cache tier: ${tier}`);
    }
    return value;
}

/**
 * @param {string} group - Rate-limit group name (a key of RATE_LIMITS).
 * @returns {{ limit: number, windowSeconds: number }} the rate-limit config
 */
export function getRateLimitConfig(group) {
    const value = RATE_LIMITS[group];
    if (!value) {
        throw new Error(`Unknown rate-limit group: ${group}`);
    }
    return value;
}
