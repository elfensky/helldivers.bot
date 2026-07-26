import db from '@/db/db';
import { GET, POST, PUT, DELETE, PATCH, OPTIONS } from '@/app/api/healthcheck/route';

describe('GET /api/healthcheck', () => {
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
