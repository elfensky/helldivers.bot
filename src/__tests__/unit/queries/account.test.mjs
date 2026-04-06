import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { auth } from '@/auth';
import { exportUserData, deleteUserAccount } from '@/db/queries/account.mjs';

const userId = '01908174-d3a5-7e50-b964-6f5e9e48c0a1';
const otherUserId = '01908174-d3a5-7e50-b964-6f5e9e48c0a2';
const email = 'test@example.com';
const session = { user: { id: userId, email } };

function createFormData(entries) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(entries)) fd.append(key, value);
    return fd;
}

// ─── exportUserData ─────────────────────────────────────────────────

describe('exportUserData', () => {
    test('returns auth error when no session', async () => {
        const result = await exportUserData(userId);
        expect(result.errors.auth).toBeDefined();
    });

    test('returns auth error when user id does not match', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const result = await exportUserData(otherUserId);
        expect(result.errors.auth).toBeDefined();
    });

    test('returns user data on success', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const mockUser = {
            id: userId,
            name: 'Test',
            email,
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
            accounts: [{ providerId: 'discord', accountId: '123' }],
            settings: null,
            reviews: [],
            apiKeys: [
                {
                    id: 'k1',
                    description: 'key',
                    visible: 'ab12',
                    createdAt: new Date(),
                    enabled: true,
                },
            ],
        };
        vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);

        const result = await exportUserData(userId);
        expect(result.data).toBeDefined();
        expect(result.data.id).toBe(userId);
        expect(result.data.accounts).toHaveLength(1);
    });
});

// ─── deleteUserAccount ──────────────────────────────────────────────

describe('deleteUserAccount', () => {
    test('returns auth error when no session', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);
        const result = await deleteUserAccount(
            null,
            createFormData({ userId, confirmEmail: email }),
        );
        expect(result.errors.auth).toBeDefined();
    });

    test('returns auth error when user id does not match', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const result = await deleteUserAccount(
            null,
            createFormData({ userId: otherUserId, confirmEmail: email }),
        );
        expect(result.errors.auth).toBeDefined();
    });

    test('returns validation error when email confirmation does not match', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const result = await deleteUserAccount(
            null,
            createFormData({ userId, confirmEmail: 'wrong@email.com' }),
        );
        expect(result.errors.confirmEmail).toBeDefined();
    });

    test('deletes user on success', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        vi.mocked(db.user.delete).mockResolvedValue({ id: userId });

        const result = await deleteUserAccount(
            null,
            createFormData({ userId, confirmEmail: email }),
        );
        expect(result.data).toBeDefined();
        expect(db.user.delete).toHaveBeenCalledWith({ where: { id: userId } });
    });
});
