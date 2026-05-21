import { vi, expect } from 'vitest';

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
 * Create a mock BetterAuth session object.
 *
 * @param {object} [overrides={}] - Fields to override on the session
 * @returns {object} Mock session matching BetterAuth shape
 */
export function createMockSession(overrides = {}) {
    return {
        user: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            image: null,
            role: 'user',
            ...overrides.user,
        },
        session: {
            id: 'test-session-id',
            token: 'test-session-token',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ...overrides.session,
        },
        ...overrides,
    };
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

/**
 * Create a mock Prisma model with all standard CRUD methods as vi.fn() stubs.
 *
 * @returns {object} Model mock with findMany, findUnique, create, update, delete, etc.
 */
export function createMockModel() {
    return {
        findMany: vi.fn(() => Promise.resolve([])),
        findUnique: vi.fn(() => Promise.resolve(null)),
        findFirst: vi.fn(() => Promise.resolve(null)),
        create: vi.fn(() => Promise.resolve({})),
        createMany: vi.fn(() => Promise.resolve({ count: 0 })),
        update: vi.fn(() => Promise.resolve({})),
        upsert: vi.fn(() => Promise.resolve({})),
        delete: vi.fn(() => Promise.resolve({})),
        deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
        count: vi.fn(() => Promise.resolve(0)),
    };
}
