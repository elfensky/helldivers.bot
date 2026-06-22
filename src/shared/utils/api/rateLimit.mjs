import db from '@/db/db';
import { getRateLimitConfig } from '@/config/policy.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { errorResponse } from './responses.mjs';

/**
 * @typedef {object} RateLimitResult
 * @property {boolean} ok - True if the request is within the limit.
 * @property {number} limit - Max requests per window.
 * @property {number} remaining - Requests left in the current window.
 * @property {number} resetSeconds - Seconds until the window resets.
 * @property {number} retryAfter - Seconds to wait before retrying (0 when ok).
 * @property {boolean} [degraded] - True if the counter store was unreachable (fail-open).
 */

/**
 * Atomically increment the fixed-window counter for (group, key) and return the
 * verdict. One Postgres upsert per call:
 *   INSERT … ON CONFLICT (key, route_group, window_start) DO UPDATE count = count + 1
 * Fail-open: if the store is unreachable the request is allowed (the read API
 * needs the same DB anyway, so a limiter outage means a wider outage).
 *
 * @param {string} group - Rate-limit group name (see config/policy.mjs).
 * @param {string} key - Identity bucket (IP or API-key id).
 * @returns {Promise<RateLimitResult>} the verdict + window metadata.
 */
export async function checkRateLimit(group, key) {
    const { limit, windowSeconds } = getRateLimitConfig(group);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
    const resetSeconds = windowStart + windowSeconds - now;

    const { data: rows, error } = await tryCatch(
        db.$queryRaw`
            INSERT INTO api_rate_limit (key, route_group, window_start, count)
            VALUES (${key}, ${group}, ${windowStart}, 1)
            ON CONFLICT (key, route_group, window_start)
            DO UPDATE SET count = api_rate_limit.count + 1
            RETURNING count
        `,
    );
    if (error) {
        reportError(error, { stage: 'rate-limit', group });
        return {
            ok: true,
            limit,
            remaining: limit,
            resetSeconds,
            retryAfter: 0,
            degraded: true,
        };
    }

    const count = Number(rows?.[0]?.count ?? 1);
    const remaining = Math.max(0, limit - count);
    const ok = count <= limit;
    return { ok, limit, remaining, resetSeconds, retryAfter: ok ? 0 : resetSeconds };
}

/**
 * Standard rate-limit response headers (IETF draft; `RateLimit-Reset` is
 * delta-seconds). `Retry-After` is added only on a breach.
 *
 * @param {RateLimitResult} result - A `checkRateLimit` verdict.
 * @returns {Record<string, string>} headers to attach to the response.
 */
export function rateLimitHeaders(result) {
    /** @type {Record<string, string>} */
    const headers = {
        'RateLimit-Limit': String(result.limit),
        'RateLimit-Remaining': String(result.remaining),
        'RateLimit-Reset': String(result.resetSeconds),
    };
    if (!result.ok) headers['Retry-After'] = String(result.retryAfter);
    return headers;
}

/**
 * Enforce a limit for (group, key). On breach, `error` is a ready-to-return 429
 * envelope carrying the rate-limit headers; otherwise `error` is null and the
 * caller merges `headers` onto its success response.
 *
 * @param {string} group - Rate-limit group name.
 * @param {string} key - Identity bucket (IP or API-key id).
 * @param {number} start - Request start time (for the response envelope).
 * @returns {Promise<{ error: import('next/server').NextResponse | null, headers: Record<string, string> }>}
 */
export async function enforceRateLimit(group, key, start) {
    const result = await checkRateLimit(group, key);
    const headers = rateLimitHeaders(result);
    if (!result.ok) {
        return {
            error: errorResponse(429, start, 'Rate limit exceeded', { headers }),
            headers,
        };
    }
    return { error: null, headers };
}

/**
 * Purge fully-elapsed windows. Called periodically by the worker. The longest
 * configured window is 60s; an hour of slack keeps the table tiny without
 * racing in-flight counters.
 *
 * @returns {Promise<{ count: number }>} number of rows deleted.
 */
export function cleanupRateLimitWindows() {
    const cutoff = Math.floor(Date.now() / 1000) - 3600;
    return db.api_rate_limit.deleteMany({ where: { window_start: { lt: cutoff } } });
}
