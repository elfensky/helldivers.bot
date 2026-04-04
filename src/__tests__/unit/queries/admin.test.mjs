import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import {
    getAllUsers,
    updateUserRole,
    toggleUserBan,
    adminGetUserApiKeys,
    adminRevokeApiKey,
    getSystemStats,
} from '@/db/queries/admin.mjs';

const adminId = '01908174-d3a5-7e50-b964-6f5e9e48c0a1';
const targetUserId = '01908174-d3a5-7e50-b964-6f5e9e48c0a2';
const adminSession = { user: { id: adminId, email: 'admin@test.com', role: 'admin' } };
const userSession = { user: { id: adminId, email: 'user@test.com', role: 'user' } };

function createFormData(entries) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(entries)) fd.append(key, value);
    return fd;
}

// ─── getAllUsers ─────────────────────────────────────────────────────

describe('getAllUsers', () => {
    test('returns auth error for non-admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(userSession);
        const result = await getAllUsers();
        expect(result.errors.auth).toBeDefined();
    });

    test('returns user list for admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        const mockUsers = [{ id: targetUserId, name: 'User1', _count: { apiKeys: 2 } }];
        vi.mocked(db.user.findMany).mockResolvedValue(mockUsers);

        const result = await getAllUsers();
        expect(result.data).toEqual(mockUsers);
    });
});

// ─── updateUserRole ─────────────────────────────────────────────────

describe('updateUserRole', () => {
    test('returns auth error for non-admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(userSession);
        const result = await updateUserRole(
            null,
            createFormData({ userId: targetUserId, newRole: 'admin' }),
        );
        expect(result.errors.auth).toBeDefined();
    });

    test('prevents self-demotion', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        const result = await updateUserRole(
            null,
            createFormData({ userId: adminId, newRole: 'user' }),
        );
        expect(result.errors.auth).toMatch(/own role/i);
    });

    test('updates role on success', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.update).mockResolvedValue({ id: targetUserId, role: 'admin' });

        const result = await updateUserRole(
            null,
            createFormData({ userId: targetUserId, newRole: 'admin' }),
        );
        expect(result.data).toBeDefined();
        expect(db.user.update).toHaveBeenCalledWith({
            where: { id: targetUserId },
            data: { role: 'admin' },
        });
        expect(revalidatePath).toHaveBeenCalledWith('/profile/admin');
    });
});

// ─── toggleUserBan ──────────────────────────────────────────────────

describe('toggleUserBan', () => {
    test('returns auth error for non-admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(userSession);
        const result = await toggleUserBan(
            null,
            createFormData({ userId: targetUserId, banned: 'true' }),
        );
        expect(result.errors.auth).toBeDefined();
    });

    test('prevents self-ban', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        const result = await toggleUserBan(
            null,
            createFormData({ userId: adminId, banned: 'true' }),
        );
        expect(result.errors.auth).toMatch(/own account/i);
    });

    test('toggles ban on success', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.update).mockResolvedValue({ id: targetUserId, banned: true });

        const result = await toggleUserBan(
            null,
            createFormData({ userId: targetUserId, banned: 'true' }),
        );
        expect(result.data).toBeDefined();
        expect(db.user.update).toHaveBeenCalledWith({
            where: { id: targetUserId },
            data: { banned: true },
        });
    });
});

// ─── adminGetUserApiKeys ────────────────────────────────────────────

describe('adminGetUserApiKeys', () => {
    test('returns auth error for non-admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(userSession);
        const result = await adminGetUserApiKeys(
            null,
            createFormData({ userId: targetUserId }),
        );
        expect(result.errors.auth).toBeDefined();
    });

    test('returns api keys for any user', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        const mockKeys = [
            {
                id: 'k1',
                description: 'key',
                visible: 'ab12',
                createdAt: new Date(),
                enabled: true,
            },
        ];
        vi.mocked(db.ApiKey.findMany).mockResolvedValue(mockKeys);

        const result = await adminGetUserApiKeys(
            null,
            createFormData({ userId: targetUserId }),
        );
        expect(result.data).toEqual(mockKeys);
    });
});

// ─── adminRevokeApiKey ──────────────────────────────────────────────

describe('adminRevokeApiKey', () => {
    test('returns auth error for non-admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(userSession);
        const apikeyId = '01908174-d3a5-7e50-b964-6f5e9e48c0a3';
        const result = await adminRevokeApiKey(null, createFormData({ apikeyId }));
        expect(result.errors.auth).toBeDefined();
    });

    test('deletes api key on success', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        const apikeyId = '01908174-d3a5-7e50-b964-6f5e9e48c0a3';
        vi.mocked(db.ApiKey.delete).mockResolvedValue({ id: apikeyId });

        const result = await adminRevokeApiKey(null, createFormData({ apikeyId }));
        expect(result.data).toBeDefined();
        expect(db.ApiKey.delete).toHaveBeenCalledWith({ where: { id: apikeyId } });
    });
});

// ─── getSystemStats ─────────────────────────────────────────────────

describe('getSystemStats', () => {
    test('returns auth error for non-admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(userSession);
        const result = await getSystemStats();
        expect(result.errors.auth).toBeDefined();
    });

    test('returns stats for admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.count).mockResolvedValue(24);
        vi.mocked(db.ApiKey.count).mockResolvedValue(47);
        vi.mocked(db.h1_season.findFirst).mockResolvedValue({
            last_updated: new Date(Date.now() - 10000),
        });

        const result = await getSystemStats();
        expect(result.data.totalUsers).toBe(24);
        expect(result.data.totalApiKeys).toBe(47);
        expect(result.data.lastPollTime).toBeDefined();
        expect(typeof result.data.workerHealthy).toBe('boolean');
    });
});
