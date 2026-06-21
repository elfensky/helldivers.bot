/**
 * Typed server configuration — the config half of the Public API milestone.
 *
 * One Zod schema parses `process.env` into a frozen, typed `config` object so
 * route handlers stop reading `process.env` directly. Required vars fail fast at
 * boot with a readable message (never a runtime 500). Optional features
 * self-disable via presence-as-config (e.g. `BETTER_AUTH_SECRET` present → auth on).
 *
 * Cache tiers and rate-limit groups live here as the canonical config source; the
 * cache-headers (#436) and rate-limiter (#435) work consumes them via the helpers.
 *
 * @module config/server
 */
import { z } from 'zod';
import { SITE_URL } from '@/config/site.mjs';

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
 * `rebroadcast` (HD1-API drop-in), `backfill_trigger` (on-demand season fetch).
 */
const RATE_LIMITS = Object.freeze({
    public_read: Object.freeze({ limit: 120, windowSeconds: 60 }),
    history_read: Object.freeze({ limit: 30, windowSeconds: 60 }),
    rebroadcast: Object.freeze({ limit: 60, windowSeconds: 60 }),
    backfill_trigger: Object.freeze({ limit: 5, windowSeconds: 60 }),
});

/**
 * @param {keyof typeof CACHE_CONTROL} tier - Cache tier name.
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
 * @param {keyof typeof RATE_LIMITS} group - Rate-limit group name.
 * @returns {{ limit: number, windowSeconds: number }} the rate-limit config
 */
export function getRateLimitConfig(group) {
    const value = RATE_LIMITS[group];
    if (!value) {
        throw new Error(`Unknown rate-limit group: ${group}`);
    }
    return value;
}

// Auth is all-or-none: if the secret is present, every provider var must be too.
const AUTH_PROVIDER_VARS = [
    'BETTER_AUTH_URL',
    'AUTH_DISCORD_ID',
    'AUTH_DISCORD_SECRET',
    'AUTH_GITHUB_ID',
    'AUTH_GITHUB_SECRET',
    'AUTH_GOOGLE_ID',
    'AUTH_GOOGLE_SECRET',
];

const schema = z.object({
    // Required — the app cannot start without these.
    POSTGRES_URL: z.string().min(1),
    UPDATE_KEY: z.string().min(1),
    UPDATE_INTERVAL: z.coerce.number().int().positive(),
    // Optional with derived defaults.
    PORT: z.coerce.number().int().positive().default(3000),
    BUCKET_SIZE: z.coerce.number().int().positive().default(900),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DEPLOY_ENV: z.string().min(1).optional(),
});

/**
 * @typedef {object} ServerConfig
 * @property {'development'|'production'|'test'} nodeEnv - Resolved runtime environment.
 * @property {{ url: string }} db - Database connection config.
 * @property {{ updateKey: string, updateInterval: number, port: number }} worker - Worker/update config.
 * @property {number} bucketSize - Tumbling-window width (seconds) for h1_* timeseries.
 * @property {{ url: string }} site - Public site origin.
 * @property {string|null} deployEnv - Server-only deploy-environment tag, or null.
 * @property {boolean} auth - True when auth is fully configured (presence-as-config).
 * @property {{ umami: boolean, sentry: boolean }} analytics - Which analytics services are configured.
 */

/**
 * Parse and validate server environment variables into a frozen, typed config.
 * Throws a readable error if a required var is missing/malformed, or if auth is
 * partially configured (`BETTER_AUTH_SECRET` set but a provider var missing).
 *
 * Pure — pass an explicit `env` in tests; defaults to `process.env` at boot.
 *
 * @param {Record<string, string | undefined>} [env] - Environment to parse (defaults to `process.env`).
 * @returns {Readonly<ServerConfig>}
 */
export function parseServerConfig(env = process.env) {
    const result = schema.safeParse(env);
    if (!result.success) {
        const detail = result.error.issues
            .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('\n');
        throw new Error(`Invalid server environment configuration:\n${detail}`);
    }
    const parsed = result.data;

    let auth = false;
    if (env.BETTER_AUTH_SECRET) {
        const missing = AUTH_PROVIDER_VARS.filter((key) => !env[key]);
        if (missing.length > 0) {
            throw new Error(
                `Auth is enabled (BETTER_AUTH_SECRET set) but missing: ${missing.join(', ')}`,
            );
        }
        auth = true;
    }

    return Object.freeze({
        nodeEnv: parsed.NODE_ENV,
        db: Object.freeze({ url: parsed.POSTGRES_URL }),
        worker: Object.freeze({
            updateKey: parsed.UPDATE_KEY,
            updateInterval: parsed.UPDATE_INTERVAL,
            port: parsed.PORT,
        }),
        bucketSize: parsed.BUCKET_SIZE,
        site: Object.freeze({ url: SITE_URL }),
        deployEnv: parsed.DEPLOY_ENV ?? null,
        auth,
        analytics: Object.freeze({
            umami: Boolean(env.UMAMI_SITE_ID),
            sentry: Boolean(env.SENTRY_DSN),
        }),
    });
}

/**
 * Frozen, typed server config parsed once from `process.env` at module load.
 * @type {Readonly<ServerConfig>}
 */
export const config = parseServerConfig();
