import { methodNotAllowed } from '@/utils/methodNotAllowed.mjs';

describe('methodNotAllowed', () => {
    test('returns a Response with status 405', () => {
        const response = methodNotAllowed();
        expect(response.status).toBe(405);
    });

    test('returns JSON with "Method not allowed" message', async () => {
        const response = methodNotAllowed();
        const body = await response.json();
        expect(body.code).toBe(405);
        expect(body.message).toBe('Method not allowed');
    });

    test('returns JSON with timing info', async () => {
        const response = methodNotAllowed();
        const body = await response.json();
        expect(body.time).toBeDefined();
        expect(typeof body.time).toBe('number');
    });
});
