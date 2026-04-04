import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { getApiKeysByUserId, generateApiKey, deleteApiKey } from '@/db/queries/api.mjs';

const userId = '550e8400-e29b-41d4-a716-446655440000';
const otherUserId = '660e8400-e29b-41d4-a716-446655440099';
const session = { user: { id: userId } };

function createFormData(entries) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(entries)) fd.append(key, value);
    return fd;
}

// ─── getApiKeysByUserId ──────────────────────────────────────────────

describe('getApiKeysByUserId', () => {
    test('returns auth error when no session', async () => {
        const result = await getApiKeysByUserId(userId);

        expect(result.errors.auth).toBe('No session found');
        expect(result.query).toBeNull();
    });

    test('returns auth error when user id does not match', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);

        const result = await getApiKeysByUserId(otherUserId);

        expect(result.errors.auth).toBe('User does not match');
        expect(result.query).toBeNull();
    });

    test('returns api keys for matching user', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const mockKeys = [
            {
                id: 'k1',
                description: 'Test key',
                visible: 'ab12',
                createdAt: new Date(),
                enabled: true,
            },
        ];
        vi.mocked(db.ApiKey.findMany).mockResolvedValue(mockKeys);

        const result = await getApiKeysByUserId(userId);

        expect(result.query).toEqual(mockKeys);
        expect(typeof result.ms).toBe('number');
        expect(db.ApiKey.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId },
                select: expect.objectContaining({
                    id: true,
                    description: true,
                    visible: true,
                    createdAt: true,
                    enabled: true,
                }),
            }),
        );
    });

    test('propagates database errors', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        vi.mocked(db.ApiKey.findMany).mockRejectedValue(new Error('DB error'));

        await expect(getApiKeysByUserId(userId)).rejects.toThrow('DB error');
    });
});

// ─── generateApiKey ──────────────────────────────────────────────────

describe('generateApiKey', () => {
    const validFormData = createFormData({
        userId,
        description: 'My test API key',
    });

    test('returns auth error when no session', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);

        const result = await generateApiKey(null, validFormData);

        expect(result.errors.auth).toMatch(/signed in/i);
    });

    test('returns validation errors for invalid formData', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const badFormData = createFormData({ userId: 'not-a-uuid', description: 'ab' });

        const result = await generateApiKey(null, badFormData);

        expect(result.errors).toBeDefined();
        expect(result.errors.userId || result.errors.description).toBeDefined();
    });

    test('returns permission error when user id does not match session', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const mismatchFormData = createFormData({
            userId: otherUserId,
            description: 'Valid description',
        });

        const result = await generateApiKey(null, mismatchFormData);

        expect(result.errors.auth).toMatch(/permission/i);
    });

    test('returns max limit error when user has 5 keys', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        vi.mocked(db.ApiKey.count).mockResolvedValue(5);

        const result = await generateApiKey(
            null,
            createFormData({ userId, description: 'Another key' }),
        );

        expect(result.errors.general).toMatch(/maximum/i);
    });

    test('creates api key and revalidates on success', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        vi.mocked(db.ApiKey.count).mockResolvedValue(2);
        const mockCreated = {
            id: 'new-key-id',
            userId,
            description: 'My test API key',
            hash: 'abc',
            visible: '1234',
        };
        vi.mocked(db.ApiKey.create).mockResolvedValue(mockCreated);

        const result = await generateApiKey(
            null,
            createFormData({ userId, description: 'My test API key' }),
        );

        expect(result.data).toBeDefined();
        expect(result.data.key).toBeDefined();
        expect(typeof result.data.key).toBe('string');
        expect(db.ApiKey.create).toHaveBeenCalledOnce();
        expect(revalidatePath).toHaveBeenCalledWith('/profile', 'page');
    });

    test('propagates database errors from create', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        vi.mocked(db.ApiKey.count).mockResolvedValue(0);
        vi.mocked(db.ApiKey.create).mockRejectedValue(new Error('Insert failed'));

        await expect(
            generateApiKey(
                null,
                createFormData({ userId, description: 'Key description' }),
            ),
        ).rejects.toThrow('Insert failed');
    });
});

// ─── deleteApiKey ────────────────────────────────────────────────────

describe('deleteApiKey', () => {
    const apikeyId = '770e8400-e29b-41d4-a716-446655440011';
    const validFormData = createFormData({ userId, apikeyId });

    test('returns auth error when no session', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);

        const result = await deleteApiKey(null, validFormData);

        expect(result.errors.auth).toMatch(/permission/i);
    });

    test('returns validation errors for invalid formData', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const badFormData = createFormData({ userId: 'bad', apikeyId: 'bad' });

        const result = await deleteApiKey(null, badFormData);

        expect(result.errors).toBeDefined();
        expect(result.errors.userId || result.errors.apikeyId).toBeDefined();
    });

    test('returns permission error when user id does not match session', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const mismatchFormData = createFormData({ userId: otherUserId, apikeyId });

        const result = await deleteApiKey(null, mismatchFormData);

        expect(result.errors.auth).toMatch(/permission/i);
    });

    test('deletes api key and revalidates on success', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const mockDeleted = { id: apikeyId, userId };
        vi.mocked(db.ApiKey.delete).mockResolvedValue(mockDeleted);

        const result = await deleteApiKey(null, createFormData({ userId, apikeyId }));

        expect(result.data).toEqual(mockDeleted);
        expect(db.ApiKey.delete).toHaveBeenCalledWith({
            where: { id: apikeyId, userId },
        });
        expect(revalidatePath).toHaveBeenCalledWith('/profile', 'page');
    });

    test('propagates database errors from delete', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        vi.mocked(db.ApiKey.delete).mockRejectedValue(new Error('Record not found'));

        await expect(
            deleteApiKey(null, createFormData({ userId, apikeyId })),
        ).rejects.toThrow('Record not found');
    });
});
