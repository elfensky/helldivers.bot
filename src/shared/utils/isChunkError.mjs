// Matches the several shapes a "stale client requested a chunk the new build no
// longer serves" failure takes across bundlers and browsers. `Failed to load
// chunk` is Turbopack's wording and is listed explicitly so a serialized error
// that lost its `name` (e.g. one relayed over the service-worker bridge) still
// matches on message alone.
const CHUNK_ERROR_RE =
    /ChunkLoadError|Failed to load chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

/**
 * True when the given thrown value looks like a post-deploy chunk load failure.
 * @param {unknown} err - Thrown value, rejection reason, or message string
 * @returns {boolean}
 */
export function isChunkError(err) {
    if (!err) return false;
    if (typeof err === 'string') return CHUNK_ERROR_RE.test(err);
    // Test name AND message, never `message || name`: a real ChunkLoadError
    // carries the identifying token in `name` while `message` is the
    // non-matching "Failed to load chunk X from module Y", so short-circuiting
    // on a non-empty message silently skipped the only field that matched.
    const { name = '', message = '' } = /** @type {{name?: string, message?: string}} */ (
        err
    );
    return CHUNK_ERROR_RE.test(`${name} ${message}`);
}
