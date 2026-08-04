/**
 * Stand-in for `@sentry/nextjs`, aliased in vitest.visual.config.mjs.
 *
 * The real SDK reads `process.env` at module scope, which does not exist in a
 * browser-mode test — importing it anywhere in the tree (here: via
 * `observability.mjs` → `ComponentErrorBoundary`) fails the whole file with
 * "process is not defined". Error reporting has no pixels, so a no-op is a
 * faithful stand-in for a screenshot.
 *
 * @param {unknown} _error
 * @param {object} [_context]
 */
export function captureException(_error, _context) {}
