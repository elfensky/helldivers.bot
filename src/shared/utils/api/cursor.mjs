/**
 * Opaque keyset-pagination cursors for the `/api/v1/h1/*` history endpoints.
 * A cursor encodes the `(bucket, enemy)` position of the last returned row.
 */

/**
 * @param {number} bucket - Bucket window start (unix seconds).
 * @param {number} enemy - Faction id.
 * @returns {string} opaque base64url cursor.
 */
export function encodeCursor(bucket, enemy) {
    return Buffer.from(`${bucket}:${enemy}`).toString('base64url');
}

/**
 * @param {string} cursor - Opaque cursor from a prior page.
 * @returns {{ bucket: number, enemy: number } | null} decoded position, or null if malformed.
 */
export function decodeCursor(cursor) {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [b, e] = decoded.split(':');
    const bucket = Number(b);
    const enemy = Number(e);
    if (!Number.isInteger(bucket) || !Number.isInteger(enemy)) return null;
    return { bucket, enemy };
}
