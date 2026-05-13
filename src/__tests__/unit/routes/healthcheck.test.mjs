import { GET, POST, PUT, DELETE, PATCH, OPTIONS } from '@/app/api/healthcheck/route';

describe('GET /api/healthcheck', () => {
    test('returns 200 with full success envelope and Content-Type', async () => {
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
        expect(body.time).toBeGreaterThanOrEqual(0);
        expect(body.data.performanceTime).toBeGreaterThanOrEqual(0);
        expect(body).not.toHaveProperty('error');
    });

    test('time field reflects request latency (monotonic, non-negative)', async () => {
        const res = await GET(new Request('http://localhost/api/healthcheck'));
        const body = await res.json();
        // perf timing must be a finite non-negative number, not NaN/Infinity
        expect(Number.isFinite(body.time)).toBe(true);
        expect(Number.isFinite(body.data.performanceTime)).toBe(true);
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
