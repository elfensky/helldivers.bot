import { expect } from 'vitest';

/**
 * Create a mock Request object for API route handler tests.
 *
 * @param {string} url - Request URL (e.g., 'http://localhost/api/healthcheck')
 * @param {string} [method='GET'] - HTTP method
 * @param {object} [body] - Request body (will be JSON-serialized)
 * @param {object} [headers={}] - Additional headers
 * @returns {Request}
 */
export function createMockRequest(url, method = 'GET', body, headers = {}) {
    const init = {
        method,
        headers: new Headers({
            'content-type': 'application/json',
            ...headers,
        }),
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
        init.body = JSON.stringify(body);
    }

    return new Request(url, init);
}

/**
 * Assert that a response body matches the standard success envelope from
 * `src/shared/utils/api/responses.mjs::successResponse`:
 *
 *   { time, code, message, data }
 *
 * The `code` defaults to `expect.any(Number)`. Pass `{ code, data }` to lock
 * in specific values; `data` accepts an exact value, a partial matcher, or
 * `expect.any(...)`. Errors that the standard envelope guarantees are absent
 * (the `error` key) are explicitly asserted not-present.
 *
 * @param {object} body - JSON-parsed response body
 * @param {{ code?: number, data?: unknown }} [opts] - Optional matchers to assert specific `code`/`data` values
 */
export function expectSuccessEnvelope(body, { code, data } = {}) {
    expect(body).toMatchObject({
        time: expect.any(Number),
        code: code ?? expect.any(Number),
        message: expect.any(String),
        ...(data !== undefined && { data }),
    });
    expect(typeof body.time).toBe('number');
    expect(Number.isFinite(body.time)).toBe(true);
    expect(body).not.toHaveProperty('error');
}

/**
 * Assert that a response body matches the standard error envelope from
 * `src/shared/utils/api/responses.mjs::errorResponse`:
 *
 *   { time, code, message, error }
 *
 * The `code` defaults to `expect.any(Number)`. Pass `{ code, error }` to lock
 * in specific values; `error` can be a string, a partial matcher, or omitted.
 *
 * @param {object} body - JSON-parsed response body
 * @param {{ code?: number, error?: unknown }} [opts] - Optional matchers to assert specific `code`/`error` values
 */
export function expectErrorEnvelope(body, { code, error } = {}) {
    expect(body).toMatchObject({
        time: expect.any(Number),
        code: code ?? expect.any(Number),
        message: expect.any(String),
        ...(error !== undefined && { error }),
    });
    expect(typeof body.time).toBe('number');
    expect(Number.isFinite(body.time)).toBe(true);
    expect(body).toHaveProperty('error');
    expect(body).not.toHaveProperty('data');
}
