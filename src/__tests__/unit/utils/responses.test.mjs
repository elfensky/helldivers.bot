import { vi } from 'vitest';
import { errorResponse, successResponse } from '@/utils/responses.mjs';

describe('errorResponse', () => {
    test('returns 400 Bad Request', async () => {
        const start = performance.now();
        const res = errorResponse(400, start, 'something went wrong');
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe(400);
        expect(body.message).toBe('Bad Request');
        expect(body.error).toBe('something went wrong');
        expect(typeof body.time).toBe('number');
    });

    test('returns 401 Unauthorized', async () => {
        const res = errorResponse(401, performance.now());
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.message).toBe('Unauthorized');
    });

    test('returns 403 Forbidden', async () => {
        const res = errorResponse(403, performance.now());
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.message).toBe('Forbidden');
    });

    test('returns 404 Not found', async () => {
        const res = errorResponse(404, performance.now());
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.message).toBe('Not found');
    });

    test('returns 405 Method not allowed', async () => {
        const res = errorResponse(405, performance.now());
        expect(res.status).toBe(405);
        const body = await res.json();
        expect(body.message).toBe('Method not allowed');
    });

    test('returns 418 teapot', async () => {
        const res = errorResponse(418, performance.now());
        expect(res.status).toBe(418);
        const body = await res.json();
        expect(body.message).toBe("I'm a teapot");
    });

    test('returns 429 Too many requests', async () => {
        const res = errorResponse(429, performance.now());
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.message).toBe('Too many requests');
    });

    test('returns 500 Internal server error', async () => {
        const res = errorResponse(500, performance.now(), { detail: 'crash' });
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe(500);
        expect(body.message).toBe('Internal server error');
        expect(body.error).toEqual({ detail: 'crash' });
    });

    test('returns 502 Bad gateway', async () => {
        const res = errorResponse(502, performance.now());
        const body = await res.json();
        expect(body.message).toBe('Bad gateway');
    });

    test('returns 503 Service unavailable', async () => {
        const res = errorResponse(503, performance.now());
        const body = await res.json();
        expect(body.message).toBe('Service unavailable');
    });

    test('defaults unknown 4xx/5xx codes to 500 Unknown error', async () => {
        const res = errorResponse(499, performance.now());
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.code).toBe(500);
        expect(body.message).toBe('Unknown error');
    });

    test('defaults error to null when not provided', async () => {
        const res = errorResponse(404, performance.now());
        const body = await res.json();
        expect(body.error).toBeNull();
    });

    test('throws on 1xx codes', () => {
        expect(() => errorResponse(100, performance.now())).toThrow('Invalid error code');
    });

    test('throws on 2xx codes', () => {
        expect(() => errorResponse(200, performance.now())).toThrow('Invalid error code');
    });

    test('throws on 3xx codes', () => {
        expect(() => errorResponse(301, performance.now())).toThrow('Invalid error code');
    });

    test('sets Content-Type to application/json', () => {
        const res = errorResponse(500, performance.now());
        expect(res.headers.get('Content-Type')).toBe('application/json');
    });
});

describe('successResponse', () => {
    test('returns 200 OK with data', async () => {
        const start = performance.now();
        const data = { items: [1, 2, 3] };
        const res = successResponse(200, start, data);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.code).toBe(200);
        expect(body.message).toBe('OK');
        expect(body.data).toEqual({ items: [1, 2, 3] });
        expect(typeof body.time).toBe('number');
    });

    test('returns 201 Created', async () => {
        const res = successResponse(201, performance.now(), { id: 1 });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.message).toBe('Created');
    });

    test('returns 202 Accepted', async () => {
        const res = successResponse(202, performance.now(), null);
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.message).toBe('Accepted');
    });

    test('throws on 204 because NextResponse rejects body with 204 status', () => {
        // NextResponse (per spec) does not allow a body with 204 No Content.
        // The function attempts to send a JSON body, so it throws.
        expect(() => successResponse(204, performance.now(), null)).toThrow();
    });

    test('defaults unknown 2xx codes to 200 with Unknown message', async () => {
        const res = successResponse(299, performance.now(), 'data');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.code).toBe(200);
        expect(body.message).toBe('Unknown');
    });

    test('throws on non-2xx codes', () => {
        expect(() => successResponse(400, performance.now(), null)).toThrow('Invalid success code');
        expect(() => successResponse(100, performance.now(), null)).toThrow('Invalid success code');
        expect(() => successResponse(301, performance.now(), null)).toThrow('Invalid success code');
        expect(() => successResponse(500, performance.now(), null)).toThrow('Invalid success code');
    });

    test('sets Content-Type to application/json', () => {
        const res = successResponse(200, performance.now(), null);
        expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    test('serializes bigint values as numbers', async () => {
        const res = successResponse(200, performance.now(), { count: BigInt(42) });
        const body = await res.json();
        expect(body.data.count).toBe(42);
    });
});
