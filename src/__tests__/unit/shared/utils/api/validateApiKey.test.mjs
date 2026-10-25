import { describe, test, expect, vi, beforeEach } from 'vitest';
import db from '@/db/db';
import { after } from 'next/server';
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
            select: { id: true, userId: true, enabled: true, lastUsedAt: true },
        });
    });

    test('returns db_error code when database throws', async () => {
        vi.mocked(db.ApiKey.findUnique).mockRejectedValue(new Error('db down'));

        const result = await validateApiKey(makeRequest('Bearer some-key'));
        expect(result).toEqual({ data: null, code: 'db_error' });
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

    describe('last-used stamp', () => {
        /** @type {Promise<void> | undefined} */
        let deferred;
        beforeEach(() => {
            deferred = undefined;
            vi.mocked(after).mockImplementation((fn) => {
                deferred = fn();
            });
        });

        const keyRow = (lastUsedAt, enabled = true) =>
            vi.mocked(db.ApiKey.findUnique).mockResolvedValue({
                id: 'key-1',
                userId: 'user-1',
                enabled,
                lastUsedAt,
            });

        test('never-used key is stamped once in after()', async () => {
            keyRow(null);
            const result = await validateApiKey(makeRequest('Bearer k'));
            expect(result).toEqual({
                data: { userId: 'user-1', keyId: 'key-1' },
                code: null,
            });
            expect(after).toHaveBeenCalledTimes(1);
            await deferred;
            expect(db.ApiKey.updateMany).toHaveBeenCalledWith({
                where: {
                    id: 'key-1',
                    OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: expect.any(Date) } }],
                },
                data: { lastUsedAt: expect.any(Date) },
            });
        });

        test('61 s old stamp is refreshed, 10 s old is not', async () => {
            keyRow(new Date(Date.now() - 61_000));
            await validateApiKey(makeRequest('Bearer k'));
            expect(after).toHaveBeenCalledTimes(1);

            vi.mocked(after).mockClear();
            keyRow(new Date(Date.now() - 10_000));
            await validateApiKey(makeRequest('Bearer k'));
            expect(after).not.toHaveBeenCalled();
        });

        test('a failed stamp is swallowed', async () => {
            keyRow(null);
            vi.mocked(db.ApiKey.updateMany).mockRejectedValue(new Error('write failed'));
            await validateApiKey(makeRequest('Bearer k'));
            await expect(deferred).resolves.toBeUndefined();
        });

        test.each([
            ['disabled', () => keyRow(null, false)],
            ['unknown', () => vi.mocked(db.ApiKey.findUnique).mockResolvedValue(null)],
            [
                'db error',
                () => vi.mocked(db.ApiKey.findUnique).mockRejectedValue(new Error('x')),
            ],
        ])('%s key writes nothing', async (_name, arrange) => {
            arrange();
            await validateApiKey(makeRequest('Bearer k'));
            expect(after).not.toHaveBeenCalled();
        });

        test('missing key writes nothing', async () => {
            await validateApiKey(makeRequest(undefined));
            expect(after).not.toHaveBeenCalled();
        });
    });
});
