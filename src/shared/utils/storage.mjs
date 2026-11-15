/**
 * `localStorage`, or null when this browser has none. Both cases occur in
 * production: the property is null when DOM storage is off (Android WebViews,
 * HELLDIVERSBOT-6D), and its getter throws a SecurityError when the visitor
 * blocks site data. A missing store is an expected condition, so this reports
 * nothing. It is sync on purpose and is the documented exception to the
 * `tryCatch` rule (AGENTS.md): `tryCatch` is async and reports at warning.
 *
 * @returns {Storage | null}
 */
export function getLocalStorage() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}
