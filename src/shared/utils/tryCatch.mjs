/**
 * Wraps a promise to return a result tuple instead of throwing.
 * @param {Promise<T>} promise
 * @returns {Promise<{data: T, error: null} | {data: null, error: Error}>}
 * @template T
 */
export async function tryCatch(promise) {
    try {
        const data = await promise;
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}
