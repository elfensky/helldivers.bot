import { GET, POST, PUT, DELETE, PATCH, OPTIONS } from '@/app/api/healthcheck/route';

describe('GET /api/healthcheck', () => {
    test('returns 200 with alive:true', async () => {
        const res = await GET(new Request('http://localhost/api/healthcheck'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.alive).toBe(true);
    });

    test('response includes timing ms', async () => {
        const res = await GET(new Request('http://localhost/api/healthcheck'));
        const body = await res.json();
        expect(body).toHaveProperty('time');
        expect(typeof body.time).toBe('number');
    });
});

describe('method not allowed', () => {
    test.each([
        ['POST', POST],
        ['PUT', PUT],
        ['DELETE', DELETE],
        ['PATCH', PATCH],
        ['OPTIONS', OPTIONS],
    ])('%s returns 405', async (_name, handler) => {
        const res = await handler();
        expect(res.status).toBe(405);
    });
});
