import { validateApiKey, API_KEY_ERROR } from '@/shared/utils/api/validateApiKey.mjs';
import { errorResponse } from '@/shared/utils/api/responses.mjs';

/**
 * Guard a route handler on a valid user API key (the same `Authorization:
 * Bearer <key>` contract as `/api/h1/rebroadcast`). Returns `null` when the
 * request is authorized, or a ready-to-return `errorResponse` otherwise.
 *
 * Shared by the `/api/v1/h1/*` endpoints so the auth gate and its status codes
 * stay identical across the public API surface.
 *
 * @param {Request} request - The incoming request.
 * @param {number} start - `performance.now()` start time for the response envelope.
 * @returns {Promise<{ error: Response | null, keyId: string | null, userId: string | null }>}
 */
export async function requireApiKey(request, start) {
    const { data, code } = await validateApiKey(request);
    if (code === API_KEY_ERROR.DB_ERROR) {
        return {
            error: errorResponse(503, start, 'database unreachable'),
            keyId: null,
            userId: null,
        };
    }
    if (code === API_KEY_ERROR.DISABLED) {
        return {
            error: errorResponse(403, start, 'Forbidden'),
            keyId: null,
            userId: null,
        };
    }
    if (code) {
        return {
            error: errorResponse(401, start, 'Unauthorized'),
            keyId: null,
            userId: null,
        };
    }
    return { error: null, keyId: data?.keyId ?? null, userId: data?.userId ?? null };
}
