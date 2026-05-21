'use server';
import db from '@/db/db';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performanceTime } from '@/shared/utils/time.mjs';

/**
 * Export all data for the authenticated user (profile, accounts, settings, API keys).
 * Auth guard: session must exist and match the requested userId.
 * @param {string} userId - User ID to export data for
 */
export async function exportUserData(userId) {
    const start = performance.now();
    if (!auth)
        return { errors: { auth: 'Auth not configured' }, time: performanceTime(start) };
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !session.user) {
        return { errors: { auth: 'Not authenticated' }, time: performanceTime(start) };
    }
    if (session.user.id !== userId) {
        return { errors: { auth: 'Not authorized' }, time: performanceTime(start) };
    }

    const { data: userData, error } = await tryCatch(
        db.user.findUnique({
            where: { id: userId },
            include: {
                accounts: {
                    select: { providerId: true, accountId: true, createdAt: true },
                },
                settings: { select: { settings: true } },
                apiKeys: {
                    select: {
                        id: true,
                        description: true,
                        visible: true,
                        createdAt: true,
                        enabled: true,
                    },
                },
            },
        }),
    );
    if (error) throw error;

    return { data: userData, time: performanceTime(start) };
}

/**
 * Delete the authenticated user's account. Requires email confirmation.
 * Revokes session before cascade-deleting all user data.
 * @param {unknown} _ - Unused (server action signature)
 * @param {FormData} formData - Must contain userId and confirmEmail fields
 */
export async function deleteUserAccount(_, formData) {
    const start = performance.now();
    if (!auth)
        return { errors: { auth: 'Auth not configured' }, time: performanceTime(start) };
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !session.user) {
        return { errors: { auth: 'Not authenticated' }, time: performanceTime(start) };
    }

    const userId = formData.get('userId');

    if (session.user.id !== userId) {
        return { errors: { auth: 'Not authorized' }, time: performanceTime(start) };
    }

    // Revoke all sessions before deleting user (cascade will delete sessions from DB,
    // but we need to clear the cookie so no device holds a stale token)
    const { error: revokeError } = await tryCatch(
        auth.api.revokeSessions({ headers: await headers() }),
    );
    if (revokeError) throw revokeError;

    const { error } = await tryCatch(db.user.delete({ where: { id: userId } }));
    if (error) throw error;

    return { data: { deleted: true }, time: performanceTime(start) };
}
