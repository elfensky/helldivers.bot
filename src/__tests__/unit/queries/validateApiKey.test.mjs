import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { validateApiKey } from '@/shared/utils/api/validateApiKey.mjs';
import { createHash } from 'crypto';

function makeRequest(headerValue) {
    const headers = new Headers();
    if (headerValue !== undefined) {
        headers.set('authorization', headerValue);
    }
    return new Request('http://localhost/api/test', { headers });
}

describe('validateApiKey', () => {
    test('returns missing error when no authorization header', async () => {
        const result = await validateApiKey(makeRequest(undefined));
        expect(result).toEqual({ data: null, code: 'missing' });
    });

    test('returns missing error when header has no Bearer prefix', async () => {
        const result = await validateApiKey(makeRequest('Token abc123'));
        expect(result).toEqual({ data: null, code: 'missing' });
    });

    test('returns missing error when Bearer prefix has no key', async () => {
        const result = await validateApiKey(makeRequest('Bearer '));
        expect(result).toEqual({ data: null, code: 'missing' });
    });

    test('returns invalid error when key is not found in database', async () => {
        vi.mocked(db.ApiKey.findUnique).mockResolvedValue(null);

        const result = await validateApiKey(makeRequest('Bearer some-unknown-key'));
        expect(result).toEqual({ data: null, code: 'invalid' });

        const expectedHash = createHash('sha256')
            .update('some-unknown-key')
            .digest('hex');
        expect(db.ApiKey.findUnique).toHaveBeenCalledWith({
            where: { hash: expectedHash },
            select: { id: true, userId: true, enabled: true },
        });
    });

    test('returns invalid error when database throws', async () => {
        vi.mocked(db.ApiKey.findUnique).mockRejectedValue(new Error('db down'));

        const result = await validateApiKey(makeRequest('Bearer some-key'));
        expect(result).toEqual({ data: null, code: 'invalid' });
    });

    test('returns disabled error when key exists but is disabled', async () => {
        vi.mocked(db.ApiKey.findUnique).mockResolvedValue({
            id: 'key-1',
            userId: 'user-1',
            enabled: false,
        });

        const result = await validateApiKey(makeRequest('Bearer my-disabled-key'));
        expect(result).toEqual({ data: null, code: 'disabled' });
    });

    test('returns user data when key is valid and enabled', async () => {
        vi.mocked(db.ApiKey.findUnique).mockResolvedValue({
            id: 'key-42',
            userId: 'user-99',
            enabled: true,
        });

        const result = await validateApiKey(makeRequest('Bearer valid-key'));
        expect(result).toEqual({
            data: { userId: 'user-99', keyId: 'key-42' },
            code: null,
        });
    });

    test('hashes the key with md5 before querying', async () => {
        vi.mocked(db.ApiKey.findUnique).mockResolvedValue(null);

        await validateApiKey(makeRequest('Bearer test-api-key'));

        const expectedHash = createHash('sha256').update('test-api-key').digest('hex');
        expect(db.ApiKey.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { hash: expectedHash } }),
        );
    });
});
