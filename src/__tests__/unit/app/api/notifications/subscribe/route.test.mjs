import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
    POST,
    DELETE,
    GET,
    PUT,
    PATCH,
    OPTIONS,
} from '@/app/api/notifications/subscribe/route';
import db from '@/db/db';
import { enforceRateLimit } from '@/shared/utils/api/rateLimit.mjs';
import { errorResponse } from '@/shared/utils/api/responses.mjs';

// The limiter itself is covered by rateLimit.test.mjs; here we stub the boundary
// so the route tests assert delegation, not fixed-window counting.
vi.mock('@/shared/utils/api/rateLimit', () => ({ enforceRateLimit: vi.fn() }));

// /api/notifications/subscribe writes to db.push_subscription via the global
// Prisma mock from vitest.setup.mjs. Each test resets the mock and asserts
// on call shape + response envelope.

// Default helpers send same-origin requests with a recognisable Origin/Host
// pair so the route's trust-boundary guard accepts them. The "wrong origin"
// path is exercised by a separate test below.
function postJson(body, { origin = 'http://localhost', host = 'localhost' } = {}) {
    return new Request('http://localhost/api/notifications/subscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Origin: origin,
            Host: host,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}
function deleteJson(body, { origin = 'http://localhost', host = 'localhost' } = {}) {
    return new Request('http://localhost/api/notifications/subscribe', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            Origin: origin,
            Host: host,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

// Placeholders that pass the schema's regex/length validation without
// resembling real VAPID material (GitGuardian flags realistic-format
// base64url strings of the right length as potential secrets).
const validBody = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: {
        p256dh: 'TEST_P256DH_PLACEHOLDER_AAAAAAAAAAAAAAAAAAAAAAAAA',
        auth: 'TEST_AUTH_PLACEHOLDER_AA',
    },
};

beforeEach(() => {
    vi.mocked(db.push_subscription.upsert).mockReset().mockResolvedValue({});
    vi.mocked(db.push_subscription.delete).mockReset().mockResolvedValue({});
    vi.mocked(enforceRateLimit)
        .mockReset()
        .mockResolvedValue({ error: null, headers: {} });
});

// -------- POST --------

describe('POST /api/notifications/subscribe — validation', () => {
    test('returns 400 + error envelope when body is not JSON', async () => {
        const res = await POST(postJson('{ not json'));
        expect(res.status).toBe(400);
        expect(res.headers.get('Content-Type')).toBe('application/json');
        const body = await res.json();
        expect(body).toEqual({
            time: expect.any(Number),
            code: 400,
            message: 'Bad Request',
            error: 'Invalid JSON',
        });
        // DB never touched on parse failure.
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });

    test('returns 400 when endpoint is missing', async () => {
        const res = await POST(postJson({ keys: validBody.keys }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe(400);
        expect(body).toHaveProperty('error');
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });

    test('returns 400 when endpoint is not a valid URL', async () => {
        const res = await POST(postJson({ ...validBody, endpoint: 'not-a-url' }));
        expect(res.status).toBe(400);
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });

    test('returns 400 when endpoint exceeds 2048 characters', async () => {
        const res = await POST(
            postJson({
                ...validBody,
                endpoint: 'https://example.com/' + 'x'.repeat(2050),
            }),
        );
        expect(res.status).toBe(400);
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });

    test('returns 400 when keys are missing', async () => {
        const res = await POST(postJson({ endpoint: validBody.endpoint }));
        expect(res.status).toBe(400);
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });

    test('returns 400 when keys.p256dh contains invalid characters', async () => {
        const res = await POST(
            postJson({
                ...validBody,
                keys: { ...validBody.keys, p256dh: '!!! invalid chars !!!' },
            }),
        );
        expect(res.status).toBe(400);
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });

    test('returns 400 when keys.auth exceeds 256 characters', async () => {
        const res = await POST(
            postJson({
                ...validBody,
                keys: { ...validBody.keys, auth: 'A'.repeat(257) },
            }),
        );
        expect(res.status).toBe(400);
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });
});

describe('POST /api/notifications/subscribe — success', () => {
    test('valid input → 201 with subscribed envelope', async () => {
        const res = await POST(postJson(validBody));
        expect(res.status).toBe(201);
        expect(res.headers.get('Content-Type')).toBe('application/json');
        const body = await res.json();
        expect(body).toEqual({
            time: expect.any(Number),
            code: 201,
            message: 'Created',
            data: { subscribed: true },
        });
    });

    test('upsert is called with endpoint as the where clause and both keys in create + update', async () => {
        await POST(postJson(validBody));
        expect(db.push_subscription.upsert).toHaveBeenCalledTimes(1);
        expect(db.push_subscription.upsert).toHaveBeenCalledWith({
            where: { endpoint: validBody.endpoint },
            create: {
                endpoint: validBody.endpoint,
                keys_p256dh: validBody.keys.p256dh,
                keys_auth: validBody.keys.auth,
            },
            update: {
                keys_p256dh: validBody.keys.p256dh,
                keys_auth: validBody.keys.auth,
            },
        });
    });

    test('calling POST twice with the same endpoint upserts twice (idempotent dedupe via where)', async () => {
        await POST(postJson(validBody));
        await POST(postJson(validBody));
        expect(db.push_subscription.upsert).toHaveBeenCalledTimes(2);
        // Both calls target the same endpoint — dedupe is at the DB level.
        const calls = vi.mocked(db.push_subscription.upsert).mock.calls;
        expect(calls[0][0].where).toEqual(calls[1][0].where);
    });
});

describe('POST /api/notifications/subscribe — failure', () => {
    test('returns 500 when the upsert throws', async () => {
        vi.mocked(db.push_subscription.upsert).mockRejectedValue(
            new Error('connection refused'),
        );
        // Silence the expected error log so this test's intent is clear.
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await POST(postJson(validBody));
        // Lock that upsert WAS invoked — distinguishes "500 from real DB
        // failure" from "500 from never-attempted no-op".
        expect(db.push_subscription.upsert).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(500);
        expect(res.headers.get('Content-Type')).toBe('application/json');
        const body = await res.json();
        expect(body).toEqual({
            time: expect.any(Number),
            code: 500,
            message: 'Internal server error',
            error: 'Failed to save subscription',
        });
        // Source logged the underlying message (debug aid in CI).
        expect(errSpy).toHaveBeenCalledWith(
            'Push subscription upsert error:',
            'connection refused',
        );
    });
});

// -------- DELETE --------

describe('DELETE /api/notifications/subscribe', () => {
    test('returns 400 when body is not JSON', async () => {
        const res = await DELETE(deleteJson('{ malformed'));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid JSON');
        expect(db.push_subscription.delete).not.toHaveBeenCalled();
    });

    test('returns 400 when endpoint is missing', async () => {
        const res = await DELETE(deleteJson({}));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Missing endpoint');
        expect(db.push_subscription.delete).not.toHaveBeenCalled();
    });

    test('returns 400 when endpoint is not a string', async () => {
        const res = await DELETE(deleteJson({ endpoint: 12345 }));
        expect(res.status).toBe(400);
        expect(db.push_subscription.delete).not.toHaveBeenCalled();
    });

    test('returns 200 + unsubscribed envelope on successful delete', async () => {
        const res = await DELETE(deleteJson({ endpoint: validBody.endpoint }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({
            time: expect.any(Number),
            code: 200,
            message: 'OK',
            data: { unsubscribed: true },
        });
        expect(db.push_subscription.delete).toHaveBeenCalledWith({
            where: { endpoint: validBody.endpoint },
        });
    });

    test('returns 200 (graceful) when row does not exist (Prisma "Record to delete does not exist")', async () => {
        // Match the actual Prisma error message substring the source checks for.
        vi.mocked(db.push_subscription.delete).mockRejectedValue(
            new Error(
                'An operation failed because it depends on one or more records that were required but not found. Record to delete does not exist.',
            ),
        );

        const res = await DELETE(deleteJson({ endpoint: validBody.endpoint }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual({ unsubscribed: true });
    });

    test('returns 500 when delete throws for an unrelated reason', async () => {
        vi.mocked(db.push_subscription.delete).mockRejectedValue(
            new Error('connection refused'),
        );
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await DELETE(deleteJson({ endpoint: validBody.endpoint }));
        // Lock that delete WAS attempted.
        expect(db.push_subscription.delete).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Failed to remove subscription');
        expect(errSpy).toHaveBeenCalledWith(
            'Push subscription delete error:',
            'connection refused',
        );
    });
});

// -------- Trust-boundary guards --------

describe('/api/notifications/subscribe — same-origin + rate limit', () => {
    test('POST returns 403 when Origin header is missing', async () => {
        const req = new Request('http://localhost/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validBody),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });

    test('POST returns 403 when Origin does not match Host', async () => {
        const res = await POST(postJson(validBody, { origin: 'https://evil.example' }));
        expect(res.status).toBe(403);
        expect(db.push_subscription.upsert).not.toHaveBeenCalled();
    });

    test('DELETE returns 403 when Origin does not match Host', async () => {
        const res = await DELETE(
            deleteJson(
                { endpoint: validBody.endpoint },
                { origin: 'https://evil.example' },
            ),
        );
        expect(res.status).toBe(403);
        expect(db.push_subscription.delete).not.toHaveBeenCalled();
    });

    test('POST delegates to the push limiter (keyed by client IP) and returns its 429', async () => {
        const reqWithIp = new Request('http://localhost/api/notifications/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost',
                Host: 'localhost',
                'X-Forwarded-For': '203.0.113.1',
            },
            body: JSON.stringify(validBody),
        });
        vi.mocked(enforceRateLimit).mockResolvedValueOnce({
            error: errorResponse(429, 0, 'Rate limit exceeded'),
            headers: {},
        });

        const blocked = await POST(reqWithIp);
        expect(blocked.status).toBe(429);
        const body = await blocked.json();
        expect(body.code).toBe(429);
        expect(body.message).toBe('Too many requests');
        // keyed by the first X-Forwarded-For hop, under the `push` group
        expect(enforceRateLimit).toHaveBeenCalledWith(
            'push',
            '203.0.113.1',
            expect.any(Number),
        );
    });
});

// -------- Disallowed methods --------

describe('disallowed methods on /api/notifications/subscribe', () => {
    test.each([
        ['GET', GET],
        ['PUT', PUT],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])('%s returns 405 with the standard error envelope', async (_name, handler) => {
        const res = await handler();
        expect(res.status).toBe(405);
        const body = await res.json();
        expect(body).toEqual({
            time: expect.any(Number),
            code: 405,
            message: 'Method not allowed',
            error: null,
        });
    });
});
