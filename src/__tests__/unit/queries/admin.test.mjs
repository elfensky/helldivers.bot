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
        expect(revalidatePath).toHaveBeenCalledWith('/profile', 'layout');
    });

    test('prevents demoting the last admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.count).mockResolvedValue(1);

        const result = await updateUserRole(
            null,
            createFormData({ userId: targetUserId, newRole: 'user' }),
        );
        expect(result.errors.auth).toMatch(/last admin/i);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    test('allows demoting when multiple admins exist', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.count).mockResolvedValue(2);
        vi.mocked(db.user.update).mockResolvedValue({ id: targetUserId, role: 'user' });

        const result = await updateUserRole(
            null,
            createFormData({ userId: targetUserId, newRole: 'user' }),
        );
        expect(result.data).toBeDefined();
    });

    test('self-check fires before last-admin check', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.count).mockResolvedValue(1);

        const result = await updateUserRole(
            null,
            createFormData({ userId: adminId, newRole: 'user' }),
        );
        expect(result.errors.auth).toMatch(/own role/i);
    });

    test('allows promoting to admin without guard check', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.update).mockResolvedValue({ id: targetUserId, role: 'admin' });

        const result = await updateUserRole(
            null,
            createFormData({ userId: targetUserId, newRole: 'admin' }),
        );
        expect(result.data).toBeDefined();
        expect(db.user.count).not.toHaveBeenCalled();
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
        vi.mocked(db.user.findUnique).mockResolvedValue({ role: 'user' });
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

    test('prevents banning the last admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.findUnique).mockResolvedValue({ role: 'admin' });
        vi.mocked(db.user.count).mockResolvedValue(1);

        const result = await toggleUserBan(
            null,
            createFormData({ userId: targetUserId, banned: 'true' }),
        );
        expect(result.errors.auth).toMatch(/last admin/i);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    test('allows banning admin when multiple admins exist', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.findUnique).mockResolvedValue({ role: 'admin' });
        vi.mocked(db.user.count).mockResolvedValue(2);
        vi.mocked(db.user.update).mockResolvedValue({ id: targetUserId, banned: true });

        const result = await toggleUserBan(
            null,
            createFormData({ userId: targetUserId, banned: 'true' }),
        );
        expect(result.data).toBeDefined();
    });

    test('allows banning non-admin user without guard check', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.findUnique).mockResolvedValue({ role: 'user' });
        vi.mocked(db.user.update).mockResolvedValue({ id: targetUserId, banned: true });

        const result = await toggleUserBan(
            null,
            createFormData({ userId: targetUserId, banned: 'true' }),
        );
        expect(result.data).toBeDefined();
        expect(db.user.count).not.toHaveBeenCalled();
    });

    test('allows unbanning without guard check', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.user.update).mockResolvedValue({ id: targetUserId, banned: false });

        const result = await toggleUserBan(
            null,
            createFormData({ userId: targetUserId, banned: 'false' }),
        );
        expect(result.data).toBeDefined();
        expect(db.user.findUnique).not.toHaveBeenCalled();
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

    test('returns full stats shape for admin', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);

        vi.mocked(db.h1_season.findFirst).mockResolvedValue({ season: 12 });
        vi.mocked(db.worker_heartbeat.findUnique).mockResolvedValue({
            worker_type: 'cron_api_poller',
            last_beat: new Date(Date.now() - 5000),
            poll_duration_ms: 85,
            last_error: null,
            started_at: new Date(Date.now() - 3600000),
        });
        vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 2 }]);
        vi.mocked(db.h1_event.count).mockResolvedValue(1842);
        vi.mocked(db.h1_season.count).mockResolvedValue(8);
        vi.mocked(db.user.count).mockResolvedValue(24);
        vi.mocked(db.ApiKey.count).mockResolvedValue(9);
        vi.mocked(db.push_subscription.count).mockResolvedValue(6);

        const result = await getSystemStats();
        const d = result.data;

        expect(d.heartbeat).toBeDefined();
        expect(d.workerHealth.status).toBe('healthy');
        expect(d.currentSeason).toBe(12);
        expect(d.activeFactions).toBe(2);
        expect(d.totalEvents).toBe(1842);
        expect(d.seasonsStored).toBe(8);
        expect(d.totalUsers).toBe(24);
        expect(d.totalApiKeys).toBe(9);
        expect(d.pushSubscribers).toBe(6);
    });

    test('returns healthy/degraded/down health states', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.h1_season.findFirst).mockResolvedValue({ season: 1 });
        vi.mocked(db.$queryRaw).mockResolvedValue([{ count: 0 }]);
        vi.mocked(db.h1_event.count).mockResolvedValue(0);
        vi.mocked(db.h1_season.count).mockResolvedValue(1);
        vi.mocked(db.user.count).mockResolvedValue(1);
        vi.mocked(db.ApiKey.count).mockResolvedValue(0);
        vi.mocked(db.push_subscription.count).mockResolvedValue(0);

        vi.mocked(db.worker_heartbeat.findUnique).mockResolvedValue(null);
        let result = await getSystemStats();
        expect(result.data.workerHealth.status).toBe('down');

        vi.mocked(db.worker_heartbeat.findUnique).mockResolvedValue({
            last_beat: new Date(),
            last_error: 'timeout',
            started_at: new Date(),
            poll_duration_ms: 100,
        });
        result = await getSystemStats();
        expect(result.data.workerHealth.status).toBe('degraded');

        vi.mocked(db.worker_heartbeat.findUnique).mockResolvedValue({
            last_beat: new Date(),
            last_error: null,
            started_at: new Date(),
            poll_duration_ms: 50,
        });
        result = await getSystemStats();
        expect(result.data.workerHealth.status).toBe('healthy');
    });

    test('handles missing season gracefully', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(adminSession);
        vi.mocked(db.h1_season.findFirst).mockResolvedValue(null);
        vi.mocked(db.worker_heartbeat.findUnique).mockResolvedValue(null);
        vi.mocked(db.h1_event.count).mockResolvedValue(0);
        vi.mocked(db.h1_season.count).mockResolvedValue(0);
        vi.mocked(db.user.count).mockResolvedValue(1);
        vi.mocked(db.ApiKey.count).mockResolvedValue(0);
        vi.mocked(db.push_subscription.count).mockResolvedValue(0);

        const result = await getSystemStats();
        expect(result.data.currentSeason).toBeNull();
        expect(result.data.activeFactions).toBe(0);
    });
});
