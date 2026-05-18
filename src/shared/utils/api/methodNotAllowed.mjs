import { performance } from 'perf_hooks';
import { errorResponse } from '@/shared/utils/api/responses.mjs';

/**
 * Returns a 405 Method Not Allowed JSON response.
 * @returns {Response}
 */
export const methodNotAllowed = () => {
    const start = performance.now();
    return errorResponse(405, start);
};
