/**
 * Best-effort client IP for rate limiting. Reads the reverse-proxy headers
 * (the app always sits behind one); the first `X-Forwarded-For` hop is the
 * original client. Falls back to `X-Real-IP`, then a constant so a missing
 * header buckets together rather than throwing.
 *
 * ponytail: trusts the proxy to strip client-supplied XFF — true for our
 * deploy. If ever exposed without a trusted proxy, switch to a fixed hop count.
 *
 * @param {Request} request - The incoming request.
 * @returns {string} the caller IP, or `'unknown'`.
 */
export function getClientIp(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return request.headers.get('x-real-ip') ?? 'unknown';
}
