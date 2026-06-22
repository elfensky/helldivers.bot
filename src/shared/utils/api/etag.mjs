import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Strong ETag from a stable serialization of the response *data* (not the
 * envelope — the envelope's `time` field changes every request and would
 * defeat caching). Same data → same ETag, so immutable closed-season history
 * reads can answer `If-None-Match` with a 304.
 *
 * @param {unknown} data - The response `data` payload.
 * @returns {string} a quoted strong ETag.
 */
export function computeEtag(data) {
    const hash = createHash('sha1')
        .update(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? Number(v) : v)))
        .digest('base64url');
    return `"${hash}"`;
}

/**
 * 304 Not Modified — re-sends the validators so the cache can refresh its TTL,
 * with no body.
 *
 * @param {string} etag - The matched ETag.
 * @param {string} cacheControl - The same `Cache-Control` the 200 would carry.
 * @returns {NextResponse} a bodiless 304 response.
 */
export function notModified(etag, cacheControl) {
    return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': cacheControl },
    });
}
