import { reportError } from './observability.mjs';

/**
 * Wraps a promise to return a result tuple instead of throwing.
 * Caught errors are auto-reported to GlitchTip at `level: 'warning'`
 * with `source: 'tryCatch'`. Severity is the tiebreaker against
 * explicit `reportError(...)` calls at user-visible failure points,
 * which fire at the default `error` level — in GlitchTip, the issue
 * groups by stack trace, and the warning here serves as a safety net
 * for any tryCatch site that doesn't escalate to an explicit report.
 * @param {Promise<T>} promise - The promise to wrap
 * @returns {Promise<{data: T, error: null} | {data: null, error: Error}>}
 * @template T
 */
export async function tryCatch(promise) {
    try {
        const data = await promise;
        return { data, error: null };
    } catch (error) {
        reportError(error, { source: 'tryCatch', level: 'warning' });
        return { data: null, error };
    }
}
