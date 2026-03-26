import { vi } from 'vitest';

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
 * Create a mock NextAuth v5 session object.
 *
 * @param {object} [overrides={}] - Fields to override on the session
 * @returns {object} Mock session matching NextAuth v5 shape
 */
export function createMockSession(overrides = {}) {
    return {
        user: {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.com',
            image: null,
            ...overrides.user,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ...overrides,
    };
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
