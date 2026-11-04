import db from '@/db/db';
import { after } from 'next/server';
import { HOLDER_ID } from '@/update/lease.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { GET, POST, PUT, DELETE, PATCH, OPTIONS } from '@/app/api/healthcheck/route';

describe('GET /api/healthcheck', () => {
    // registerInstance throttles per process (20 s): step a fake clock past it.
    let clock = Date.parse('2030-01-01T00:00:00Z');
    /** @type {Promise<void> | undefined} */
    let deferred;
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime((clock += 60_000));
        deferred = undefined;
        vi.mocked(after).mockImplementation((fn) => {
            deferred = fn();
        });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('returns 200 when database is reachable', async () => {
        db.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

        const res = await GET(new Request('http://localhost/api/healthcheck'));
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('application/json');

        const body = await res.json();
        expect(body).toEqual({
            time: expect.any(Number),
            code: 200,
            message: 'OK',
            data: {
                alive: true,
                performanceTime: expect.any(Number),
            },
        });
        expect(db.$queryRaw).toHaveBeenCalled();
    });

    test('returns 503 when database is unreachable', async () => {
        db.$queryRaw.mockRejectedValue(new Error('connection refused'));

        const res = await GET(new Request('http://localhost/api/healthcheck'));
        expect(res.status).toBe(503);

        const body = await res.json();
        expect(body.code).toBe(503);
        expect(body.message).toBe('Service unavailable');
        expect(body.error).toBe('database unreachable');
        expect(after).not.toHaveBeenCalled();
    });

    test('registers this replica in after() on the 200 path', async () => {
        db.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

        const res = await GET(new Request('http://localhost/api/healthcheck'));
        expect(res.status).toBe(200);
        expect(after).toHaveBeenCalledTimes(1);
        await deferred;
        expect(db.app_instance.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: HOLDER_ID } }),
        );
    });

    test('a failing registration still answers 200 and is reported', async () => {
        db.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
        db.app_instance.upsert.mockRejectedValue(new Error('write failed'));

        const res = await GET(new Request('http://localhost/api/healthcheck'));
        expect(res.status).toBe(200);
        await expect(deferred).resolves.toBeUndefined();
        expect(reportError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                route: '/api/healthcheck',
                stage: 'instance-register',
                level: 'warning',
            }),
        );
    });
});

describe('disallowed methods on /api/healthcheck', () => {
    test.each([
        ['POST', POST],
        ['PUT', PUT],
        ['DELETE', DELETE],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])(
        '%s returns 405 with full error envelope and Content-Type',
        async (_name, handler) => {
            const res = await handler();
            expect(res.status).toBe(405);
            expect(res.headers.get('Content-Type')).toBe('application/json');

            const body = await res.json();
            expect(body).toEqual({
                time: expect.any(Number),
                code: 405,
                message: 'Method not allowed',
                error: null,
            });
            expect(body).not.toHaveProperty('data');
        },
    );
});
